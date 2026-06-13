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
    <div className="h-screen overflow-y-auto bg-bg bg-radial-landing-hero">
      <nav className="sticky top-0 z-10 flex items-center justify-between gap-4 px-4 sm:px-8 lg:px-12 py-[0.9rem] bg-bg border-b border-border-line">
        <span className="inline-flex items-center gap-[0.55rem] font-bold text-[0.95rem] tracking-[-0.01em] text-text">
          <span className="inline-flex items-center justify-center w-7 h-7 rounded-[9px] bg-dark text-accent-ink">
            <img src="icons/mocap.png" alt="icon" width="24" height="24" />
          </span>
          mocap-rs
        </span>
        <div className="flex items-center gap-[0.85rem]">
          <a className="inline-flex items-center gap-[0.4rem] text-muted no-underline text-[0.85rem] font-medium hover:text-text" href={GITHUB_URL} target="_blank" rel="noreferrer">
            <Code2 size={16} /> GitHub
          </a>
          <Link className="inline-flex items-center justify-center gap-[0.45rem] bg-accent border border-accent text-accent-ink rounded-full px-4 py-[0.45rem] text-[0.8rem] font-semibold tracking-[0.01em] cursor-pointer no-underline hover:bg-accent-strong hover:border-accent-strong" to="/studio">
            Launch Studio <ArrowRight size={15} />
          </Link>
        </div>
      </nav>

      <main className="flex justify-center px-6 py-[clamp(3rem,11vh,7rem)] pb-[clamp(2.5rem,7vh,5rem)]">
        <motion.div initial="hidden" animate="show" className="flex flex-col items-center gap-[1.1rem] text-center px-8 max-w-[34rem]">
          <motion.div className="inline-flex items-center gap-[0.4rem] px-[0.85rem] py-[0.32rem] rounded-full border border-border-strong bg-surface text-muted text-[0.74rem] font-semibold tracking-[0.02em]" variants={fadeUp} custom={0}>
            <ShieldCheck size={13} className="text-good" /> on-device · offline · no GPU
          </motion.div>

          <motion.h1 className="m-0 text-[clamp(1.2rem,6.5vw,3rem)] leading-[1.08] font-extrabold tracking-[-0.035em] text-text whitespace-nowrap" variants={fadeUp} custom={1}>
            Real-time motion capture, <br />
            <span className="text-accent">right in your browser.</span>
          </motion.h1>

          <motion.p className="m-0 text-muted text-base leading-[1.6] max-w-[26rem]" variants={fadeUp} custom={2}>
            Turn your webcam into a full-body mocap rig and drive a 3D VRM avatar —
            face, hands and body. No installs, no cloud.
          </motion.p>

          <motion.div className="flex flex-wrap justify-center gap-3 mt-1" variants={fadeUp} custom={3}>
            <Link className="inline-flex items-center gap-[0.55rem] mt-1 px-10 py-[0.95rem] text-[1.02rem] font-bold tracking-[0.01em] text-accent-ink bg-accent border-0 rounded-full cursor-pointer touch-manipulation no-underline shadow-[0_14px_36px_var(--color-shadow)] hover:bg-accent-strong" to="/studio">
              <Play size={18} /> Launch Studio
            </Link>
            <a className="inline-flex items-center justify-center gap-[0.45rem] bg-surface text-muted border border-border-strong rounded-full px-6 py-[0.95rem] text-[0.95rem] font-semibold tracking-[0.01em] cursor-pointer no-underline hover:bg-surface-3 hover:border-accent" href={GITHUB_URL} target="_blank" rel="noreferrer">
              <Star size={16} /> Star on GitHub
            </a>
          </motion.div>

          <motion.div className="flex flex-wrap justify-center gap-2 mt-1" variants={fadeUp} custom={4}>
            <span className="inline-flex items-center gap-[0.4rem] px-[0.8rem] py-[0.34rem] rounded-full bg-surface-2 border border-border-line text-muted text-[0.76rem] font-medium">
              <Eye size={13} className="text-accent" /> eye gaze
            </span>
            <span className="inline-flex items-center gap-[0.4rem] px-[0.8rem] py-[0.34rem] rounded-full bg-surface-2 border border-border-line text-muted text-[0.76rem] font-medium">
              <Hand size={13} className="text-accent" /> finger tracking
            </span>
            <span className="inline-flex items-center gap-[0.4rem] px-[0.8rem] py-[0.34rem] rounded-full bg-surface-2 border border-border-line text-muted text-[0.76rem] font-medium">
              <PersonStanding size={13} className="text-accent" /> full body
            </span>
          </motion.div>
        </motion.div>
      </main>

      <section className="px-4 sm:px-8 lg:px-12 py-4 pb-16">
        <div className="max-w-5xl mx-auto grid grid-cols-[repeat(auto-fit,minmax(15rem,1fr))] gap-4">
          {FEATURES.map((f, i) => (
            <motion.div
              className="p-[1.4rem] bg-surface border border-border-line rounded hover:border-border-strong"
              key={f.title}
              initial={{ opacity: 0, y: 18 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-40px" }}
              transition={{ type: "spring", stiffness: 240, damping: 26, delay: (i % 3) * 0.05 }}
            >
              <span className="inline-flex items-center justify-center w-10 h-10 rounded-[11px] bg-accent-soft text-accent mb-[0.9rem]">
                <f.icon size={18} />
              </span>
              <h3 className="mt-0 mb-1 text-base font-bold tracking-[-0.01em]">{f.title}</h3>
              <p className="m-0 text-muted text-[0.88rem] leading-[1.55]">{f.body}</p>
            </motion.div>
          ))}
        </div>
      </section>

      <footer className="border-t border-border-line bg-surface">
        <div className="max-w-5xl mx-auto flex flex-wrap justify-between gap-10 px-4 sm:px-8 lg:px-12 pt-12 pb-8">
          <div className="flex flex-col gap-3 max-w-[18rem]">
            <span className="inline-flex items-center gap-[0.55rem] font-bold text-[0.95rem] tracking-[-0.01em] text-text">
              <span className="inline-flex items-center justify-center w-7 h-7 rounded-[9px] bg-black text-accent-ink">
                <img src="icons/mocap.png" alt="icon" width="24" height="24" />
              </span>
              mocap-rs
            </span>
            <p className="m-0 text-muted text-[0.85rem] leading-[1.55]">Real-time, on-device motion capture for VRM avatars — open source.</p>
            <div className="flex gap-[0.55rem]">
              <a href={GITHUB_URL} target="_blank" rel="noreferrer" aria-label="GitHub" className="inline-flex items-center justify-center w-[2.3rem] h-[2.3rem] rounded-[10px] border border-border-line text-muted hover:text-accent hover:border-accent">
                <Code2 size={18} />
              </a>
            </div>
          </div>

          <div className="flex flex-wrap gap-10 xl:gap-14">
            <div className="flex flex-col gap-[0.7rem]">
              <h4 className="mt-0 mb-[0.2rem] text-[0.72rem] uppercase tracking-[0.08em] text-faint font-bold">Product</h4>
              <Link to="/studio" className="text-muted no-underline text-[0.88rem] hover:text-text">Web Studio</Link>
              <a href="#features" className="text-muted no-underline text-[0.88rem] hover:text-text">Features</a>
            </div>
            <div className="flex flex-col gap-[0.7rem]">
              <h4 className="mt-0 mb-[0.2rem] text-[0.72rem] uppercase tracking-[0.08em] text-faint font-bold">Resources</h4>
              <a href={GITHUB_URL} target="_blank" rel="noreferrer" className="text-muted no-underline text-[0.88rem] hover:text-text">
                GitHub
              </a>
              <a href={`${GITHUB_URL}#readme`} target="_blank" rel="noreferrer" className="text-muted no-underline text-[0.88rem] hover:text-text">
                Docs
              </a>
              <a href={`${GITHUB_URL}/issues`} target="_blank" rel="noreferrer" className="text-muted no-underline text-[0.88rem] hover:text-text">
                Issues
              </a>
            </div>
            <div className="flex flex-col gap-[0.7rem]">
              <h4 className="mt-0 mb-[0.2rem] text-[0.72rem] uppercase tracking-[0.08em] text-faint font-bold">Project</h4>
              <a href={`${GITHUB_URL}/blob/main/LICENSE`} target="_blank" rel="noreferrer" className="text-muted no-underline text-[0.88rem] hover:text-text">
                License
              </a>
              <a href={`${GITHUB_URL}/stargazers`} target="_blank" rel="noreferrer" className="text-muted no-underline text-[0.88rem] hover:text-text">
                Star us
              </a>
            </div>
          </div>
        </div>

        <div className="max-w-5xl mx-auto flex justify-between gap-4 px-4 sm:px-8 lg:px-12 py-5 border-t border-border-line text-faint text-[0.8rem]">
          <span>© {new Date().getFullYear()} mocap-rs</span>
          <span>MIT License</span>
        </div>
      </footer>
    </div>
  );
}
