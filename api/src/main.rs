mod routes;

use axum::Router;
use tower_http::{cors::CorsLayer, trace::TraceLayer};
use tracing_subscriber::{EnvFilter, layer::SubscriberExt, util::SubscriberInitExt};

#[tokio::main]
async fn main() {
    tracing_subscriber::registry()
        .with(
            EnvFilter::try_from_default_env()
                .unwrap_or_else(|_| "asado_api=info,tower_http=info".into()),
        )
        .with(tracing_subscriber::fmt::layer())
        .init();

    let app = Router::new()
        .nest("/api", routes::router())
        .layer(CorsLayer::permissive())
        .layer(TraceLayer::new_for_http());

    let bind = std::env::var("BIND").unwrap_or_else(|_| "0.0.0.0:4000".to_owned());
    let listener = tokio::net::TcpListener::bind(&bind)
        .await
        .unwrap_or_else(|e| panic!("bind {bind}: {e}"));
    tracing::info!("asado api listening on {bind}");
    axum::serve(listener, app).await.expect("server error");
}
