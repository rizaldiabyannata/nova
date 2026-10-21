# NOVA — Product Requirements Document & Technical Specification
**Linux-first Desktop Notch · Versi dokumen 1.1 · Status: Draft untuk validasi teknis**

> Dokumen kerja yang menggabungkan kebutuhan produk dan spesifikasi implementasi. Versi 1.1 menetapkan Ubuntu 26.04 LTS + GNOME Wayland sebagai target Linux utama; hasil kompatibilitas tetap harus dibuktikan lewat build dan QA nyata.
>
> **Riwayat versi:** 1.1 — 19 Oktober 2026: target Ubuntu/Wayland, dependensi build, prosedur uji, fallback window, dan acceptance criteria diperjelas.

## 0. Ringkasan dokumen

### Tujuan
Dokumen ini menyatukan kebutuhan produk (PRD) dan spesifikasi teknis untuk NOVA, desktop companion berbentuk notch/panel kecil yang menyediakan akses cepat ke status AI, musik, agenda, notifikasi, alarm, dan fokus.

### Keputusan saat ini
Platform pertama: Linux, dengan baseline QA Ubuntu 26.04 LTS + GNOME pada Wayland. UI: glass/translucent. Karakter: 2D kustom berbasis SVG/sprite. Animasi: playful dengan opsi gentle/minimal dan reduced motion. Widget idle berputar setiap 15 detik secara default. Integrasi AI yang ditargetkan: Claude dan OpenAI/GPT, dengan batasan API resmi dijelaskan secara eksplisit. Posisi top-center adalah kemampuan best-effort, bukan jaminan pada Wayland.

### Status implementasi
Scaffold prototipe telah disiapkan dengan React + TypeScript, Tauri 2 + Rust, pengaturan persisten, karakter SVG, widget AI demo, dan rotasi widget. Ini bukan rilis produksi: build belum diverifikasi pada mesin Linux target, provider AI masih demo, dan penempatan notch native belum dituntaskan.

### Audiens
Product owner, engineer frontend/backend, engineer Rust/Tauri, QA, designer, serta kontributor yang akan memperluas dukungan lintas platform.

## 1. Visi produk dan positioning

### Visi
NOVA adalah pendamping desktop yang ringkas, dapat dikustomisasi, dan hemat sumber daya, yang menampilkan informasi penting tanpa mengganggu pekerjaan utama.

### Pernyataan nilai
Satu permukaan kecil untuk melihat status AI dan berpindah cepat ke musik, agenda, fokus, alarm, serta notifikasi—dengan karakter yang memberi identitas tanpa menjadikan UI berat.

### Prinsip desain
Ringkas sebelum lengkap; informasi penting terbaca sekilas; interaksi eksplisit; data transparan; animasi tidak wajib; integrasi native diisolasi dalam adapter platform.

## 2. Sasaran dan non-sasaran

### Sasaran MVP
Menjalankan desktop shell Linux; menampilkan idle scene glass; menampilkan karakter 2D; mengubah widget secara manual dan otomatis; menyimpan pengaturan; menyediakan placeholder provider Claude/OpenAI; mendukung keyboard dan reduced motion; membuat fondasi adapter platform.

### Sasaran pasca-MVP
Posisi notch top-center yang andal pada lingkungan desktop yang didukung; integrasi media Linux via MPRIS; provider usage API yang sah; kalender/pengingat dan alarm; notifikasi; paket distribusi Linux; kemudian adapter Windows/macOS.

### Non-sasaran MVP
Mengambil kredensial dari aplikasi Claude/ChatGPT; membaca data privat tanpa izin; mengklaim kuota subscription konsumen dari API usage organisasi; menjamin posisi/always-on-top di semua compositor Wayland; sinkronisasi lirik universal; membuat agent yang menjalankan tindakan sistem tanpa persetujuan.

## 3. Pengguna sasaran dan kebutuhan

