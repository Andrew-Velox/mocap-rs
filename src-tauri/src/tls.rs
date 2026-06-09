//! Self-signed TLS certificate generation via `rcgen`.
//!
//! Mobile browsers refuse `getUserMedia` (camera) outside a secure context, so
//! the relay must speak HTTPS/WSS even on the LAN. We generate a throwaway
//! self-signed cert covering `localhost` and the machine's LAN IP at startup.
//! The phone will show a one-time "untrusted certificate" warning to accept.

use rcgen::{CertifiedKey, Error as RcgenError};

/// Generate a self-signed certificate + private key as PEM strings.
///
/// Subject Alternative Names include `localhost`, loopback, and the detected
/// LAN IP so the same cert is valid however the phone reaches the desktop.
pub fn self_signed_cert() -> Result<(String, String), RcgenError> {
    let mut sans = vec!["localhost".to_string(), "127.0.0.1".to_string()];
    if let Ok(ip) = local_ip_address::local_ip() {
        sans.push(ip.to_string());
    }

    let CertifiedKey { cert, key_pair } = rcgen::generate_simple_self_signed(sans)?;
    Ok((cert.pem(), key_pair.serialize_pem()))
}
