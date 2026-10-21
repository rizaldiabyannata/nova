//! Window placement the webview cannot do itself: the notch hangs from the top-centre of the primary monitor.

use tauri::{PhysicalPosition, Runtime, WebviewWindow};

/// Wayland compositors ignore client-set positions, and GNOME has no layer-shell,
/// so on Wayland we run through XWayland where `set_position` is honoured.
/// Must run before GTK starts. Set GDK_BACKEND yourself to opt out.
// ponytail: XWayland everywhere; add gtk-layer-shell for KDE/Hyprland/Sway if native Wayland matters there.
pub fn prefer_xwayland() {
    let wayland = std::env::var("XDG_SESSION_TYPE").is_ok_and(|v| v == "wayland");
    if wayland && std::env::var_os("GDK_BACKEND").is_none() {
        std::env::set_var("GDK_BACKEND", "x11");
    }
}

/// A rectangle in logical (CSS) pixels, relative to the window.
#[derive(serde::Deserialize)]
pub struct Rect {
    x: i32,
    y: i32,
    width: i32,
    height: i32,
}

/// Limits mouse input to `rects`; clicks anywhere else fall through the transparent window to what is below.
#[cfg(target_os = "linux")]
pub fn set_hit_region<R: Runtime>(window: &WebviewWindow<R>, rects: &[Rect]) -> tauri::Result<()> {
    use gtk::{cairo, prelude::WidgetExt};
    let rects: Vec<_> = rects.iter().map(|r| cairo::RectangleInt::new(r.x, r.y, r.width, r.height)).collect();
    window.gtk_window()?.input_shape_combine_region(Some(&cairo::Region::create_rectangles(&rects)));
    Ok(())
}

/// Emits `pointer-left` when the pointer leaves the window's hit region. XWayland sends that leave with the last
/// position inside the notch (Wayland leaves carry none), so the page never sees the pointer go and hover sticks.
#[cfg(target_os = "linux")]
pub fn watch_pointer_leave<R: Runtime>(window: &WebviewWindow<R>) -> tauri::Result<()> {
    use gtk::{gdk, glib, prelude::*};
    use tauri::Emitter;
    let gtk_window = window.gtk_window()?;
    gtk_window.add_events(gdk::EventMask::LEAVE_NOTIFY_MASK);
    let window = window.clone();
    gtk_window.connect_leave_notify_event(move |_, e| {
        // Inferior: moved onto a child widget. Grab modes: a popup (select, colour picker) took the pointer.
        if e.mode() == gdk::CrossingMode::Normal && e.detail() != gdk::NotifyType::Inferior {
            let _ = window.emit("pointer-left", ());
        }
        glib::Propagation::Proceed
    });
    Ok(())
}

#[cfg(not(target_os = "linux"))]
pub fn watch_pointer_leave<R: Runtime>(_window: &WebviewWindow<R>) -> tauri::Result<()> {
    Ok(())
}

/// Stops touchpad pinch from zooming the page. WebKitGTK zooms natively before the page sees the gesture,
/// so CSS/JS cannot prevent it. A zoom gesture on the window runs in the capture phase, before WebKit's,
/// and claiming the pinch there denies it to WebKit.
#[cfg(target_os = "linux")]
pub fn block_pinch_zoom<R: Runtime>(window: &WebviewWindow<R>) -> tauri::Result<()> {
    use gtk::prelude::*;
    let gesture = gtk::GestureZoom::new(&window.gtk_window()?);
    gesture.set_propagation_phase(gtk::PropagationPhase::Capture);
    gesture.connect_begin(|g, _| {
        g.set_state(gtk::EventSequenceState::Claimed);
    });
    // GTK3 widgets do not own their gestures; this one must live as long as the window, i.e. the app.
    std::mem::forget(gesture);
    Ok(())
}

#[cfg(not(target_os = "linux"))]
pub fn block_pinch_zoom<R: Runtime>(_window: &WebviewWindow<R>) -> tauri::Result<()> {
    Ok(())
}

// ponytail: no click-through on Windows/macOS yet; their adapters come with M6.
#[cfg(not(target_os = "linux"))]
pub fn set_hit_region<R: Runtime>(_window: &WebviewWindow<R>, _rects: &[Rect]) -> tauri::Result<()> {
    Ok(())
}

/// Moves the window to the top edge, centred on the primary monitor (or the current one if there is no primary).
pub fn pin_top_center<R: Runtime>(window: &WebviewWindow<R>) -> tauri::Result<()> {
    let Some(monitor) = window.primary_monitor()?.or(window.current_monitor()?) else {
        return Ok(());
    };
    let origin = monitor.position();
    let width = window.outer_size()?.width as i32;
    let x = origin.x + (monitor.size().width as i32 - width) / 2;
    // Skip no-op moves: on X11 every move echoes back as a Resized event, which would re-pin forever.
    if window.outer_position()?.x == x {
        return Ok(());
    }
    window.set_position(PhysicalPosition::new(x, origin.y))
}