### Persona A — Pengembang multi-AI
Menggunakan Claude dan GPT dalam alur kerja harian; ingin melihat data usage API yang diizinkan, status koneksi, dan waktu pembaruan tanpa membuka dashboard berulang kali.

### Persona B — Pengguna desktop produktivitas
Menginginkan musik, timer fokus, agenda, alarm, dan notifikasi dalam panel yang mudah dipanggil dan tidak menutupi pekerjaan.

### Persona C — Pengguna yang suka kustomisasi
Ingin mengubah nama/warna/karakter, gaya animasi, widget idle, dan interval rotasi.

### Kebutuhan lintas persona
Kinerja idle rendah, kontrol privasi yang jelas, konfigurasi yang bertahan setelah aplikasi dimulai ulang, navigasi keyboard, dan perilaku yang dapat diprediksi.

## 4. Use case utama

### UC-01: Lihat status idle
Saat panel tidak diperluas, pengguna melihat karakter dan ringkasan widget terpilih. Konten tidak boleh mengandalkan warna saja untuk menyampaikan status.

### UC-02: Perluas panel
Klik atau tekan Enter/Space pada trigger untuk membuka panel; pengguna dapat memilih AI, Music, atau Agenda.

### UC-03: Rotasi otomatis
Jika aktif, widget berganti sesuai interval konfigurasi (default 15 detik). Rotasi berhenti saat panel/settings terbuka atau aplikasi tidak aktif sesuai kebijakan yang dipilih.

### UC-04: Kustomisasi
Pengguna mengubah nama, warna aksen, emoji aksen, gaya animasi, interval rotasi, dan reduced motion; perubahan disimpan lokal.

### UC-05: Periksa status provider
Kartu provider menunjukkan Connected, Demo, Unavailable, Error, serta timestamp data terakhir bila tersedia.

### UC-06: Jalankan tanpa integrasi
Aplikasi tetap berfungsi sebagai shell meskipun jaringan atau API provider tidak tersedia.

## 5. Ruang lingkup fitur dan prioritas

### P0 — Prototype
Floating-window shell awal; UI glass; mascot SVG 2D; panel idle/expanded; pemilih widget; rotasi 15 detik; konfigurasi persisten; data provider demo; pengaturan reduced motion; dokumentasi setup.

### P1 — Linux usability
Validasi build pada distro target; adapter posisi/topmost; shortcut global opsional; tray/menu aplikasi; penanganan fokus window; logging dan diagnostik; integrasi MPRIS untuk status dan kontrol media.

### P2 — AI usage
Adapter OpenAI Usage/Costs API dan Anthropic Admin Usage API dengan autentikasi yang sah, pengelolaan secret aman, caching, rate-limit handling, timestamp, dan penjelasan jenis usage.

### P3 — Organizer
Mini kalender, agenda, alarm, timer fokus, notifikasi OS, opsi startup, dan aturan privasi/retensi.

### P4 — Cross-platform
Adapter Windows dan macOS; pengujian window manager; packaging, signing/notarization sesuai platform; perilaku yang konsisten dengan perbedaan OS.

## 6. Persyaratan fungsional (FR)

### FR-001 — Idle scene
Aplikasi MUST menampilkan karakter dan widget idle yang dikonfigurasi. Jika data belum tersedia, tampilkan placeholder atau status yang jelas, bukan nilai yang tampak nyata.

### FR-002 — Panel
Pengguna MUST dapat membuka/menutup panel dengan mouse dan keyboard. Status expanded harus diumumkan ke teknologi bantu.

### FR-003 — Widget
MVP MUST menyediakan AI, Music, dan Agenda sebagai panel, meskipun Music/Agenda masih placeholder.

### FR-004 — Rotasi
Rotasi MUST menggunakan interval konfigurasi dengan default 15 detik. Rotasi MUST dihentikan saat panel/settings terbuka dan timer harus dibersihkan ketika komponen dilepas.

