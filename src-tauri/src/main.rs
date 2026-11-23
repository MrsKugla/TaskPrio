// Niente console in release su Windows.
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

fn main() {
    taskprio_lib::run()
}
