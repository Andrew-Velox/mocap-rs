import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import { PersonStanding, ArrowLeft, Play } from "lucide-react";
import { asset } from "../lib/assets";

interface ModelEntry {
  name: string;
  file: string;
  thumb?: string;
}

/**
 * Avatar picker (OpenCut-style grid). Lightweight — no three.js / VRM here.
 * Only the avatar the user selects is downloaded, on the next page.
 */
export function Gallery() {
  const [models, setModels] = useState<ModelEntry[]>([]);

  useEffect(() => {
    let cancelled = false;
    fetch(asset("models/index.json"))
      .then((r) => (r.ok ? r.json() : { models: [] }))
      .then((d: { models?: ModelEntry[] }) => {
        if (!cancelled && Array.isArray(d.models)) setModels(d.models);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div className="gallery">
      <nav className="landing-nav">
        <Link className="brand" to="/" style={{ textDecoration: "none" }}>
          <span className="brand-mark">
            <PersonStanding size={15} />
          </span>
          mocap-rs
        </Link>
        <Link className="nav-link" to="/">
          <ArrowLeft size={16} /> Home
        </Link>
      </nav>

      <main className="gallery-main">
        <div className="gallery-head">
          <h1>Choose an avatar</h1>
          <p>Only the avatar you pick is downloaded — keeps things light.</p>
        </div>

        <div className="gallery-grid">
          {models.map((m, i) => (
            <motion.div
              key={m.file}
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ type: "spring", stiffness: 260, damping: 26, delay: i * 0.05 }}
            >
              <Link
                className="avatar-card"
                to={`/studio/live?avatar=${encodeURIComponent(m.file)}`}
              >
                <div className="avatar-thumb">
                  {m.thumb ? (
                    <img src={asset(`models/${m.thumb}`)} alt={m.name} loading="lazy" />
                  ) : (
                    <PersonStanding size={42} />
                  )}
                  <span className="avatar-play">
                    <Play size={18} />
                  </span>
                </div>
                <div className="avatar-card-body">
                  <span className="avatar-name">{m.name}</span>
                  <span className="avatar-use">Use →</span>
                </div>
              </Link>
            </motion.div>
          ))}

          {models.length === 0 && (
            <div className="gallery-empty">No avatars found in models/index.json.</div>
          )}
        </div>
      </main>
    </div>
  );
}