### FR-005 — Konfigurasi
Pengaturan MUST memiliki schema version dan nilai default. Data konfigurasi yang tidak valid harus dinormalisasi atau kembali ke default dengan aman.

### FR-006 — Persistence
Mode desktop MUST menyimpan konfigurasi menggunakan Tauri Store atau penyimpanan lokal yang sesuai. Browser preview boleh memakai localStorage.

### FR-007 — Provider state
Setiap provider MUST menampilkan status, waktu pembaruan bila ada, dan sumber/jenis data. Kegagalan provider tidak boleh menghentikan UI.

### FR-008 — AI integration
Integrasi live MUST memakai endpoint dan autentikasi resmi yang tersedia, dengan cakupan akses sesuai akun. Aplikasi MUST membedakan API usage dari kuota subscription konsumen.

### FR-009 — Error handling
Kesalahan jaringan, autentikasi, rate limit, dan izin harus memiliki status yang dapat dipahami; jangan menampilkan token atau response sensitif di log.

### FR-010 — Reduced motion
MUST menghormati preferensi OS prefers-reduced-motion dan menyediakan override dalam aplikasi.

### FR-011 — Kustomisasi
MVP MUST mendukung nama karakter, warna aksen, emoji aksen, gaya animasi, interval rotasi, dan toggle rotasi.

### FR-012 — Platform adapter
Integrasi native seperti posisi window, media, notifikasi, startup, dan secret store MUST dipisahkan dari komponen React.

## 7. Persyaratan non-fungsional (NFR)

### NFR-001 — Performa idle
Target desain: tidak ada polling jaringan berfrekuensi tinggi saat idle; animasi hanya transform/opacity; tidak menggunakan canvas/WebGL untuk karakter sederhana; timer rotasi tunggal dan dibersihkan dengan benar.

### NFR-002 — Responsivitas
Interaksi lokal umum harus terasa segera; target pengujian internal adalah respons visual di bawah 100 ms pada perangkat referensi, tanpa menjadikannya jaminan sebelum diukur.

### NFR-003 — Memori
Tetapkan baseline dan batas penggunaan memori setelah profiling pada distro/desktop target. Jangan menetapkan angka final sebelum pengukuran Tauri/WebKitGTK.

### NFR-004 — Keandalan
Kegagalan satu provider tidak boleh merusak aplikasi. Config corruption harus memiliki fallback default dan diagnostik tanpa data rahasia.

### NFR-005 — Keamanan
Jangan menanam API key organisasi dalam frontend bundle atau binary yang didistribusikan. Gunakan OS credential store atau backend tepercaya; minimalkan izin Tauri.

### NFR-006 — Privasi
Jelaskan data yang dikirim ke provider, simpan konfigurasi secara lokal, dan jangan mengumpulkan telemetri tanpa persetujuan yang jelas.

### NFR-007 — Aksesibilitas
Kontras teks memadai, focus-visible jelas, kontrol keyboard, label aksesibel, status tidak hanya dibedakan lewat warna, dan reduced motion.

### NFR-008 — Portabilitas
Kode UI dan domain logic harus lintas platform; perilaku windowing/media/notifications diimplementasikan per platform.

### NFR-009 — Maintainability
TypeScript strict mode; interface provider eksplisit; schema config berversi; modul native terpisah; pengujian untuk normalisasi config dan rotasi.

## 8. UX/UI specification

### Idle state
Panel ringkas menampilkan mascot 2D, nama, label widget aktif, status provider, dan affordance untuk membuka panel.

### Expanded state
Panel menampilkan tab AI/Music/Agenda, kartu data, tombol settings, dan tombol close. Panel terbuka menghentikan rotasi otomatis agar pengguna tidak kehilangan konteks.

### Glass style
Permukaan semi-transparan, blur moderat, border halus, bayangan terbatas, teks kontras tinggi. Harus ada fallback warna solid saat backdrop-filter tidak didukung atau menimbulkan masalah performa.

