import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import {
  Play,
  Star,
  Code2,
  ArrowRight,
  ScanFace,
  Hand,
  PersonStanding,
  Eye,
  ShieldCheck,
  Cpu,
  WandSparkles,
} from "lucide-react";

const GITHUB_URL = "https://github.com/Andrew-Velox/mocap-rs";

const FEATURES = [
  {
    icon: ScanFace,
    title: "Face & eye gaze",
    body: "478-point face mesh drives blinks, visemes and where the avatar looks.",
  },
  {
    icon: Hand,
    title: "Per-finger hands",
    body: "Full hand and finger articulation, mapped cleanly onto the VRM rig.",
  },
  {
    icon: PersonStanding,
    title: "Full-body pose",
    body: "Arms, torso and legs with foot grounding and an upright-lock option.",
  },
  {
    icon: Cpu,
    title: "Runs on your CPU",
    body: "No discrete GPU required. Smooth, real-time tracking on modest hardware.",
  },
  {
    icon: ShieldCheck,
    title: "100% on-device",
    body: "Your camera never leaves the browser. Nothing is uploaded, ever.",
  },
  {
    icon: WandSparkles,
    title: "Calibrate & tune",
    body: "Neutral-pose calibration, live responsiveness, and OBS-ready backgrounds.",
  },
];

const fadeUp = {
  hidden: { opacity: 0, y: 22 },
  show: (i: number) => ({
    opacity: 1,
    y: 0,
    transition: { type: "spring" as const, stiffness: 240, damping: 26, delay: i * 0.06 },
  }),
};

export function Landing() {
  return (
    <div className="landing">
      <nav className="landing-nav">
        <span className="brand">
          <span className="brand-mark">
            <PersonStanding size={15} />
          </span>
          mocap-rs
        </span>
        <div className="nav-right">
          <a className="nav-link" href={GITHUB_URL} target="_blank" rel="noreferrer">
            <Code2 size={16} /> GitHub
          </a>
          <Link className="btn primary" to="/studio">
            Launch Studio <ArrowRight size={15} />
          </Link>
        </div>
      </nav>

      <main className="landing-hero">
        <motion.div initial="hidden" animate="show" className="hero">
          <motion.div className="hero-badge" variants={fadeUp} custom={0}>
            <ShieldCheck size={13} /> on-device · offline · no GPU
          </motion.div>

          <motion.h1 variants={fadeUp} custom={1}>
            Real-time motion capture,
            <br />
            <span className="hero-accent">right in your browser.</span>
          </motion.h1>

          <motion.p variants={fadeUp} custom={2}>
            Turn your webcam into a full-body mocap rig and drive a 3D VRM avatar —
            face, hands and body. No installs, no cloud.
          </motion.p>

          <motion.div className="hero-cta" variants={fadeUp} custom={3}>
            <Link className="start-btn" to="/studio">
              <Play size={18} /> Launch Studio
            </Link>
            <a className="btn ghost lg" href={GITHUB_URL} target="_blank" rel="noreferrer">
              <Star size={16} /> Star on GitHub
            </a>
          </motion.div>

          <motion.div className="hero-chips" variants={fadeUp} custom={4}>
            <span className="chip">
              <Eye size={13} /> eye gaze
            </span>
            <span className="chip">
              <Hand size={13} /> finger tracking
            </span>
            <span className="chip">
              <PersonStanding size={13} /> full body
            </span>
          </motion.div>
        </motion.div>
      </main>

      <section className="features">
        <div className="feature-grid">
          {FEATURES.map((f, i) => (
            <motion.div
              className="feature-card"
              key={f.title}
              initial={{ opacity: 0, y: 18 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-40px" }}
              transition={{ type: "spring", stiffness: 240, damping: 26, delay: (i % 3) * 0.05 }}
            >
              <span className="feature-icon">
                <f.icon size={18} />
              </span>
              <h3>{f.title}</h3>
              <p>{f.body}</p>
            </motion.div>
          ))}
        </div>
      </section>

      <footer className="landing-footer">
        <div className="footer-brand">
          <span className="brand">
            <span className="brand-mark">
              <PersonStanding size={15} />
            </span>
            mocap-rs
          </span>
          <p>Real-time, on-device motion capture for VRM avatars.</p>
        </div>
        <div className="footer-links">
          <a href={GITHUB_URL} target="_blank" rel="noreferrer">
            <Code2 size={18} />
          </a>
        </div>
        <div className="footer-copy">© {new Date().getFullYear()} mocap-rs · MIT</div>
      </footer>
    </div>
  );
}
