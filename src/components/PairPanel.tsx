import { useEffect, useState } from "react";

interface RelayInfo {
  lanIp: string | null;
  port: number;
  phoneUrl: string | null;
  clients: number;
}

// The relay (and its self-signed cert) live on port 8080, which is a different
// origin from the SPA in dev — so address it absolutely.
const RELAY_BASE = `https://${location.hostname || "localhost"}:8080`;

/**
 * "Pair your phone" panel: shows the LAN URL and a scannable QR (rendered by
 * the Rust relay, which is the only side that knows the LAN IP). Collapsible so
 * it stays out of the way once a phone is connected.
 */
export function PairPanel() {
  const [info, setInfo] = useState<RelayInfo | null>(null);
  const [failed, setFailed] = useState(false);
  const [open, setOpen] = useState(true);

  useEffect(() => {
    let cancelled = false;
    const load = () =>
      fetch(`${RELAY_BASE}/api/info`)
        .then((r) => r.json())
        .then((d: RelayInfo) => !cancelled && (setInfo(d), setFailed(false)))
        .catch(() => !cancelled && setFailed(true));
    load();
    const id = window.setInterval(load, 4000);
    return () => {
      cancelled = true;
      window.clearInterval(id);
    };
  }, []);

  if (!open) {
    return (
      <button className="pair-fab" onClick={() => setOpen(true)} title="Pair phone">
        📷
      </button>
    );
  }

  return (
    <div className="pair-panel">
      <div className="pair-head">
        <span>Pair your phone</span>
        <button className="pair-close" onClick={() => setOpen(false)}>
          ×
        </button>
      </div>

      {failed && (
        <p className="pair-hint">
          Couldn’t reach the relay. Open{" "}
          <a href={`${RELAY_BASE}/`} target="_blank" rel="noreferrer">
            {RELAY_BASE}
          </a>{" "}
          once to accept the self-signed certificate, then retry.
        </p>
      )}

      {info?.phoneUrl ? (
        <>
          <img className="pair-qr" src={`${RELAY_BASE}/qr.svg`} alt="Phone pairing QR code" />
          <div className="pair-url">{info.phoneUrl}</div>
          <div className="pair-meta">
            {info.clients} client{info.clients === 1 ? "" : "s"} connected
          </div>
        </>
      ) : (
        !failed && <p className="pair-hint">Detecting LAN address…</p>
      )}
    </div>
  );
}