### Karakter 2D
Gunakan SVG/sprite lokal. Tidak ada aset eksternal yang wajib diunduh saat runtime. Animasi default playful berupa gerakan ringan; mode gentle dan minimal tersedia.

### Motion
Utamakan transform dan opacity; hindari animasi blur, filter mahal, layout thrashing, dan animasi terus-menerus yang tidak memberi informasi. Jika reduced motion aktif, nonaktifkan gerakan dekoratif.

### Empty/error states
Gunakan label eksplisit seperti Demo, Not connected, Permission required, Rate limited, atau Last updated. Jangan gunakan angka persentase yang dapat disalahartikan sebagai kuota jika tidak ada sumber resmi yang mendukung.

### Responsive layout
Panel harus tetap terbaca pada lebar kecil. Pada viewport sempit, kartu berpindah menjadi satu kolom; ukuran teks tidak boleh turun di bawah batas keterbacaan yang ditetapkan dalam QA.

## 9. Spesifikasi teknis

### Stack
Tauri 2 sebagai desktop shell; Rust untuk command/native integration; React + TypeScript untuk UI; CSS/SVG untuk animasi 2D; Tauri Store untuk konfigurasi desktop; interface provider untuk integrasi eksternal.

### Modul frontend
src/components/ untuk komponen UI; src/config/ untuk schema dan persistence; src/providers/ untuk provider usage; src/hooks/ untuk lifecycle/rotation; src/services/ untuk orchestration; src/styles/ untuk token visual.

### Modul Rust
src-tauri/src/commands/ untuk IPC command; src-tauri/src/platform/linux/ untuk integrasi Linux; src-tauri/src/platform/windows/ dan macos/ untuk adapter berikutnya; src-tauri/src/security/ untuk credential access; src-tauri/src/services/ untuk orkestrasi native.

### Batas UI/native
React tidak mengakses OS secara langsung. Semua operasi native melewati API Tauri/command yang terdefinisi, tervalidasi, dan memiliki izin minimal.

### Window model
Window dekorasi nonaktif, transparan, always-on-top bila didukung, ukuran kecil, resizable false pada prototype. Posisi top-center bukan asumsi lintas desktop; implementasikan adapter terpisah dan sediakan fallback floating window.

### Linux support matrix dan baseline Ubuntu Wayland
**Target utama v1.1:** Ubuntu 26.04 LTS Desktop, GNOME 50, sesi Wayland. Target ini adalah baseline pengujian, bukan klaim bahwa semua perilaku window sudah terverifikasi.

**Batasan Wayland:** aplikasi desktop biasa tidak boleh mengasumsikan dapat menentukan koordinat window global atau memaksa stacking identik di semua compositor. Top-center, always-on-top, aktivasi dari background, dan click-through adalah kemampuan best-effort. Jangan memakai API X11 sebagai jalur wajib untuk sesi Wayland.

**Fallback wajib:** jika penempatan otomatis atau stacking tidak didukung, NOVA tetap dapat digunakan sebagai floating companion yang dapat dibuka lewat kontrol aplikasi/shortcut yang didukung. Hindari membuat ekstensi GNOME sebagai dependensi wajib untuk fungsi inti.

**QA matrix:** pertama Ubuntu 26.04 + GNOME Wayland; setelah itu tambahkan X11 atau desktop/compositor lain sebagai target sekunder. Catat versi OS, GNOME/compositor, WebKitGTK, GPU/session, transparansi, ukuran/posisi, stacking, fokus, klik, suspend/resume, dan perilaku setelah login ulang.

### Cross-platform
Hindari logika yang mengasumsikan title bar, tray, shortcut, atau always-on-top berperilaku identik di semua OS. Gunakan capability detection dan graceful fallback.

## 10. Konfigurasi dan model data

### Schema config v1
version: 1; idleDisplay: 'ai'; animation: 'playful'|'gentle'|'minimal'; rotationEnabled: boolean; rotationIntervalSeconds: number; widgets: WidgetId[]; mascot: { name, emoji, accent }; reduceMotion: boolean.

