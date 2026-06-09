//! Tauri desktop entry point.
//!
//! Builds only with `--features tauri-app` (requires webkit2gtk-4.1 on Linux).
//! On startup it spawns the same relay used by the headless binary, then opens
//! the desktop webview which loads the Desktop route ("/") and connects back to
//! the relay over WSS as a client.

use mocap_rs::{net, server, DEFAULT_PORT};

fn main() {
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

    tauri::Builder::default()
        .setup(move |_app| {
            // Spawn the relay in a background tokio runtime so the phone can
            // connect and the desktop webview can subscribe.
            std::thread::spawn(move || {
                let rt = tokio::runtime::Runtime::new().expect("tokio runtime");
                rt.block_on(async move {
                    net::print_banner(port);
                    if let Err(e) = server::run(port, server::default_static_dir()).await {
                        eprintln!("relay failed: {e}");
                    }
                });
            });
            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
