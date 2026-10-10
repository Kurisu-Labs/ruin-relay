> Arsip validasi presentasi isometrik v1. Bukan bukti hasil kamera/aset v2; lihat [validasi terkini](VALIDATION_RECORD.md).

# Bukti Implementasi dan Validasi Lokal

Tanggal: 11 Oktober 2026, Asia/Jakarta. Implementasi berada di working tree di atas `7562fa8`; belum ada commit, push atau deployment publik.

Phaser 4, dungeon isometrik, artwork modular dan integrasi editor sudah diimplementasikan. Bukti di sini membedakan pemeriksaan yang lulus dari hal yang belum diukur. Hasil release Phaser 3 historis tidak digunakan sebagai bukti migrasi ini.

## 1. Identitas implementasi

| Field                 | Nilai                                                              |
| --------------------- | ------------------------------------------------------------------ |
| Engine                | Phaser 4.2.1, exact dependency dan npm lockfile dengan integrity   |
| Renderer              | WebGL, atlas raster dan Graphics untuk outline/slab                |
| Runtime validasi kode | Node 22.23.3                                                       |
| Test tools            | TypeScript 5.9.3, Vite 8.3.4, Vitest 5.0.3, Playwright 1.64.0      |
| Browser otomatis      | Chromium 156.0.8078.4, Playwright revision 1248                    |
| Environment E2E       | Fresh Local Anvil, chain ID 421614; bukan kontrak publik Sepolia   |
| Layout yang diperiksa | Desktop 1280×720 dan mobile 390×844 melalui screenshot browser     |
| Asset                 | v1, 64 frame, untrimmed atlas 800×800 RGBA                         |
| Asset SHA-256         | `ae3d3d2ec283703519cace121eabff27fa9dbe233645501c6293e4bcf274e87e` |

## 2. Implementasi yang diperiksa

- [Board](../src/game/Board.tsx): lifecycle host, native focused keyboard input, loading/error/retry, preferensi suara dan reduced motion, status DOM.
- [GameBridge](../src/game/GameBridge.ts): satu engine/canvas, WebGL preflight, ResizeObserver, context failure dan cleanup.
- [DungeonScene](../src/game/DungeonScene.ts): floor/wall, karakter empat arah, portal, depth, cutaway, queue gerak, ghost dan confirmed contribution effect.
- [Projection](../src/game/projection.ts): SW→NE, forward/inverse, shared-edge tie break, penolakan klik stone cap/face yang menutupi footprint lain.
- [Rules dan relay](../src/lib/relay.ts): dipakai kembali; tidak ditulis ulang. Tidak ada perubahan smart contract, ABI, codec, journal, wallet atau observer konfirmasi.
- [ADR-033–037](../docs/adr/0033-phaser4-renderer.md): keputusan engine/presentasi/lifecycle diterima dan ADR-014 diamendemen.

## 3. Hasil otomatis

| Pemeriksaan                                                        | Hasil        | Cakupan / batas                                                                                                                                         |
| ------------------------------------------------------------------ | ------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `npm run build`                                                    | PASS         | TypeScript strict dan build produksi Phaser 4.2.1.                                                                                                      |
| `npm run test:rules`                                               | PASS, 24 tes | Fixture canonical, codec, BFS, proyeksi/picking, input, rekonsiliasi run dan atlas.                                                                     |
| `npm run test:contract`                                            | PASS, 11 tes | Termasuk fuzz 256 run per property, dua kontributor, stale race, endpoint dan batas langkah.                                                            |
| Browser full regression sebelum perbaikan terakhir                 | PASS, 51 tes | JSON report dibaca: expected 51, unexpected 0, skipped 0, flaky 0; durasi 234.128 detik, mulai `2026-10-10T17:30:52.274Z`.                              |
| Browser akhir setelah penolakan wall cap dan perbaikan input batch | PASS, 16 tes | Game, isometric dan commit suites; expected 16, unexpected 0, skipped 0, flaky 0, errors kosong; durasi 80.798 detik, mulai `2026-10-10T17:42:29.667Z`. |
| `npm run format:check`                                             | PASS         | File source, tes, scripts dan dokumen yang dicakup perintah repo.                                                                                       |
| Aset / provenance                                                  | PASS         | 64 frame dan hash cocok; RGBA/transparent background benar, dua frame terakhir efek sengaja transparan penuh.                                           |

Tes unit sebelum perbaikan terakhir berjumlah 23 dan juga lulus. Pemeriksaan offline awal tidak dipakai sebagai pengganti Vitest: setelah dependency terpasang, suite asli benar-benar dijalankan.

