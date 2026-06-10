import { BrowserRouter, Routes, Route } from "react-router-dom";
import { Desktop } from "./pages/Desktop";
import { Phone } from "./pages/Phone";
import { Studio } from "./pages/Studio";

// In a standalone deploy (e.g. GitHub Pages, no relay) the home route is the
// all-in-one Studio. The relay build keeps "/" as the avatar viewer.
const standalone = import.meta.env.VITE_STANDALONE === "1";

/**
 * Routes:
 *   /        → Studio (standalone build) or Desktop avatar viewer (relay build)
 *   /studio  → Studio: camera + MediaPipe + avatar in one tab (no relay)
 *   /desktop → Desktop avatar viewer (relay)
 *   /phone   → Phone capture (relay)
 */
export function App() {
  return (
    <BrowserRouter basename={import.meta.env.BASE_URL}>
      <Routes>
        <Route path="/" element={standalone ? <Studio /> : <Desktop />} />
        <Route path="/studio" element={<Studio />} />
        <Route path="/desktop" element={<Desktop />} />
        <Route path="/phone" element={<Phone />} />
      </Routes>
    </BrowserRouter>
  );
}
