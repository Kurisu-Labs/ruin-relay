# Rencana Implementasi — Dari Dokumen ke Game Isometrik

Status: backlog usulan, **belum dikerjakan**. Tidak menetapkan deadline baru terhadap jadwal hackathon lama. Estimasi bergantung ukuran tim, ketersediaan aset dan hasil spike.

## 1. Strategi

Bangun vertical slice: engine baru → blockout → playable → editor terintegrasi → aset → polish → regression/evidence. Jangan memulai seluruh produksi aset sebelum POV dan ukuran tile diterima melalui blockout.

Peran di bawah adalah tanggung jawab pekerjaan, bukan instruksi otomatis menjalankan agent paralel atau menghubungi orang lain.

## 2. Milestone dan exit criteria

| Milestone | Output | Dependency | Selesai ketika |
|---|---|---|---|
| M0 Baseline | Catatan commit, tests/screenshot existing, daftar keputusan. | Dokumen ini. | Status saat mulai dapat direproduksi dan gap diketahui. |
| M1 Phaser 4 spike | Satu scene WebGL dari package exact. | M0. | Typecheck/build/import/lifecycle smoke lulus. |
| M2 Projection blockout | Seed 7×7 miring, marker arah, picking. | M1. | POV dapat diperiksa; GEO P0 lulus. |
| M3 Playable slice | Keyboard, steps, escape, restart dan stale. | M2. | Fixture A/B dan input regressions lulus. |
| M4 Editor/integrasi | Click tile, ghost, valid/invalid, lock, contribution cue. | M3. | Tile8/15/31/38, snapshot dan recovery terjaga. |
| M5 Asset pass | Style sample → aset modular → atlas/animation. | M2 geometry diterima; integrasi penuh setelah M4. | Pivot/depth/cutaway/provenance lolos. |
| M6 Polish | Reduced motion, responsive, load/error/performance; audio optional. | M4/M5. | Target kualitas diukur atau gap diputuskan. |
| M7 Release lokal | Full suite, visual/manual QA dan evidence. | M6. | Tidak ada blocker P0; PR menjelaskan hasil dan batas. |

Public Sepolia gate mengikuti release repo dan bukan output otomatis M7.

## 3. Backlog yang dapat dikerjakan

| ID | Pekerjaan | Peran | Needs | Bukti / acceptance |
|---|---|---|---|---|
| GP-01 | Periksa baseline dan perubahan terbaru. | Engineer. | — | Commit, working tree, known test logs dicatat. |
| GP-02 | Validasi versi/package Phaser 4 exact. | Engineer. | GP-01 | Release/package/source sesuai; tidak bergantung label latest. |
| GP-03 | Upgrade minimum dan scene smoke WebGL. | Engineer. | GP-02 | Build/typecheck, satu canvas, import cleanup. |
| GP-04 | Implement projection dan bounds. | Engineer. | GP-03 | GEO-01/02/03/09/10. |
| GP-05 | Implement inverse picking/camera fit. | Engineer. | GP-04 | GEO-04–08. |
| GP-06 | Buat blockout SW→NE berlabel. | Engineer/design. | GP-04/05 | Corner, world axes, visible faces dan endpoint dapat dievaluasi. |
| GP-07 | Ekstrak bridge/frame dari Board. | Engineer. | GP-03/06 | Ownership/lifecycle jelas; no relay global di scene. |
| GP-08 | Input, dedupe, tween/queue/generation. | Engineer. | GP-07 | IN-01–15; fixture path utuh. |
| GP-09 | Integrasi selected tile, draft dan DOM editor. | Engineer. | GP-05/08 | ED P0; klik tidak request wallet. |
| GP-10 | Lock, status, contribution effect/reorg cleanup. | Engineer. | GP-09 | TX P0 dan existing recovery regressions. |
| GP-11 | Produksi style sample kecil. | Artist/design. | GP-06 | Rasio, lighting, pixel scale dan character silhouette sesuai. |
| GP-12 | Produksi aset P0 dan provenance. | Artist. | GP-11 diterima | AS-01–09/alternatif effect yang disepakati; credits lengkap. |
| GP-13 | Atlas/pivot/facing integration dan cutaway. | Engineer/artist. | GP-10/12 | VIS-01–09, feet/depth/occlusion benar. |
| GP-14 | Preferences, errors, responsive dan accessibility. | Engineer/design. | GP-09/13 | A11Y P0, LIFE-04/05, VIS-08/09. |
| GP-15 | Audio optional dan quality tuning. | Engineer/audio. | GP-13/14 | VIS-10 jika audio dipilih; tidak menahan P0. |
| GP-16 | Profiling dan full regression final. | Engineer/QA. | GP-10/13/14 | PERF evidence, full suite commit yang sama. |
| GP-17 | Human playtest dan review keterbacaan. | Design/QA. | GP-13/14 | Kebingungan kontrol/preview dicatat; blocker diperbaiki. |
| GP-18 | Konsolidasi ADR dan dokumentasi hasil. | Engineer/design. | GP-16/17 | Record actual decision, versi, hasil, gap dan instruksi run. |

