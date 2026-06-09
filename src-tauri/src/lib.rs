//! mocap-rs relay library.
//!
//! The desktop app (Tauri, added in Phase 2) and the standalone dev binary
//! both spawn the same [`server::run`]. The server is *only* a relay + static
//! file server — MediaPipe inference happens exclusively in the phone browser.

pub mod net;
pub mod server;
pub mod session;
pub mod tls;

/// Default relay port. HTTPS + WSS are served from the same socket.
pub const DEFAULT_PORT: u16 = 8080;
