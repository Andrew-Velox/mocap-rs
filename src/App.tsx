import { BrowserRouter, Routes, Route } from "react-router-dom";
import { Desktop } from "./pages/Desktop";
import { Phone } from "./pages/Phone";

// Two entry points, one SPA:
//   /        → Desktop: renders the VRM avatar (runs in the Tauri webview)
//   /phone   → Phone: camera + MediaPipe + WebSocket sender (runs on the phone)
export function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Desktop />} />
        <Route path="/phone" element={<Phone />} />
      </Routes>
    </BrowserRouter>
  );
}
