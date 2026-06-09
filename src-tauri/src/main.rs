//! Phase 1 standalone runner: boots the relay with no GUI.
//!
//! In Phase 2 the Tauri app takes over `main` and spawns `mocap_rs::server::run`
//! from its `setup` hook; this binary stays as a handy headless dev server.

use mocap_rs::{net, server, DEFAULT_PORT};

#[tokio::main]
async fn main() {
    // Logging: `RUST_LOG=mocap_rs=debug` for verbose, info by default.
    tracing_subscriber::fmt()
        .with_env_filter(
            tracing_subscriber::EnvFilter::try_from_default_env()
                .unwrap_or_else(|_| "mocap_rs=info,tower_http=warn".into()),
        )
        .init();

    let port = std::env::var("MOCAP_PORT")
        .ok()
        .and_then(|p| p.parse().ok())
        .unwrap_or(DEFAULT_PORT);

    net::print_banner(port);

    if let Err(e) = server::run(port, server::default_static_dir()).await {
        eprintln!("relay failed: {e}");
        std::process::exit(1);
    }
}
