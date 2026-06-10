import { lazy, Suspense } from "react";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { Landing } from "./pages/Landing";

// Heavy routes (three.js, VRM, kalidokit) are code-split so the landing page
// stays light and loads instantly — the 3D bundle is only fetched on navigation.
const Studio = lazy(() => import("./pages/Studio").then((m) => ({ default: m.Studio })));
const Desktop = lazy(() => import("./pages/Desktop").then((m) => ({ default: m.Desktop })));
const Phone = lazy(() => import("./pages/Phone").then((m) => ({ default: m.Phone })));

// Standalone (web) build: home is the marketing landing. Relay build: home is
// the avatar viewer.
const standalone = import.meta.env.VITE_STANDALONE === "1";

function RouteLoading() {
  return (
    <div className="route-loading">
      <div className="loader-ring" />
    </div>
  );
}

export function App() {
  return (
    <BrowserRouter basename={import.meta.env.BASE_URL}>
      <Suspense fallback={<RouteLoading />}>
        <Routes>
          <Route path="/" element={standalone ? <Landing /> : <Desktop />} />
          <Route path="/studio" element={<Studio />} />
          <Route path="/desktop" element={<Desktop />} />
          <Route path="/phone" element={<Phone />} />
        </Routes>
      </Suspense>
    </BrowserRouter>
  );
}
