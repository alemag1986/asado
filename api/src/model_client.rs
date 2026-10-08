use serde::{Deserialize, Serialize};

use crate::domain::cuts::Cut;

#[derive(Clone, Debug, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "lowercase")]
pub enum Sear {
    Low,
    Good,
    Dark,
}

#[derive(Clone, Debug, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "snake_case")]
pub enum Action {
    Flip,
    Hold,
    MoveToLow,
    Pull,
}

#[derive(Clone, Debug, Serialize, Deserialize, PartialEq)]
pub struct Analysis {
    pub sear: Sear,
    pub doneness_est: u32,
    #[serde(deserialize_with = "deser_action")]
    pub action: Action,
    pub minutes: u32,
    pub confidence: u32,
    pub tip: String,
}

fn deser_action<'de, D: serde::Deserializer<'de>>(d: D) -> Result<Action, D::Error> {
    let raw = String::deserialize(d)?;
    Ok(match raw.as_str() {
        "flip" => Action::Flip,
        "hold" => Action::Hold,
        "move_to_low" | "move-to-low" => Action::MoveToLow,
        "pull" => Action::Pull,
        _ => Action::Hold,
    })
}

fn default_analysis(cut: &Cut, probe_c: Option<f64>) -> Analysis {
    let tip = match (probe_c, cut.target_temp_c) {
        (Some(p), Some(t)) if p.is_finite() => {
            let left = ((t - p).round()).max(0.0);
            format!(
                "Probe reads {p:.0}°C — {left:.0}°C from your {t:.0}°C target. {rule}",
                rule = cut.pull_rule
            )
        }
        _ => cut.pull_rule.to_owned(),
    };
    Analysis {
        sear: Sear::Good,
        doneness_est: 58,
        action: Action::Flip,
        minutes: 6,
        confidence: 74,
        tip,
    }
}

#[derive(Clone)]
pub struct ModelConfig {
    pub url: String,
    pub api_key: Option<String>,
    pub model: String,
}

impl ModelConfig {
    pub fn from_env() -> Self {
        ModelConfig {
            url: std::env::var("MODEL_URL").unwrap_or_default(),
            api_key: std::env::var("MODEL_API_KEY")
                .ok()
                .filter(|s| !s.is_empty()),
            model: std::env::var("MODEL_NAME").unwrap_or_else(|_| "asado-4b".to_owned()),
        }
    }

    pub fn live(&self) -> bool {
        !self.url.trim().is_empty()
    }
}

#[derive(Deserialize)]
struct ChatResp {
    choices: Vec<Choice>,
}

#[derive(Deserialize)]
struct Choice {
    message: Msg,
}

#[derive(Deserialize)]
struct Msg {
    content: Option<String>,
}

