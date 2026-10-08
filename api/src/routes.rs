use std::collections::HashMap;
use std::collections::hash_map::DefaultHasher;
use std::hash::{Hash, Hasher};
use std::net::SocketAddr;
use std::time::Instant;

use axum::extract::{ConnectInfo, Multipart, Path, Query, State};
use axum::http::{StatusCode, header};
use axum::response::{IntoResponse, Response};
use axum::routing::{get, post};
use axum::{Json, Router};
use serde::{Deserialize, Serialize};
use serde_json::{Value, json};
use tokio::sync::Mutex;

use crate::domain::cuts::{Appetite, BEEF_DEFAULTS, CUTS, FuelId};
use crate::domain::fire::FirePlan;
use crate::domain::plan;
use crate::feed::FeedStore;
use crate::model_client::{Analysis, ModelConfig};

const LIVE_LIMIT_PER_MIN: usize = 12;
const CACHE_CAP: usize = 256;
const LB_PER_KG: f64 = 2.20462;

#[derive(Clone)]
pub struct AppState {
    pub model: ModelConfig,
    pub cache: std::sync::Arc<Mutex<HashMap<u64, Analysis>>>,
    pub limiter: std::sync::Arc<Mutex<HashMap<String, Vec<Instant>>>>,
    pub feed: FeedStore,
}

impl AppState {
    pub fn new() -> Self {
        AppState {
            model: ModelConfig::from_env(),
            cache: std::sync::Arc::new(Mutex::new(HashMap::new())),
            limiter: std::sync::Arc::new(Mutex::new(HashMap::new())),
            feed: FeedStore::default(),
        }
    }
}

pub fn router(state: AppState) -> Router {
    Router::new()
        .route("/health", get(health))
        .route("/cuts", get(cuts_list))
        .route("/styles", get(styles))
        .route("/plan", post(plan_handler))
        .route("/fire", post(fire_handler))
        .route("/cook/timing", post(timing_handler))
        .route("/cook/analyze", post(analyze_handler))
        .route("/feed", get(feed_list).post(feed_create))
        .route("/feed/{id}/photo", get(feed_photo))
        .route("/feed/{id}/report", post(feed_report))
        .with_state(state)
}

fn err(status: StatusCode, msg: impl Into<String>) -> Response {
    (status, Json(json!({ "error": msg.into() }))).into_response()
}

async fn health(State(state): State<AppState>) -> Json<Value> {
    Json(json!({ "status": "ok", "model": if state.model.live() { "live" } else { "mock" } }))
}

async fn cuts_list() -> Json<Value> {
    let list: Vec<_> = CUTS.iter().map(|c| c.dto()).collect();
    Json(json!({ "cuts": list }))
}

async fn styles() -> Json<Value> {
    Json(json!({
        "styles": crate::domain::styles::STYLES,
        "markers": crate::domain::styles::MARKERS,
    }))
}

// ---------------------------------------------------------------- plan

#[derive(Deserialize)]
struct PlanReq {
    people: Option<u32>,
    kids: Option<u32>,
    appetite: Option<String>,
    achuras: Option<bool>,
    cuts: Option<Vec<String>>,
    unit: Option<String>,
}

#[derive(Serialize)]
struct PlanResp {
    items: Vec<PlanItemResp>,
    order: Vec<&'static str>,
    total_kg: f64,
    total_lb: f64,
    per_person_kg: f64,
    per_person_lb: f64,
    unit: &'static str,
    tip: &'static str,
}

#[derive(Serialize)]
struct PlanItemResp {
    cut: &'static str,
    qty: String,
    note: &'static str,
}

fn fmt_lb(kg: f64) -> f64 {
    (kg * LB_PER_KG * 10.0).round() / 10.0
}

