//! axum HTTP + WebSocket relay.
//!
//! Responsibilities (and nothing more — see the architecture notes):
//!   * `GET  /`        — info / landing page (or the SPA once it's built)
//!   * `GET  /phone`   — the phone capture page
//!   * `GET  /ws`      — WebSocket relay endpoint
//!   * everything else — static files from the frontend build (`static_dir`),
//!                       with SPA fallback to `index.html`
//!
//! The phone runs MediaPipe and *publishes* landmark frames; the desktop
//! *subscribes*. The server never inspects the payload — it just relays.

use std::net::SocketAddr;
use std::path::{Path, PathBuf};

use axum::{
    extract::{
        ws::{Message, WebSocket, WebSocketUpgrade},
        State,
    },
    response::{Html, IntoResponse},
    routing::get,
    Router,
};
use axum_server::tls_rustls::RustlsConfig;
use futures_util::{SinkExt, StreamExt};
use tower::Layer;
use tower_http::cors::CorsLayer;
use tower_http::services::{ServeDir, ServeFile};
use tower_http::set_header::SetResponseHeaderLayer;
use uuid::Uuid;

use crate::session::Sessions;
use crate::tls;

/// Shared state handed to every request handler.
#[derive(Clone)]
pub struct AppState {
    pub sessions: Sessions,
    /// Directory containing the built frontend (Vite `dist`). May not exist
    /// yet during early phases — handlers degrade gracefully.
    pub static_dir: PathBuf,
    /// Port the relay is bound to (used to build the phone pairing URL).
    pub port: u16,
}

/// Build the axum router. Kept separate from [`run`] so it can be unit-tested
/// or mounted by the Tauri host without binding a socket.
pub fn router(state: AppState) -> Router {
    // Static files, with SPA fallback to index.html so client-side routes
    // (e.g. `/phone`) resolve when the page is opened directly. Cache assets
    // for a week so refreshes reuse the (large) VRM + hashed JS instead of
    // re-downloading. `index.html` is served by the `/` handler (uncached), so
    // a new build's hashed bundles are always picked up.
    let index_file = state.static_dir.join("index.html");
    let serve_static = SetResponseHeaderLayer::overriding(
        axum::http::header::CACHE_CONTROL,
        axum::http::HeaderValue::from_static("public, max-age=604800"),
    )
    .layer(
        ServeDir::new(&state.static_dir)
            .append_index_html_on_directories(true)
            .fallback(ServeFile::new(index_file)),
    );

    Router::new()
        .route("/", get(index_handler))
        .route("/phone", get(phone_handler))
        .route("/ws", get(ws_handler))
        .route("/api/info", get(info_handler))
        .route("/qr.svg", get(qr_handler))
        .fallback_service(serve_static)
        .layer(CorsLayer::permissive())
        .with_state(state)
}

/// Boot the TLS relay on `0.0.0.0:port`. HTTPS/WSS is mandatory because mobile
/// browsers only expose `getUserMedia` in a secure context.
pub async fn run(port: u16, static_dir: PathBuf) -> std::io::Result<()> {
    let state = AppState {
        sessions: Sessions::new(),
        static_dir,
        port,
    };

    let (cert_pem, key_pem) =
        tls::self_signed_cert().map_err(|e| std::io::Error::new(std::io::ErrorKind::Other, e))?;
    let config = RustlsConfig::from_pem(cert_pem.into_bytes(), key_pem.into_bytes()).await?;

    let addr = SocketAddr::from(([0, 0, 0, 0], port));
    tracing::info!("relay listening on https://{addr}");

    axum_server::bind_rustls(addr, config)
        .serve(router(state).into_make_service())
        .await
}

// ── HTTP handlers ───────────────────────────────────────────────────────────

async fn index_handler(State(state): State<AppState>) -> impl IntoResponse {
    serve_index_or(&state.static_dir, LANDING_PAGE).await
}

async fn phone_handler(State(state): State<AppState>) -> impl IntoResponse {
    // The real phone UI is a route inside the SPA; when the SPA exists we serve
    // its index and let client-side routing render `/phone`. Until then we show
    // the built-in placeholder so the route (and TLS) are verifiable in Phase 1.
    serve_index_or(&state.static_dir, PHONE_PLACEHOLDER).await
}