Task GP adalah daftar lokal, **bukan GitHub issue yang sudah dibuat**. Publikasi tiket terpisah mengikuti instruksi issue tracker dan authorization yang berlaku.

## 4. Urutan slice yang dapat direview

1. Dependency/engine smoke tanpa art overhaul.
2. Projection dan labeled blockout.
3. Bridge/input/animation yang menjaga domain.
4. Editor/cue/lock integration.
5. Asset pass dan occlusion.
6. Responsiveness, preferences, validation evidence.

Commit atau PR tidak dibuat oleh paket dokumentasi ini. Saat pekerjaan implementasi diminta, sesuaikan slice dengan kebijakan repo dan task aktual.

## 5. Gate keputusan

| Gate | Saat | Keputusan yang harus jelas | Pekerjaan yang tetap bisa dilanjutkan |
|---|---|---|---|
| D1 Orientasi | Akhir blockout. | POV SW→NE vs maksud endpoint kiri bawah→kanan atas. | Rules, engine smoke, tests tidak bergantung art final. |
| D2 Style | Sesudah sample. | Pixel art atau ilustrasi lain, W/H dan wall height. | Recovery integration dengan placeholder. |
| D3 Kontrol | Playable slice. | Mapping canonical dapat dipahami atau perlu proposal remap. | Editor/asset cleanup yang tidak bergantung mapping final. |
| D4 Kualitas | Profiling. | Efek mana yang dipertahankan pada target hardware. | Pengujian integritas path/attempt tetap wajib. |

Gate ini untuk evaluasi keputusan desain, bukan alasan berhenti sebelum hasil reviewable dibuat. Paket dokumentasi telah menggunakan asumsi eksplisit agar perencanaan dapat selesai tanpa interview panjang.

## 6. Prioritas saat scope harus diperkecil

Potong terlebih dahulu ambience, dekorasi perimeter, normal maps, elaborate particles, extra texture variants dan animasi cinematic. Gunakan effect prosedural sederhana bila aset raster belum siap.

Pertahankan Phaser 4 target, POV blockout yang diterima, 49 tile yang tepat, player/floor/wall/endpoint terbaca, edit preview, keyboard/DOM, reduced motion minimum, snapshot/live dan seluruh integritas transaksi/recovery.

Jangan menghapus unknown handling, menganggap timeout failure, atau mengubah contract rules agar demo visual tampak lebih cepat.

## 7. Perubahan yang mungkin diperlukan di repo

Expected touch points: package/lockfile, `src/game/`, Board props di App, style host, assets baru, dan tests yang memeriksa perilaku baru. Root ADR/HANDOFF diperbarui saat decision benar-benar diadopsi.

Perubahan di contract, ABI, fixture, chain/journal atau deploy scripts bukan kebutuhan normal pengembangan ini. Jika ditemukan kebutuhan nyata, jelaskan sebab dan perluas spesifikasi secara eksplisit sebelum mengubah aturan.

## 8. Checklist review milestone

- Perilaku yang ditambahkan memenuhi requirement, bukan hanya screenshot.
- Tidak ada source of truth baru untuk run/chain.
- Assets mempunyai proyeksi/pivot yang sama dan provenance.
- Tes yang relevan berjalan; result dari commit berbeda diberi konteks.
- Screenshot menyebut practice/local/testnet dengan benar.
- Keputusan/asumsi berubah diperbarui dalam paket dan ADR yang diadopsi.
- Error dan fallback tidak menghapus attempt/journal.

## 9. Release lokal dan rollback

M7 menghasilkan build lokal yang dapat dijalankan serta evidence, bukan janji publikasi. Jika ada blocker P0, rollback slice renderer terkait atau perbaiki sebelum release; jangan rollback contract state atau menghapus data pengguna.

Root public release tetap memerlukan deployed/verified Sepolia contract, dua mutation melalui browser wallet berbeda dan bukti lainnya. Migrasi visual yang lulus tidak membuat gate tersebut otomatis selesai.
