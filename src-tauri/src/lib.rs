mod ai;
mod platform;

use std::time::Duration;

use base64::Engine;
use mpris::{FindingError, PlaybackStatus, Player, PlayerFinder};
use serde::Serialize;
use tauri::{Emitter, Manager, WindowEvent};

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct Track {
    title: String,
    artist: String,
    player: String,
    playing: bool,
    can_next: bool,
    can_prev: bool,
    /// Playback position when polled; 0 when the player does not report one.
    position_ms: u64,
    length_ms: u64,
    album: String,
    /// The player's `mpris:artUrl`; changes with the track, so the page knows when to ask `media_art` again.
    art_url: String,
    can_seek: bool,
    /// 0.0–1.0; None when the player does not expose volume.
    volume: Option<f64>,
}

fn active_player() -> Result<Option<Player>, String> {
    match PlayerFinder::new().map_err(|e| e.to_string())?.find_active() {
        Ok(p) => Ok(Some(p)),
        Err(FindingError::NoPlayerFound) => Ok(None),
        Err(e) => Err(e.to_string()),
    }
}

// async(...) runs these on a worker thread, so blocking D-Bus calls never freeze the window.
#[tauri::command(async)]
fn media_now() -> Result<Option<Track>, String> {
    let Some(p) = active_player()? else { return Ok(None) };
    let meta = p.get_metadata().map_err(|e| e.to_string())?;
    Ok(Some(Track {
        title: meta.title().unwrap_or_default().to_string(),
        artist: meta.artists().map(|a| a.join(", ")).unwrap_or_default(),
        player: p.identity().to_string(),
        playing: matches!(p.get_playback_status(), Ok(PlaybackStatus::Playing)),
        can_next: p.can_go_next().unwrap_or(false),
        can_prev: p.can_go_previous().unwrap_or(false),
        position_ms: p.get_position().map(|d| d.as_millis() as u64).unwrap_or(0),
        length_ms: meta.length().map(|d| d.as_millis() as u64).unwrap_or(0),
        album: meta.album_name().unwrap_or_default().to_string(),
        art_url: meta.art_url().unwrap_or_default().to_string(),
        can_seek: p.can_seek().unwrap_or(false),
        volume: p.get_volume().ok(),
    }))
}

#[tauri::command(async)]
fn media_control(action: String, value: Option<f64>) -> Result<(), String> {
    let p = active_player()?.ok_or("No player")?;
    let value = value.filter(|v| v.is_finite()).unwrap_or(0.0);
    match action.as_str() {
        "toggle" => p.play_pause(),
        "next" => p.next(),
        "previous" => p.previous(),
        "seek" => {
            let meta = p.get_metadata().map_err(|e| e.to_string())?;
            let id = meta.track_id().ok_or("Track has no id")?;
            p.set_position(id, &Duration::from_millis(value.max(0.0) as u64))
        }
        "volume" => p.set_volume(value.clamp(0.0, 1.0)),
        _ => return Err(format!("unknown action {action}")),
    }
    .map_err(|e| {
        // Not in media_now: it polls every 2 s and would flood the log.
        log::warn!("media {action} failed: {e}");
        e.to_string()
    })
}

const ART_MAX_BYTES: usize = 5 * 1024 * 1024;

/// The current track's cover as a data URL, so the CSP can keep `img-src 'self' data:`.
/// Takes no path: it only ever reads the URL the active player itself reports.
#[tauri::command]
async fn media_art() -> Result<Option<String>, String> {
    let url = {
        let Some(p) = active_player()? else { return Ok(None) };
        let meta = p.get_metadata().map_err(|e| e.to_string())?;
        match meta.art_url().filter(|u| !u.is_empty()) {
            Some(u) => u.to_string(),
            None => return Ok(None),
        }
    };
    let bytes = if let Some(path) = url.strip_prefix("file://") {
        let path = percent_decode(path);
        if std::fs::metadata(&path).map_err(|e| e.to_string())?.len() > ART_MAX_BYTES as u64 {
            return Err("Cover too large".into());
        }
        std::fs::read(&path).map_err(|e| e.to_string())?
    } else if url.starts_with("https://") {
        let res = reqwest::Client::builder()
            .timeout(Duration::from_secs(5))
            .build()
            .map_err(|e| e.to_string())?
            .get(&url)
            .send()
            .await
            .and_then(|r| r.error_for_status())
            .map_err(|e| e.to_string())?;
        if res.content_length().is_some_and(|n| n > ART_MAX_BYTES as u64) {
            return Err("Cover too large".into());
        }
        res.bytes().await.map_err(|e| e.to_string())?.to_vec()
    } else {
        return Ok(None);
    };
    if bytes.len() > ART_MAX_BYTES {
        return Err("Cover too large".into());
    }
    let mime = image_mime(&bytes).ok_or("Cover is not an image")?;
    Ok(Some(format!("data:{mime};base64,{}", base64::engine::general_purpose::STANDARD.encode(&bytes))))
}