/// POST to an OpenAI-compatible endpoint with a JSON-schema response format.
/// 25s timeout, one retry on transport errors and non-4xx responses.
/// On failure of any kind it falls back to the canned analysis — the app
/// degrades to the offline advisor instead of erroring out.
pub async fn analyze(cfg: &ModelConfig, cut: &Cut, image: &[u8], probe_c: Option<f64>) -> Analysis {
    if !cfg.live() {
        return default_analysis(cut, probe_c);
    }

    let url = format!("{}/chat/completions", cfg.url.trim_end_matches('/'));
    let base64_image = base64::Engine::encode(&base64::engine::general_purpose::STANDARD, image);

    let prompt = format!(
        "Photo of a {name} on the grill. Judge the DONENESS and SEAR of the meat in the foreground, not the background. Respond only with the requested JSON.\n\
         {{ \"sear\": \"low\" | \"good\" | \"dark\", \"doneness_est\": <degrees C 30-95>, \"action\": \"flip\" | \"hold\" | \"move_to_low\" | \"pull\", \"minutes\": <0-20 until next action>, \"confidence\": <0-100>, \"tip\": <1-2 sentences, direct> }}{probe}",
        name = cut.name,
        probe = probe_c
            .filter(|p| p.is_finite())
            .map(|p| format!("\nA probe reads {p:.0} C — use it as ground truth, not a guess."))
            .unwrap_or_default(),
    );

    let body = serde_json::json!({
        "model": cfg.model,
        "messages": [{
            "role": "user",
            "content": [
                { "type": "text", "text": prompt },
                { "type": "image_url", "image_url": { "url": format!("data:image/jpeg;base64,{base64_image}") } }
            ]
        }],
        "response_format": {
            "type": "json_schema",
            "json_schema": {
                "name": "analysis",
                "strict": true,
                "schema": {
                    "type": "object",
                    "properties": {
                        "sear": { "type": "string", "enum": ["low", "good", "dark"] },
                        "doneness_est": { "type": "integer" },
                        "action": { "type": "string", "enum": ["flip", "hold", "move_to_low", "pull"] },
                        "minutes": { "type": "integer", "minimum": 0, "maximum": 20 },
                        "confidence": { "type": "integer", "minimum": 0, "maximum": 100 },
                        "tip": { "type": "string" }
                    },
                    "required": ["sear", "doneness_est", "action", "minutes", "confidence", "tip"]
                }
            }
        },
        "max_tokens": 400
    });

    let client = reqwest::Client::builder()
        .timeout(std::time::Duration::from_secs(25))
        .build()
        .expect("reqwest client");

    for attempt in 0..2 {
        let mut req = client.post(&url).json(&body);
        if let Some(key) = &cfg.api_key {
            req = req.bearer_auth(key);
        }

        let resp = req.send().await;

        let ok = match &resp {
            Ok(r) => r.status().is_success(),
            Err(_) => false,
        };
        let is_client_err = matches!(&resp, Ok(r) if r.status().is_client_error());

        if ok {
            if let Ok(parsed) = resp.unwrap().json::<ChatResp>().await {
                let content = parsed
                    .choices
                    .first()
                    .and_then(|c| c.message.content.clone())
                    .unwrap_or_default();
                if let Some(analysis) = parse_analysis(&content, cut, probe_c) {
                    return analysis;
                }
            }
            break;
        }

        if is_client_err {
            tracing::warn!(attempt, "model rejected request: {resp:?}");
            break;
        }

        tracing::warn!(attempt, "model request failed: {resp:?}");
    }

    default_analysis(cut, probe_c)
}

fn parse_analysis(content: &str, cut: &Cut, _probe_c: Option<f64>) -> Option<Analysis> {
    let trimmed = content.trim();
    let json_str = trimmed
        .strip_prefix("```json")
        .and_then(|s| s.strip_suffix("```"))
        .unwrap_or(trimmed);
    let mut analysis: Analysis = serde_json::from_str(json_str).ok()?;
    analysis.doneness_est = analysis.doneness_est.clamp(30, 95);
    analysis.minutes = analysis.minutes.min(20);
    analysis.confidence = analysis.confidence.min(100);
    if analysis.tip.trim().is_empty() {
        analysis.tip = cut.pull_rule.to_owned();
    }
    Some(analysis)
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::domain::cuts::cut;

    #[test]
    fn mock_analysis_echoes_probe_target() {
        let a = default_analysis(cut("tira").unwrap(), Some(61.0));
        assert_eq!(a.action, Action::Flip);
        assert!(a.tip.contains("61") && a.tip.contains("68"));
    }

    #[test]
    fn parses_fenced_and_naked_json() {
        let c = cut("vacio").unwrap();
        let miss = r#"{"sear":"dark","doneness_est":60,"action":"move_to_low","minutes":8,"confidence":90,"tip":"Shell is hard."}"#;
        let got = parse_analysis(miss, c, None);
        assert_eq!(got.unwrap().action, Action::MoveToLow);

        let fenced = "```json\n{\"sear\":\"good\",\"doneness_est\":58,\"action\":\"flip\",\"minutes\":4,\"confidence\":80,\"tip\":\"Keep rolling.\"}\n```";
        let got = parse_analysis(fenced, c, None).unwrap();
        assert_eq!(got.minutes, 4);

        // unknown action → hold; garbage → None
        let bad = r#"{"sear":"good","action":"teleport","doneness_est":58,"minutes":4,"confidence":80,"tip":"x"}"#;
        assert_eq!(parse_analysis(bad, c, None).unwrap().action, Action::Hold);
        assert!(parse_analysis("not json", c, None).is_none());
    }
}
