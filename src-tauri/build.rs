fn main() {
    // Tauri's codegen only runs for the GUI build; the default headless server
    // build needs no system GUI libraries.
    #[cfg(feature = "tauri-app")]
    tauri_build::build();
}