async fn plan_handler(State(_): State<AppState>, Json(req): Json<PlanReq>) -> Json<Value> {
    let adults = req.people.unwrap_or(8).clamp(1, 500);
    let kids = req.kids.unwrap_or(0).clamp(0, 200);
    let appetite = req
        .appetite
        .as_deref()
        .and_then(Appetite::parse)
        .unwrap_or(Appetite::Normal);
    let achuras = req.achuras.unwrap_or(true);
    let cuts = req
        .cuts
        .filter(|c| !c.is_empty())
        .unwrap_or_else(|| BEEF_DEFAULTS.iter().map(|s| s.to_string()).collect());
    let unit = if req.unit.as_deref() == Some("lb") {
        "lb"
    } else {
        "kg"
    };

    let p = plan::build_plan(adults, kids, appetite, achuras, &cuts);

    let items: Vec<PlanItemResp> = p
        .items
        .iter()
        .map(|i| PlanItemResp {
            cut: i.cut,
            qty: i.qty.clone(),
            note: i.note,
        })
        .collect();

    Json(json!(PlanResp {
        items,
        order: p.order,
        total_kg: p.total_kg,
        total_lb: fmt_lb(p.total_kg),
        per_person_kg: p.per_person_kg,
        per_person_lb: fmt_lb(p.per_person_kg),
        unit,
        tip: p.tip,
    }))
}

// ---------------------------------------------------------------- fire

#[derive(Deserialize)]
struct FireReq {
    fuel: Option<String>,
    cuts: Option<Vec<String>>,
    ready_by: Option<String>,
    meat_kg: Option<f64>,
    servings: Option<u32>,
}

async fn fire_handler(State(_): State<AppState>, Json(req): Json<FireReq>) -> Response {
    let fuel = req
        .fuel
        .as_deref()
        .and_then(FuelId::parse)
        .unwrap_or(FuelId::Charcoal);
    let cuts = req.cuts.unwrap_or_default();
    let ready_by = req.ready_by.unwrap_or_else(|| "20:00".to_owned());
    let meat_kg = req
        .meat_kg
        .or_else(|| req.servings.map(|s| s.max(1) as f64 * 0.55));
    let cook_min = FirePlan::cook_min_for(&cuts);

    let fire = crate::domain::fire::build_fire(fuel, cook_min, &ready_by, meat_kg);
    Json(json!({
        "fuel": fire.fuel,
        "cook_min": fire.cook_min,
        "timeline": fire.timeline(),
        "fire_start": fire.fire_start,
        "coal_ready": fire.coal_ready,
        "first_on": fire.first_on,
        "serving": fire.serving,
        "fuel_kg": fire.fuel_kg,
        "steps": fire.steps,
        "checklist": fire.checklist,
        "big_fire": fire.big_fire,
    }))
    .into_response()
}

// ---------------------------------------------------------------- timing

#[derive(Deserialize)]
struct TimingReq {
    cut: String,
    thickness_mm: Option<u32>,
    style: Option<String>,
}

async fn timing_handler(State(_): State<AppState>, Json(req): Json<TimingReq>) -> Response {
    match crate::domain::cuts::cut(&req.cut) {
        Some(c) => {
            let _ = (req.thickness_mm, req.style); // reserve for thickness-based time adjustment
            Json(json!({ "cut": c.dto() })).into_response()
        }
        None => err(StatusCode::NOT_FOUND, format!("unknown cut {:?}", req.cut)),
    }
}

// ---------------------------------------------------------------- analyze

fn cache_key(cut: &str, probe_bits: u64, image: &[u8]) -> u64 {
    let mut h = DefaultHasher::new();
    cut.hash(&mut h);
    probe_bits.hash(&mut h);
    image.hash(&mut h);
    h.finish()
}

async fn rate_limited(State(state): State<AppState>, ip: &str) -> bool {
    let mut limiter = state.limiter.lock().await;
    let now = Instant::now();
    let window = limiter.entry(ip.to_owned()).or_default();
    window.retain(|t| now.duration_since(*t) < std::time::Duration::from_secs(60));
    if window.len() >= LIVE_LIMIT_PER_MIN {
        return true;
    }
    window.push(now);
    false
}

