use axum::{Json, Router, routing::get};
use serde_json::json;

pub fn router() -> Router {
    Router::new().route("/health", get(health))
}

async fn health() -> Json<serde_json::Value> {
    let model = match std::env::var("MODEL_URL") {
        Ok(url) if !url.trim().is_empty() => "live",
        _ => "mock",
    };
    Json(json!({ "status": "ok", "model": model }))
}
