import { lazy, Suspense } from "react";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { Landing } from "./pages/Landing";

// Gallery is light (no three.js); Studio/Desktop/Phone are heavy (three.js, VRM,
// kalidokit) and code-split so the 3D bundle only loads after the user picks an
// avatar / enters a capture page.
const Gallery = lazy(() => import("./pages/Gallery").then((m) => ({ default: m.Gallery })));
const Studio = lazy(() => import("./pages/Studio").then((m) => ({ default: m.Studio })));
const Desktop = lazy(() => import("./pages/Desktop").then((m) => ({ default: m.Desktop })));
const Phone = lazy(() => import("./pages/Phone").then((m) => ({ default: m.Phone })));

// Standalone (web) build: home is the marketing landing. Relay build: home is
// the avatar viewer.
const standalone = import.meta.env.VITE_STANDALONE === "1";

function RouteLoading() {
  return (
    <div className="flex items-center justify-center h-screen bg-bg">
      <div className="w-[3.2rem] h-[3.2rem] rounded-full border-[3px] border-surface-3 border-t-accent animate-[spin_0.9s_linear_infinite]" />
    </div>
  );
}

export function App() {
  return (
    <BrowserRouter basename={import.meta.env.BASE_URL}>
      <Suspense fallback={<RouteLoading />}>
        <Routes>
          <Route path="/" element={standalone ? <Landing /> : <Desktop />} />
          <Route path="/studio" element={<Gallery />} />
          <Route path="/studio/live" element={<Studio />} />
          <Route path="/desktop" element={<Desktop />} />
          <Route path="/phone" element={<Phone />} />
        </Routes>
      </Suspense>
    </BrowserRouter>
  );
}