async fn analyze_handler(
    State(state): State<AppState>,
    ConnectInfo(addr): ConnectInfo<SocketAddr>,
    mut mp: Multipart,
) -> Response {
    let mut cut_id: Option<String> = None;
    let mut probe_c: Option<f64> = None;
    let mut image: Option<Vec<u8>> = None;

    while let Ok(Some(field)) = mp.next_field().await {
        match field.name() {
            Some("cut") => cut_id = field.text().await.ok(),
            Some("probe_c") => {
                probe_c = field.text().await.ok().and_then(|t| t.trim().parse().ok())
            }
            Some("image") => image = field.bytes().await.ok().map(|b| b.to_vec()),
            _ => {}
        }
    }

    let Some(cut_id) = cut_id else {
        return err(StatusCode::BAD_REQUEST, "missing cut field");
    };
    let Some(cut) = crate::domain::cuts::cut(&cut_id) else {
        return err(StatusCode::NOT_FOUND, format!("unknown cut: {cut_id}"));
    };
    let Some(image) = image.filter(|b| !b.is_empty()) else {
        return err(StatusCode::BAD_REQUEST, "missing image field");
    };

    if !state.model.live() {
        return Json(crate::model_client::analyze(&state.model, cut, &image, probe_c).await)
            .into_response();
    }

    let ip = addr.ip().to_string();
    if rate_limited(State(state.clone()), &ip).await {
        return (
            StatusCode::TOO_MANY_REQUESTS,
            Json(json!({"error": "too many checks — wait a minute" })),
        )
            .into_response();
    }

    let key = cache_key(&cut_id, probe_c.map(|p| p.to_bits()).unwrap_or(0), &image);
    {
        let cache = state.cache.lock().await;
        if let Some(hit) = cache.get(&key) {
            return Json(hit).into_response();
        }
    }

    let analysis = crate::model_client::analyze(&state.model, cut, &image, probe_c).await;
    let mut cache = state.cache.lock().await;
    if cache.len() >= CACHE_CAP {
        cache.clear();
    }
    cache.insert(key, analysis.clone());
    drop(cache);

    Json(analysis).into_response()
}

// ---------------------------------------------------------------- feed

async fn feed_create(State(state): State<AppState>, mut mp: Multipart) -> Response {
    let mut caption = String::new();
    let mut cut: Option<String> = None;
    let mut photo: Option<Vec<u8>> = None;

    while let Ok(Some(field)) = mp.next_field().await {
        match field.name() {
            Some("caption") => caption = field.text().await.unwrap_or_default(),
            Some("cut") => cut = field.text().await.ok().filter(|t| !t.trim().is_empty()),
            Some("photo") => photo = field.bytes().await.ok().map(|b| b.to_vec()),
            _ => {}
        }
    }

    if caption.trim().is_empty() && cut.is_none() {
        return err(
            StatusCode::BAD_REQUEST,
            "empty post — add a caption or a cut tag",
        );
    }

    let post = state
        .feed
        .create(cut, caption.trim().to_owned(), photo)
        .await;
    Json(post).into_response()
}

#[derive(Deserialize)]
struct FeedQuery {
    cursor: Option<u64>,
}

async fn feed_list(State(state): State<AppState>, Query(q): Query<FeedQuery>) -> Json<Value> {
    let (posts, next_cursor) = state.feed.list(q.cursor).await;
    Json(json!({ "posts": posts, "next_cursor": next_cursor }))
}

async fn feed_photo(State(state): State<AppState>, Path(id): Path<String>) -> Response {
    match state.feed.photo(&id).await {
        Some(bytes) => ([(header::CONTENT_TYPE, "image/jpeg")], bytes).into_response(),
        None => err(StatusCode::NOT_FOUND, "no photo"),
    }
}

async fn feed_report(State(state): State<AppState>, Path(id): Path<String>) -> Json<Value> {
    let ok = state.feed.report(&id).await;
    Json(json!({ "ok": ok, "report_id": id }))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn cache_is_stable_across_calls() {
        let a = cache_key("tira", 0, b"abc");
        let b = cache_key("tira", 0, b"abc");
        let c = cache_key("tira", 1, b"abc");
        assert_eq!(a, b);
        assert_ne!(a, c);
    }
}