### Default
idleDisplay=ai; animation=playful; rotationEnabled=true; rotationIntervalSeconds=15; widgets=[ai,music,agenda]; mascot.name=Nova; mascot.accent=#c1a7ff; reduceMotion=false.

### Validasi
Interval dibatasi ke rentang yang disepakati (prototype 5–60 detik); widget hanya menerima ID yang dikenal; daftar widget kosong dikembalikan ke default; warna dan panjang nama divalidasi; schema versi tidak dikenal menggunakan migrasi atau fallback.

### Penyimpanan
Gunakan Tauri Store untuk preferensi non-rahasia. Credential API tidak boleh disimpan di file config ini. Saat schema berubah, gunakan migrasi eksplisit dan backup/fallback.

### Model status provider
ProviderUsage: providerId, title, primaryValue, detail, state, updatedAt, sourceType, optional usagePeriod, optional errorCode. State minimal: demo, connected, unavailable, permission-required, rate-limited, error.

## 11. Integrasi API AI dan keamanan

### OpenAI
Target integrasi adalah Usage/Costs API organisasi yang didokumentasikan resmi. Akses memerlukan autentikasi dan izin yang sesuai. Data ini menunjukkan aktivitas API organisasi, bukan sisa kuota ChatGPT Plus/Pro atau konsumsi pengguna konsumen.

### Anthropic/Claude
Target integrasi adalah Admin API usage report yang terdokumentasi resmi. Penggunaan memerlukan admin API key dan hak organisasi. Ini tidak sama dengan kuota subscription Claude konsumen.

### Strategi autentikasi
Pilihan yang disarankan untuk aplikasi personal: secret milik pengguna disimpan di OS credential store; panggilan API dilakukan oleh Rust/backend dengan redaksi log. Untuk distribusi multi-user/organisasi, pertimbangkan backend milik produk dengan autentikasi pengguna, kontrol akses, audit, dan kebijakan retensi.

### Jangan dilakukan
Jangan scraping dashboard web, membaca cookie browser, meniru endpoint privat, membundel API key bersama aplikasi, atau mengklaim dukungan data yang tidak disediakan API resmi.

### Rate limit/cache
Cache hasil; refresh konservatif dan dapat dikonfigurasi; hindari request saat UI idle tanpa kebutuhan; hormati Retry-After dan batas provider; tampilkan timestamp data terakhir dan status stale.

### Dokumentasi resmi
OpenAI API reference: https://platform.openai.com/docs/api-reference/usage ; Anthropic Admin API usage report: https://docs.anthropic.com/en/api/admin-api/usage-cost/usage-report-messages . Endpoint, izin, dan schema harus diperiksa ulang saat implementasi karena dapat berubah.

## 12. Platform Linux: windowing dan integrasi

### X11
Penempatan dan stacking window dapat lebih fleksibel tetapi tetap bergantung pada window manager dan konfigurasi desktop. Perlu pengujian untuk top-center, focus, click-through, multi-monitor, dan DPI scaling.

### Wayland
Compositor umumnya mengontrol posisi dan stacking window lebih ketat. Aplikasi tidak boleh menjanjikan posisi global atau always-on-top yang konsisten tanpa dukungan protokol/compositor tertentu.

### Strategi fallback
Jika penempatan otomatis tidak didukung, tampilkan window floating yang dapat dipindahkan atau sediakan mode panel/tray. Jelaskan status kompatibilitas di UI atau dokumentasi.

### Media
Untuk Linux, rencana integrasi media menggunakan MPRIS melalui D-Bus bila sesuai dengan lingkungan target. Status dan kontrol media dipisahkan dari UI React.

### Notifikasi dan startup
Gunakan fasilitas native/desktop portal sesuai distro dan lingkungan. Perizinan, startup otomatis, dan perilaku tray harus dapat dinonaktifkan oleh pengguna.

