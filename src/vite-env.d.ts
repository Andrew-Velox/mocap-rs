/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** "1" in the standalone (no-relay) build — see App.tsx routing. */
  readonly VITE_STANDALONE?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
