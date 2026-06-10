import { motion } from "framer-motion";

/** Centered avatar download indicator (the VRM is the heavy asset). */
export function AvatarLoader({ progress }: { progress: number }) {
  const pct = Math.round(Math.min(1, Math.max(0, progress)) * 100);
  return (
    <motion.div
      className="avatar-loader"
      initial={{ opacity: 0, scale: 0.96 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0 }}
    >
      <div className="avatar-loader-pct">
        {pct}
        <span>%</span>
      </div>
      <div className="avatar-loader-bar">
        <motion.div
          className="avatar-loader-fill"
          animate={{ width: `${pct}%` }}
          transition={{ ease: "easeOut", duration: 0.2 }}
        />
      </div>
      <div className="avatar-loader-label">Loading avatar…</div>
    </motion.div>
  );
}
