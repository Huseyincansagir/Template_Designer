// Prevents a console window from appearing alongside the release GUI build.
//
// This attribute must live on the BINARY crate. On the library crate it has no
// effect on linking, so the produced .exe was linking as a console application
// and would have shown a console window next to the window in release builds.
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

fn main() {
    template_designer_lib::run();
}