/// Only formats the webview shows; anything else (an SVG, a stray file) is refused.
fn image_mime(b: &[u8]) -> Option<&'static str> {
    if b.starts_with(&[0x89, b'P', b'N', b'G']) {
        Some("image/png")
    } else if b.starts_with(&[0xFF, 0xD8, 0xFF]) {
        Some("image/jpeg")
    } else if b.len() > 12 && &b[..4] == b"RIFF" && &b[8..12] == b"WEBP" {
        Some("image/webp")
    } else {
        None
    }
}

#[derive(Serialize)]
struct ShelfFile {
    path: String,
    name: String,
    size: u64,
    /// Thumbnail data URL for PNG/JPEG/WebP up to ART_MAX_BYTES; None for anything else.
    image: Option<String>,
}

/// A dropped file for the shelf: its name, size and, for images, a thumbnail.
/// Only regular files; a dropped folder is refused, as Open would launch a file manager instead.
#[tauri::command(async)]
fn shelf_file(path: String) -> Result<ShelfFile, String> {
    let meta = std::fs::metadata(&path).map_err(|e| e.to_string())?;
    if !meta.is_file() {
        return Err("Not a file".into());
    }
    let p = std::path::Path::new(&path);
    let name = p.file_name().map(|n| n.to_string_lossy().into_owned()).unwrap_or_else(|| path.clone());
    // The extension only decides whether to read the file at all; image_mime still checks the bytes.
    let looks_image = p
        .extension()
        .is_some_and(|e| ["png", "jpg", "jpeg", "webp"].contains(&e.to_string_lossy().to_lowercase().as_str()));
    let image = (looks_image && meta.len() <= ART_MAX_BYTES as u64)
        .then(|| std::fs::read(&path).ok())
        .flatten()
        .and_then(|b| image_mime(&b).map(|m| format!("data:{m};base64,{}", base64::engine::general_purpose::STANDARD.encode(&b))));
    Ok(ShelfFile { path, name, size: meta.len(), image })
}

fn percent_decode(s: &str) -> String {
    let b = s.as_bytes();
    let hex = |i: usize| b.get(i).and_then(|&c| (c as char).to_digit(16));
    let mut out = Vec::with_capacity(b.len());
    let mut i = 0;
    while i < b.len() {
        if let (b'%', Some(h), Some(l)) = (b[i], hex(i + 1), hex(i + 2)) {
            out.push((h * 16 + l) as u8);
            i += 3;
        } else {
            out.push(b[i]);
            i += 1;
        }
    }
    String::from_utf8_lossy(&out).into_owned()
}

// Sync on purpose: sync commands run on the main thread, where GTK calls must happen.
#[tauri::command]
fn set_hit_region(window: tauri::WebviewWindow, rects: Vec<platform::Rect>) -> Result<(), String> {
    platform::set_hit_region(&window, &rects).map_err(|e| e.to_string())
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    platform::prefer_xwayland();
    tauri::Builder::default()
        // Must be first. A second launch exits here; `nova --toggle` (bound to a desktop shortcut) opens/closes the panel.
        // A shortcut through the desktop works on Wayland too, where an X11 key grab from XWayland would not.
        .plugin(tauri_plugin_single_instance::init(|app, argv, _cwd| {
            if argv.iter().any(|a| a == "--toggle") {
                if let Some(w) = app.get_webview_window("main") {
                    let _ = w.set_focus();
                    let _ = w.emit("toggle-panel", ());
                }
            }
        }))
        .plugin(tauri_plugin_store::Builder::new().build())
        // Stdout and a rotating file in the app log dir (the plugin's default targets).
        .plugin(tauri_plugin_log::Builder::new().level(log::LevelFilter::Info).build())
        .plugin(tauri_plugin_autostart::init(tauri_plugin_autostart::MacosLauncher::LaunchAgent, None))
        .plugin(tauri_plugin_notification::init())
        .plugin(tauri_plugin_clipboard_manager::init())
        .plugin(tauri_plugin_opener::init())
        .invoke_handler(tauri::generate_handler![
            media_now,
            media_control,
            media_art,
            shelf_file,
            set_hit_region,
            ai::ai_set_key,
            ai::ai_has_key,
            ai::ai_usage
        ])
        .setup(|app| {
            if let Some(window) = app.get_webview_window("main") {
                platform::pin_top_center(&window)?;
                platform::watch_pointer_leave(&window)?;
                platform::block_pinch_zoom(&window)?;
            }
            Ok(())
        })
        // Re-pin on resize too: at setup the X11 window has no size yet, so the first pin lands half a width off-centre.
        // ponytail: a resolution change without a scale change or resize leaves the notch where it was.
        .on_window_event(|window, event| {
            if let WindowEvent::Resized(_) | WindowEvent::ScaleFactorChanged { .. } = event {
                if let Some(w) = window.app_handle().get_webview_window(window.label()) {
                    let _ = platform::pin_top_center(&w);
                }
            }
        })
        .run(tauri::generate_context!())
        .expect("error while running Nova");
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn cover_paths_and_types() {
        assert_eq!(percent_decode("/tmp/My%20Cover%2.png%"), "/tmp/My Cover%2.png%");
        assert_eq!(image_mime(&[0x89, b'P', b'N', b'G', 0]), Some("image/png"));
        assert_eq!(image_mime(&[0xFF, 0xD8, 0xFF, 0xE0]), Some("image/jpeg"));
        assert_eq!(image_mime(b"<svg xmlns="), None);
    }
}
