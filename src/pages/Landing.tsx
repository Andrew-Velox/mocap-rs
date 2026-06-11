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
            {/* <PersonStanding size={15} /> */}
            <img src="icons/mocap.png" alt="icon" width="24" height="24" />
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
        <div className="footer-top">
          <div className="footer-brand">
            <span className="brand">
              <span className="brand-mark">
                {/* <PersonStanding size={15} /> */}
                <img src="icons/mocap.png" alt="icon" width="24" height="24" />
              </span>
              mocap-rs
            </span>
            <p>Real-time, on-device motion capture for VRM avatars — open source.</p>
            <div className="footer-social">
              <a href={GITHUB_URL} target="_blank" rel="noreferrer" aria-label="GitHub">
                <Code2 size={18} />
              </a>
            </div>
          </div>

          <div className="footer-cols">
            <div className="footer-col">
              <h4>Product</h4>
              <Link to="/studio">Web Studio</Link>
              <a href="#features">Features</a>
            </div>
            <div className="footer-col">
              <h4>Resources</h4>
              <a href={GITHUB_URL} target="_blank" rel="noreferrer">
                GitHub
              </a>
              <a href={`${GITHUB_URL}#readme`} target="_blank" rel="noreferrer">
                Docs
              </a>
              <a href={`${GITHUB_URL}/issues`} target="_blank" rel="noreferrer">
                Issues
              </a>
            </div>
            <div className="footer-col">
              <h4>Project</h4>
              <a href={`${GITHUB_URL}/blob/main/LICENSE`} target="_blank" rel="noreferrer">
                License
              </a>
              <a href={`${GITHUB_URL}/stargazers`} target="_blank" rel="noreferrer">
                Star us
              </a>
            </div>
          </div>
        </div>

        <div className="footer-bottom">
          <span>© {new Date().getFullYear()} mocap-rs</span>
          <span>MIT License</span>
        </div>
      </footer>
    </div>
  );
}