### Keputusan sebelum produksi
Tentukan distro/desktop target utama (misalnya GNOME/KDE), sesi X11/Wayland, dan apakah posisi top-center wajib atau sekadar preferensi.

## 13. Struktur repositori yang direkomendasikan

### Frontend
src/app/; src/components/idle-scene/; src/components/widgets/; src/components/settings/; src/config/; src/providers/ai/; src/providers/media/; src/services/; src/hooks/; src/styles/; src/types/.

### Tauri/Rust
src-tauri/src/commands/; src-tauri/src/platform/mod.rs; src-tauri/src/platform/linux/; src-tauri/src/platform/windows/; src-tauri/src/platform/macos/; src-tauri/src/providers/; src-tauri/src/security/; src-tauri/src/state.rs.

### Testing
tests/unit/ untuk config/provider/rotation; tests/integration/ untuk IPC dan penyimpanan; tests/e2e/ untuk alur UI; manual-tests/linux/ untuk X11/Wayland, multi-monitor, suspend/resume, dan penggunaan lama.

## 14. Testing & QA

### Build prerequisites — Ubuntu 26.04 LTS
Dependensi build Tauri 2 yang menjadi baseline:

```bash
sudo apt update
sudo apt install -y \
  build-essential curl wget file pkg-config git \
  libssl-dev libwebkit2gtk-4.1-dev libxdo-dev \
  libayatana-appindicator3-dev librsvg2-dev
```

Pasang Rust melalui rustup dan Node.js LTS yang memenuhi persyaratan Vite/proyek. Verifikasi:

```bash
rustc --version
cargo --version
node --version
npm --version
pkg-config --modversion webkit2gtk-4.1
echo "$XDG_SESSION_TYPE"   # di target utama diharapkan: wayland
```

Jika `apt` tidak menemukan paket atau `pkg-config` gagal, hentikan build dan periksa repositori/versi paket sebelum mencari workaround. Ikuti dokumentasi resmi Tauri 2 untuk dependensi terbaru.

### Perintah pengembangan dan build
Dari root repo yang berisi `package.json` dan `src-tauri/`:

```bash
npm install
npm run tauri -- dev
npm run tauri -- build
```

Perintah harus dicocokkan dengan `scripts` pada `package.json`; bila alias `tauri` tidak tersedia, gunakan script yang didefinisikan repo. Periksa output bundler di `src-tauri/target/release/bundle/`. Build yang berhasil belum menggantikan uji manual window di Wayland.

### Uji manual wajib untuk Ubuntu Wayland
- Buka/tutup panel, navigasi keyboard, fokus, klik, dan penyimpanan preferensi setelah restart.
- Periksa sudut transparan pada wallpaper terang/gelap dan fallback solid bila blur tidak stabil.
- Uji stacking saat berpindah aplikasi; jangan anggap always-on-top berhasil hanya dari konfigurasi.
- Uji posisi awal setelah launch, monitor/resolusi yang berbeda jika tersedia, lock/unlock, suspend/resume, dan login ulang.
- Uji reduced motion, idle CPU/RSS, serta pembersihan timer/listener.
- Uji MPRIS dan notifikasi sebagai tahap integrasi terpisah; tidak menghalangi kelayakan shell dasar.


### Unit test
Validasi schema config; migrasi config; clamp interval; widget list kosong/invalid; provider state mapping; rotasi saat panel/settings terbuka; cleanup timer.

### Integration test
Baca/tulis Tauri Store; command IPC; error permission; provider timeout/rate limit; redaksi log; credential retrieval melalui mekanisme OS yang dipilih.

### UI/accessibility test
Keyboard-only; focus order; aria-expanded; screen reader smoke test; kontras; reduced motion OS/app; viewport kecil; tema/fallback tanpa blur.

### Linux matrix
Catat distro/kernel, desktop environment, compositor, X11/Wayland, WebKitGTK, scaling 100/125/150/200%, multi-monitor, sleep/resume, lock/unlock, dan autostart.

