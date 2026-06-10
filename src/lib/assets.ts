// Resolve a public asset path against the app's base URL. Locally the base is
// "/" (served by the Rust relay or Vite); on GitHub Pages it's "/<repo>/".
// Always pass a path WITHOUT a leading slash, e.g. asset("models/x.vrm").
export function asset(path: string): string {
  return import.meta.env.BASE_URL + path.replace(/^\//, "");
}