/// Pairing info for the desktop UI: the LAN URL the phone should open.
async fn info_handler(State(state): State<AppState>) -> impl IntoResponse {
    let ip = crate::net::lan_ip().map(|i| i.to_string());
    let phone_url = ip
        .as_ref()
        .map(|ip| format!("https://{ip}:{}/phone", state.port));
    axum::Json(serde_json::json!({
        "lanIp": ip,
        "port": state.port,
        "phoneUrl": phone_url,
        "clients": state.sessions.count(),
    }))
}

/// QR code (SVG) of the phone pairing URL, for scanning from the desktop.
async fn qr_handler(State(state): State<AppState>) -> impl IntoResponse {
    let url = crate::net::lan_ip()
        .map(|ip| format!("https://{ip}:{}/phone", state.port))
        .unwrap_or_else(|| format!("https://localhost:{}/phone", state.port));
    let svg = crate::net::qr_svg(&url);
    (
        [(axum::http::header::CONTENT_TYPE, "image/svg+xml")],
        svg,
    )
}

/// Serve `static_dir/index.html` if present, otherwise the provided fallback.
async fn serve_index_or(static_dir: &Path, fallback: &'static str) -> axum::response::Response {
    let index = static_dir.join("index.html");
    if let Ok(html) = tokio::fs::read_to_string(&index).await {
        return Html(html).into_response();
    }
    Html(fallback).into_response()
}

// ── WebSocket relay ─────────────────────────────────────────────────────────

async fn ws_handler(ws: WebSocketUpgrade, State(state): State<AppState>) -> impl IntoResponse {
    ws.on_upgrade(move |socket| handle_socket(socket, state.sessions))
}

async fn handle_socket(socket: WebSocket, sessions: Sessions) {
    let id = Uuid::new_v4();
    let (mut sink, mut stream) = socket.split();

    // Outbound channel: anything pushed here is written to this client's sink.
    let (tx, mut rx) = tokio::sync::mpsc::unbounded_channel::<Message>();
    sessions.add(id, tx);

    // Writer task: drain the channel into the socket.
    let writer = tokio::spawn(async move {
        while let Some(msg) = rx.recv().await {
            if sink.send(msg).await.is_err() {
                break;
            }
        }
    });

    // Reader loop: relay every text/binary frame to the other clients.
    while let Some(Ok(msg)) = stream.next().await {
        match msg {
            Message::Text(_) | Message::Binary(_) => sessions.broadcast_except(&id, msg),
            Message::Close(_) => break,
            _ => {} // ping/pong handled by axum
        }
    }

    sessions.remove(&id);
    writer.abort();
}

/// Resolve the default static dir relative to the working directory.
pub fn default_static_dir() -> PathBuf {
    for c in ["dist", "../dist", "public"] {
        let p = Path::new(c);
        if p.exists() {
            return p.to_path_buf();
        }
    }
    PathBuf::from("dist")
}

// ── Built-in fallback pages (only used before the SPA is built) ──────────────

const LANDING_PAGE: &str = r#"<!doctype html>
<html><head><meta charset="utf-8"><title>mocap-rs relay</title>
<meta name="viewport" content="width=device-width,initial-scale=1">
<style>body{font-family:ui-sans-serif,system-ui,sans-serif;background:#0d0f14;color:#e6e6e6;
display:flex;min-height:100vh;align-items:center;justify-content:center;margin:0}
.card{max-width:30rem;padding:2rem;background:#161a22;border:1px solid #232838;border-radius:14px}
a{color:#7dd3fc}code{background:#0d0f14;padding:.1rem .35rem;border-radius:6px}</style></head>
<body><div class="card"><h1>mocap-rs relay is running</h1>
<p>This is the WebSocket relay + static file server.</p>
<ul><li>WebSocket: <code>/ws</code></li><li>Phone page: <a href="/phone">/phone</a></li></ul>
<p>Open the phone page on your phone to start streaming landmarks.</p></div></body></html>"#;

const PHONE_PLACEHOLDER: &str = r#"<!doctype html>
<html><head><meta charset="utf-8"><title>mocap-rs phone</title>
<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">
<style>body{font-family:ui-sans-serif,system-ui,sans-serif;background:#0d0f14;color:#e6e6e6;
display:flex;min-height:100vh;align-items:center;justify-content:center;margin:0;text-align:center}
.card{max-width:24rem;padding:2rem}</style></head>
<body><div class="card"><h1>📱 Phone capture</h1>
<p>The MediaPipe capture UI is built in Phase 3.</p>
<p>This placeholder confirms the <code>/phone</code> route and TLS work.</p></div></body></html>"#;
