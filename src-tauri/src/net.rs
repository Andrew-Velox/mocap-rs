//! LAN discovery + QR helpers for frictionless phone pairing.

use qrcode::render::{svg, unicode};
use qrcode::QrCode;
use std::net::IpAddr;

/// Best-effort detection of this machine's primary LAN IP.
pub fn lan_ip() -> Option<IpAddr> {
    local_ip_address::local_ip().ok()
}

/// The URL a phone should open to reach the capture page.
pub fn phone_url(ip: IpAddr, port: u16) -> String {
    format!("https://{ip}:{port}/phone")
}

/// Render `data` as a compact, terminal-friendly QR code (unicode half-blocks).
pub fn qr_string(data: &str) -> String {
    match QrCode::new(data) {
        Ok(code) => code
            .render::<unicode::Dense1x2>()
            .dark_color(unicode::Dense1x2::Light)
            .light_color(unicode::Dense1x2::Dark)
            .quiet_zone(true)
            .build(),
        Err(_) => String::new(),
    }
}

/// Render `data` as an SVG QR code (dark-theme colors) for the desktop UI.
pub fn qr_svg(data: &str) -> String {
    match QrCode::new(data) {
        Ok(code) => code
            .render::<svg::Color>()
            .min_dimensions(220, 220)
            .quiet_zone(true)
            .dark_color(svg::Color("#e6e6e6"))
            .light_color(svg::Color("#0d0f14"))
            .build(),
        Err(_) => String::new(),
    }
}

/// Print a friendly startup banner with the phone URL + scannable QR code.
pub fn print_banner(port: u16) {
    let ip = lan_ip();
    println!("\n  mocap-rs relay\n  ─────────────");
    match ip {
        Some(ip) => {
            let url = phone_url(ip, port);
            println!("  Desktop (this machine): https://localhost:{port}/");
            println!("  Phone — open this URL:  {url}\n");
            let qr = qr_string(&url);
            if !qr.is_empty() {
                println!("{qr}");
            }
            println!("  (Accept the self-signed certificate warning on the phone.)\n");
        }
        None => {
            println!("  Could not detect a LAN IP. Connect the phone to the same");
            println!("  network and open https://<desktop-ip>:{port}/phone\n");
        }
    }
}
