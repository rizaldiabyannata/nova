# Nova — Redesign Brief (for Google Stitch / Figma Make)

Attach with this brief: screenshots of each state, plus `Lumi/Lumi AI Companion Mascot Sheet.png` and `Lumi/Lumi's Neon Cosmic Status Bar.png`.

---

## Short prompt (paste this first)

> Redesign "Nova", a Dynamic-Island-style notch for the Ubuntu/GNOME desktop. It hangs from the top edge of the screen,
> merges into the 32px GNOME top bar, and floats over other windows. It is always a near-black hardware-like surface
> (#03040A) with concave "shoulder" curves joining the screen edge, and one user-chosen accent colour (default lavender #C1A7FF).
> Its mascot is Lumi, a white cat head wearing accent-coloured headphones, shown in a round avatar disc.
> Design three states of the same element: Compact (112–220 × 32px, Lumi + clock + one live status),
> Peek on hover (300–390px wide, one feature page below the header, page dots and a settings button), and Expanded
> (same as Peek, pinned open by a click). Feature pages: Music, Lyrics, Agenda, Alarm, Focus timer, Settings.
> Max canvas width 420px. Calm, typographic, no glassmorphism, no gradients on surfaces, no glow.

---

## 1. Product

- **What it is:** a desktop companion notch (Tauri + React) for Ubuntu GNOME. It shows the one thing that matters right now and opens on hover.
- **Who uses it:** people who work on Linux all day and want music, their agenda, alarms and a focus timer without switching windows.
- **Personality:** quiet, precise, a little cute (through Lumi only). It should look like a piece of hardware, not like a website.

## 2. Hard constraints (do not break these)

| Constraint | Value | Why |
|---|---|---|
| Canvas width | **420px max**, notch ≤ 390px + 2 × 14px shoulders | Fixed window width |
| Compact height | **32px** | Matches the GNOME (Yaru) top bar, so it reads as part of the bar |
| Anchoring | Top-centre, flat top edge, rounded bottom corners | It hangs from the screen edge |
| Background | Transparent outside the notch | Clicks pass through to the desktop |
| Surface | Always dark, one palette (no light mode) | The notch is "hardware" |
| Window height | Grows with content; long lists scroll (max ~168px) | Must not cover the screen |
| Motion | Transform and opacity only | WebKitGTK repaints the SVG every frame; CPU budget |
| Accent | Any user-picked hex; text on it switches black/white automatically | Must work with any colour, not just lavender |
| Status | Always text + colour dot, never colour alone | Accessibility |
| Targets | ≥ 24px hit area (dots), 28–44px buttons | WCAG 2.5.8 |

## 3. States of the notch

One element changes shape between three modes:

1. **Compact (idle)**: 112px wide, 32px tall, bottom radius 14px.
   - Lumi (18px, in a 22px disc) on the left and the clock on the right.
   - If something is live, it widens to **220px** and shows one status line. Live means a running focus timer, a playing track, or an event within 15 minutes. Priority: focus > music > event soon.
   - Otherwise, a status rotates every 15s between widgets (Music / Agenda / Alarm / Focus).
2. **Peek (hover)**: width fits the page, 300–390px, bottom radius 28px.
   - Header row: Lumi avatar 44px (with the accent emoji badge ✦ at bottom-right), name "Lumi", status line (dot + label + "• Widget"), and the clock (time bold, date muted).
   - Below it: the current feature page.
   - Footer: page dots centred (the active dot is stretched 2.4×, white); settings icon button at the right.
   - Change pages with a two-finger swipe, the arrow keys, or the dots. Pages wrap around.
3. **Expanded (click)**: identical to Peek, pinned open. It closes on Escape, a click on the pill, or a click outside.

The width animates (0.3s, cubic-bezier(0.2, 0.8, 0.2, 1)). Each new page fades up 3px.

## 4. Pages (content to design)

Page order: **Music → Lyrics → Agenda → Alarm → Focus**, with **Settings** replacing the page when the gear is pressed.

Each feature follows one pattern: **one fact set large (the "lead"), a muted caption under it, then quiet rows directly on the black**. There is only one primary (accent) action per feature.

- **Music**
  - Lead: track title (20px). Caption: "Artist · Player".
  - Progress bar (4px, accent fill) with elapsed and total time.
  - Controls: Previous / **Play-Pause (44px accent circle)** / Next.
  - Empty states: "Nothing playing" / "Can't reach your player".
- **Lyrics**
  - Current line 20px, next line 14px muted, centred. Fixed width so it doesn't jitter.
  - States: "Looking for lyrics…", "No lyrics found", "Lyrics need an internet connection", and plain (unsynced) scrolling text.
- **Agenda**
  - Lead: next event title. Caption: "in 9 min · 14:30".
  - Then rows grouped by day (Today / Tomorrow / weekday): title + time. Past events are dimmed. A remove × appears on hover.
  - "+ New event" expands an inline form: title, date-time, Cancel / **Add**.
- **Alarm**
  - Lead: next alarm as a **32px tabular figure** ("07:30"). Caption: "in 7 h 40 min · Label".
  - Rows: time, label, 28×16 switch, remove ×.
  - "+ New alarm" form: time, optional label.
- **Focus**
  - Lead: countdown as a 32px figure ("25:00"). Caption: "A 25-minute block" or "Ends at 15:05".
  - **Start/Stop** pill button (accent).
  - Idle: a stepper (− 25 min +, steps of 5). Running: a progress bar.
- **Settings**
  - Fields: Name (max 24), Accent emoji (1 glyph), Accent colour, Animation (Playful / Gentle / Minimal).
  - Checkboxes: Rotate idle widgets, Show date and time, Reduce motion, Start on login.
  - Slider: Rotate every 5–60 s.
- **AI usage** (hidden for now, coming later)
  - Cards with provider name, status chip, big value, detail, and meta line.

## 5. Current design tokens (starting point, redesign freely within the constraints)

```css
--void: #03040a;        /* notch surface */
--surface: #0a0d18;
--ink: #eceff7;         /* primary text */
--ink-muted: #8c94a8;   /* secondary text */
--line: rgb(236 239 247 / .10);
--line-strong: rgb(236 239 247 / .24);
--field: rgb(255 255 255 / .07);       /* raised controls, cards */
--field-hover: rgb(255 255 255 / .12);
--accent: #c1a7ff;      /* user-configurable */
--tone-ok: #6ee7a8;  --tone-demo: #f5c26b;  --tone-bad: #ff8a8a;  --tone-off: rgb(236 239 247 / .45);
--radius-pill: 999px;  --radius-card: 14px;  --radius-field: 10px;
--notch-radius: 28px;  --shoulder: 14px;
shadow: 0 6px 16px rgb(0 0 0 / .3)
```

- **Type:** system-ui / Ubuntu / Cantarell. A four-step scale: **12** meta, **14** body, **20** lead, **32** figures. Times and counters use tabular numerals.
- **Spacing:** pill padding 6–8px; gaps of 8, 10 and 12px; rows at least 36px tall.
- **Accent usage rule:** the accent marks data (progress) and the one primary action, nothing else. Navigation stays neutral white/grey.

## 6. Lumi (the mascot)

- A white cat head (fur fades from white to lavender #E6E0FF underneath), with pink inner ears and blush.
- Navy-to-blue gradient eyes with catchlights. Accent-coloured headphone band and cups, and a small accent ✦ on the forehead.
- **5 expressions:** idle, happy (closed ^^ eyes), surprised (big eyes, "o" mouth), thinking (small eyes, flat mouth), sleepy (closed eyes).
- Motion: playful (float, blink, ear twitch, head tilt; hop on a reaction), gentle (slow blink, tilt), minimal/none.
- Lumi animates only while open. In compact it stays still.
- She reacts to events: a new track makes her surprised, opening makes her happy. The reaction lasts 1.6s, then she returns to idle.

## 7. What I want from the redesign

- A stronger, more distinctive identity for the notch and the feature pages, while it still reads as part of the GNOME top bar.
- Better hierarchy in Peek: the header row and the page should feel like one object.
- More character in the empty states, through Lumi rather than decoration.
- Show the same layout with 2–3 accent colours (lavender #C1A7FF, a mint, a warm orange) to prove the system works with any accent.
- **Deliver frames:**
  1. Compact idle
  2. Compact live (music playing)
  3. Peek: Music
  4. Lyrics
  5. Agenda (with the add form open)
  6. Alarm
  7. Focus (idle and running)
  8. Settings
  9. Lumi expression sheet
- Place every frame on a sample desktop wallpaper, both light and dark, so the shoulders and shadow are visible.

## 8. Avoid

- Glassmorphism, blur, neon glow, gradient surfaces, borders around the pill.
- A light theme for the notch.
- Coloured navigation (dots and tabs stay neutral).
- Anything wider than 420px, or a compact state taller than 32px.
- Generic dashboard cards for every feature. Features sit directly on the black; only forms are raised.