### Performance test
Ukur idle CPU/RSS setelah startup stabil, saat animasi aktif, saat panel terbuka, dan saat provider refresh. Target final dibuat setelah baseline perangkat referensi dipilih.

### Security test
Pastikan secret tidak muncul di bundle, source map produksi, log, crash report, atau config biasa. Uji izin Tauri minimal dan validasi input IPC.

## 15. Milestone dan definisi selesai

### M0 — Prototype scaffold
Selesai ketika aplikasi dapat dijalankan dalam browser preview, UI idle/expanded terlihat, setting tersimpan, widget rotasi berjalan, dan provider ditandai jelas sebagai demo.

### M1 — Linux shell (Ubuntu 26.04 + Wayland)
Selesai ketika dependensi terdokumentasi, `tauri dev` dan build produksi berhasil pada mesin target, window transparan/floating stabil, dan hasil uji manual GNOME Wayland dicatat. Status build tidak boleh ditandai lulus sebelum dijalankan.

### M2 — Native position
Selesai ketika top-center diuji di Ubuntu 26.04 GNOME Wayland. Jika compositor membatasi positioning, fallback floating/shortcut berfungsi dan keterbatasannya dijelaskan; posisi absolut bukan blocker untuk shell MVP.

### M3 — Media
Selesai ketika MPRIS mendeteksi metadata/status, play/pause/next/previous berjalan jika player mendukung, dan error ditangani.

### M4 — AI usage
Selesai ketika koneksi API resmi diuji dengan kredensial pengguna yang sah; akses/izin/rate limit ditangani; data diberi label sumber dan periode; tidak ada klaim kuota consumer yang tidak berdasar.

### M5 — Organizer
Selesai ketika agenda/alarm/fokus punya model waktu yang andal, notifikasi bekerja pada target desktop, dan persistensi saat restart diuji.

### M6 — Cross-platform
Selesai ketika adapter Windows/macOS, packaging, aksesibilitas, dan QA platform lulus acceptance criteria masing-masing.

## 16. Acceptance criteria MVP

### AC-01
Fresh install dapat membuka prototype dengan nilai default tanpa konfigurasi manual tambahan.

### AC-02
Idle scene menampilkan karakter 2D dan label widget aktif; tidak ada data AI demo yang disajikan sebagai data live.

### AC-03
Rotasi default berlangsung setiap 15 detik ± toleransi timer browser/runtime; rotasi berhenti ketika panel/settings terbuka dan berlanjut dengan aman setelah ditutup.

### AC-04
Pengguna dapat mengganti nama/warna/emoji/gaya animasi/interval/toggle rotasi/reduced motion; pilihan tetap ada setelah aplikasi dimulai ulang.

### AC-05
Semua kontrol utama dapat dioperasikan dengan keyboard dan memiliki focus indicator.

### AC-06
Preferensi reduced motion OS dihormati; override in-app juga menonaktifkan animasi dekoratif.

### AC-07
Kegagalan provider tidak membuat aplikasi crash dan menampilkan status yang jelas.

### AC-08
Pada baseline Ubuntu 26.04 LTS + GNOME Wayland, hasil launch, transparansi, fokus, stacking, positioning, dan fallback dicatat. Aplikasi tetap dapat diakses jika top-center tidak diizinkan; aplikasi tidak mengklaim dukungan yang belum diuji.

### AC-11 — Build baseline Linux
Dependensi Tauri 2 terpasang, versi `webkit2gtk-4.1` dapat diperiksa dengan `pkg-config`, dan perintah dev/build dijalankan pada mesin target. Hasil sukses/gagal dan log relevan didokumentasikan.

### AC-12 — Fallback Wayland
Jika positioning/always-on-top tidak dapat dipenuhi oleh compositor, floating-window fallback tetap dapat dibuka dan dikontrol tanpa ekstensi GNOME wajib.

### AC-09
Build produksi tidak mengandung API key atau secret organisasi.