Command browser akhir:

```sh
npm run test:browser -- tests/browser/game.spec.ts tests/browser/isometric.spec.ts tests/browser/commit.spec.ts
```

Report JSON lengkap berada di `test-results/results.json`, dengan screenshots/trace di folder output tes. Folder ini diabaikan Git; [ringkasan hasil per tes](validation/browser-results.json) dan screenshot akhir disimpan bersama dokumen ini. Pengujian browser dijalankan pengguna dari terminal laptop, karena sandbox sesi agent menolak local port binding dan proses Chromium (`EPERM`). Agent membaca hasil JSON dan memeriksa screenshot yang dihasilkan; build, unit dan contract suite dijalankan langsung dari sesi agent setelah dependensi/cache tersedia.

Verifikasi akhir mencakup klik wall cap yang tidak boleh memilih tile di belakangnya, event keyboard yang datang bersamaan, 10 siklus context failure/retry tanpa canvas atau input handler ganda, kegagalan WebGL, resize, asset retry, frozen snapshot serta commit yang terkunci saat konfirmasi. Seluruh suite pada keadaan akhir berisi 54 tes; 16 tes terkait perubahan terakhir telah dijalankan ulang, sedangkan 51 tes full regression di atas adalah hasil sebelum perubahan terakhir.

## 4. Inspeksi visual

- [Desktop seed](validation/desktop.png): seluruh papan, START, karakter dan portal terlihat; artwork tidak mengandalkan bitmap satu papan utuh.
- [Editor invalid tile 8](validation/editor.png): ghost dan diamond target sesuai, pesan invalid serta Commit disabled tetap jelas.
- [Mobile 390 px](validation/mobile.png): seluruh papan berada dalam frame, preferensi membungkus, editor DOM dan status tetap tersedia. Mobile gameplay touch belum menjadi scope P0.

Screenshot diambil oleh tes browser pada implementasi nyata, lalu disalin ke folder validasi. Ini bukti layout, bukan bukti target FPS maupun persetujuan estetika dari playtest pengguna.

## 5. Ukuran dan performa

| Metrik                                                     | Hasil                                                                                           |
| ---------------------------------------------------------- | ----------------------------------------------------------------------------------------------- |
| PNG + metadata kritis                                      | 42,976 byte raw; sekitar 15,131 byte gzip lokal, di bawah anggaran 2 MiB.                       |
| Decoded atlas saja                                         | 2,560,000 byte (`800*800*4`); tidak termasuk text textures, render targets dan resource engine. |
| Main JS produksi                                           | 571.73 kB minified; 175.45 kB gzip pada build terakhir.                                         |
| Lazy Phaser/game chunk                                     | 1,384.93 kB minified; 361.25 kB gzip pada build terakhir.                                       |
| CSS                                                        | 7.61 kB raw; 2.54 kB gzip.                                                                      |
| Audio transfer                                             | Tidak ada file audio; cue disintesis melalui Web Audio setelah opt-in.                          |
| First playable, input p95, frame p95 dan GPU memory aktual | Belum diukur pada profil perangkat referensi.                                                   |

Vite melaporkan warning chunk di atas 500 kB. Engine tetap lazy-loaded; tidak ada target ukuran JS yang diklaim terpenuhi hanya karena build berhasil. Pengukuran 60 FPS/latency tetap mengikuti metode pada [test plan](TEST_PLAN.md).

## 6. Gap dan cakupan release

- Firefox/Safari belum diuji pada pekerjaan ini; hasil Chromium tidak membuktikan matrix semua browser.
- Screen reader smoke, contrast audit formal, cold-load benchmark dan human playtest belum dilakukan.
- Wall cutaway langsung memperbarui alpha saat overlap; fade 80 ms pada dokumen kamera masih tuning lanjutan. Kamera aktual menggunakan host 640:450; ukuran kamera pada rencana bersifat usulan.
- Validasi lokal tidak mengesahkan release Sepolia. Browser-wallet mutations pada kontrak resmi dan video mengikuti [release evidence](../docs/release-evidence.md).
- Tidak ada transaksi publik, perubahan akun GitHub, commit atau push pada pekerjaan ini.

Keputusan saat ini: implementasi lokal dapat dibangun dan dimainkan; 16 tes akhir lulus setelah perbaikan terakhir. Gate lokal yang dijalankan telah lulus. Validasi release publik dan pengukuran pada perangkat referensi tetap mengikuti cakupan di atas.
