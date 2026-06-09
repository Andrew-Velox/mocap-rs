//! Connected-client registry for the WebSocket relay.
//!
//! Every WebSocket connection (a phone publishing landmarks, or a desktop
//! consuming them) gets a [`Uuid`] and an [`mpsc::UnboundedSender`] that feeds
//! its outbound socket task. A frame received from one client is broadcast to
//! every *other* client, which is all the relay has to do.

use std::collections::HashMap;
use std::sync::{Arc, Mutex};

use axum::extract::ws::Message;
use uuid::Uuid;

/// Per-client outbound channel. The socket's writer task drains this and
/// forwards each message to the WebSocket sink.
pub type ClientTx = tokio::sync::mpsc::UnboundedSender<Message>;

/// Thread-safe registry of connected clients, cheap to clone (shared `Arc`).
#[derive(Clone, Default)]
pub struct Sessions {
    inner: Arc<Mutex<HashMap<Uuid, ClientTx>>>,
}

impl Sessions {
    pub fn new() -> Self {
        Self::default()
    }

    /// Register a client and return its id.
    pub fn add(&self, id: Uuid, tx: ClientTx) {
        self.inner.lock().unwrap().insert(id, tx);
        tracing::info!(%id, count = self.count(), "client connected");
    }

    /// Remove a client (on disconnect).
    pub fn remove(&self, id: &Uuid) {
        self.inner.lock().unwrap().remove(id);
        tracing::info!(%id, count = self.count(), "client disconnected");
    }

    /// Number of currently connected clients.
    pub fn count(&self) -> usize {
        self.inner.lock().unwrap().len()
    }

    /// Forward `msg` to every client except `from`. Dead senders (receiver
    /// dropped) are pruned so the map stays clean.
    pub fn broadcast_except(&self, from: &Uuid, msg: Message) {
        let mut guard = self.inner.lock().unwrap();
        let mut dead: Vec<Uuid> = Vec::new();
        for (id, tx) in guard.iter() {
            if id == from {
                continue;
            }
            if tx.send(msg.clone()).is_err() {
                dead.push(*id);
            }
        }
        for id in dead {
            guard.remove(&id);
        }
    }
}