### AC-10
Ada README berisi setup, known limitations, dan instruksi uji manual.

## 17. Risiko dan mitigasi

### R-01 — Wayland window placement
Risiko: compositor membatasi posisi/stacking, aktivasi background, atau perilaku click-through. Mitigasi: Ubuntu 26.04 GNOME Wayland sebagai baseline eksplisit, uji pada sesi nyata, adapter per platform, fallback floating/shortcut, dan klaim kompatibilitas hanya berdasarkan hasil uji.

### R-02 — API usage disalahartikan sebagai subscription quota
Risiko: metrik API organisasi bukan kuota produk konsumen. Mitigasi: label jenis data, tautan sumber, jangan tampilkan persentase kuota kecuali ada API resmi yang mendukungnya.

### R-03 — Secret leakage
Risiko: key admin sensitif terekspos dari binary/frontend. Mitigasi: OS credential store/backend tepercaya, least privilege, redaksi log, jangan bundel secret.

### R-04 — Idle performance
Risiko: animasi dan polling terus berjalan. Mitigasi: timer tunggal, no high-frequency polling, refresh berbasis kebutuhan, profiling dan reduced motion.

### R-05 — Fragmentasi Linux
Risiko: variasi distro/DE/WebKitGTK. Mitigasi: baseline awal Ubuntu 26.04 LTS + GNOME Wayland, dokumentasikan dependensi Tauri/WebKitGTK, lalu perluas ke distro/compositor lain setelah acceptance criteria baseline lulus.

### R-06 — Scope creep
Risiko: AI, media, lyrics, alarm, calendar, notification, cross-platform sekaligus. Mitigasi: milestone berurutan dan kriteria penerimaan tiap fase.

## 18. Pertanyaan terbuka

### Q-01 — Diputuskan pada v1.1
Target Linux utama untuk fase pertama adalah Ubuntu 26.04 LTS Desktop + GNOME Wayland. Lingkungan lain menjadi target sekunder setelah baseline lulus.

### Q-02 — Keputusan produk v1.1
Top-center adalah pengalaman yang diinginkan jika compositor mengizinkan, tetapi bukan jaminan universal. Floating companion/shortcut adalah fallback resmi dan harus tetap fungsional.

### Q-03
Integrasi AI hanya untuk API organization usage, atau ada kebutuhan lain seperti status sesi/usage konsumen yang memang tersedia secara resmi?

### Q-04
Apakah pengguna akan memasukkan API key sendiri, atau produk memerlukan backend terkelola? Pilihan ini mengubah desain keamanan dan biaya operasional.

### Q-05
Apakah karakter custom berarti pilihan warna/nama/emoji dahulu, atau impor aset SVG/sprite oleh pengguna pada MVP?

### Q-06
Target distribusi pertama: AppImage, deb, Flatpak, atau beberapa format?

### Q-07
Apakah klik di luar panel harus menutupnya, dan apakah notch harus menerima klik saat idle atau mendukung click-through?

## 19. Referensi dan asumsi

### Asumsi
Dokumen ini menggunakan keputusan konfigurasi dari percakapan sebagai input produk. Status implementasi menggambarkan scaffold prototipe yang dibuat, bukan hasil build/test yang sudah diverifikasi.

### Ubuntu 26.04 LTS
Release notes: https://documentation.ubuntu.com/release-notes/26.04/

### Tauri
Dokumentasi Tauri 2: https://v2.tauri.app/
Prasyarat Linux: https://v2.tauri.app/start/prerequisites/
Distribusi Debian/Linux: https://v2.tauri.app/distribute/debian/

### OpenAI
Usage API reference: https://platform.openai.com/docs/api-reference/usage

### Anthropic
Admin API usage report: https://docs.anthropic.com/en/api/admin-api/usage-cost/usage-report-messages

### Catatan
API, permission, packaging, dan kemampuan window manager harus diverifikasi ulang sebelum rilis karena bergantung pada versi provider, distro, dan compositor.
