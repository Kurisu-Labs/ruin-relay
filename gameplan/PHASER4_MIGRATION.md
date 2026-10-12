# Rencana Migrasi Phaser 3 → Phaser 4

Status: dependency dan renderer telah dimigrasikan secara lokal ke Phaser 4.2.1. Setelah pembaruan kamera dekat/artwork v2 serta petunjuk editor, typecheck/build dan 44 tes unit lulus setelah integrasi main `08e01b5`. Sebelas tes kontrak dijalankan ulang dan lulus. Harness browser v2 tertahan oleh sandbox sebelum tes dimulai. Hasil browser 51 + 16 tes pada versi isometrik merupakan bukti historis v1, bukan klaim hasil v2; lihat [validation record](VALIDATION_RECORD.md). Baseline berikut merekam keadaan sebelum migrasi.

## 1. Fakta yang diperiksa

- Dependency repo: `phaser: 3.90.0`.
- Board menggunakan `Phaser.CANVAS`, Scene, Graphics, Text, keyboard events, lazy import dan Scale.FIT.
- Tidak ditemukan custom WebGL pipeline atau plugin isometric dalam Board existing.
- Daftar release resmi yang diperiksa 10 Oktober 2026 menampilkan Phaser **4.2.1**, rilis 9 Juli 2026, sebagai entri terbaru pada halaman tersebut. [Release resmi](https://phaser.io/download/phaser4).
- Phaser 4 mengganti bagian renderer WebGL dan sejumlah API visual; Canvas masih ada tetapi deprecated dalam changelog 4.0. [Changelog resmi](https://github.com/phaserjs/phaser/blob/master/changelog/v4/4.0/CHANGELOG-v4.0.0.md).

4.2.1 adalah **calon baseline**, bukan bukti bahwa kombinasi dependency repo sudah diuji. Dokumentasi API yang diperiksa berlabel 4.0/4.1; API final harus dicocokkan dengan package/source versi yang di-pin. Jangan menyamakan nomor Phaser Editor dengan nomor Phaser runtime.

## 2. Prinsip migrasi

Upgrade engine lebih dahulu dalam slice kecil, lalu ubah proyeksi, kemudian aset dan polish. Dengan urutan ini, kegagalan dapat dibedakan antara API engine, matematika view, dan produksi art.

Pertahankan satu package Phaser yang dipakai aplikasi. Jangan membawa Phaser 3 dan 4 bersamaan ke bundle hanya untuk menyembunyikan masalah kompatibilitas.

## 3. Prasyarat pekerjaan

- Periksa HEAD, working tree dan instruksi repo terbaru.
- Baca handoff, root PRD/ADR/amendments, fixture dan paket gameplan.
- Pastikan Node/npm sesuai README; baseline proyek meminta Node 22.12+.
- Dependency install dijalankan dari lockfile yang sesuai; jangan menyalin `node_modules` antarversi runtime sebagai bukti reproducibility.
- Simpan baseline hasil typecheck/build/rules/browser serta screenshot sebelum perubahan.
- Tentukan versi exact Phaser 4 setelah verifikasi release dan package metadata resmi.

Jangan membuka `.local` atau membaca private key untuk migrasi renderer. Anvil digunakan saat perlu integrasi, bukan saat menghitung proyeksi.

## 4. Audit area kompatibilitas

| Area              | Risiko                                   | Pemeriksaan implementasi                                   |
| ----------------- | ---------------------------------------- | ---------------------------------------------------------- |
| Package/import    | Type declarations dan ekspor berbeda.    | Dynamic import, default export, TS bundler resolution.     |
| Renderer          | Existing memaksa Canvas.                 | WebGL init di browser target; pesan kegagalan.             |
| Graphics          | Metode shape/line behavior berubah.      | Blockout diamond dan wall dengan API versi exact.          |
| Text              | Font/loading/metrics memengaruhi layout. | Critical text DOM; scene text diagnostic seperlunya.       |
| Input             | Event queue dapat diproses ulang.        | Existing rapid-key frame-pause test tetap lulus.           |
| Scale/camera      | Fit/scroll/zoom mengubah pointer.        | Camera bounds dan inverse picking saat resize.             |
| Loader/atlas      | Trim/pivot/frame lookup.                 | Style sample terintegrasi, bukan hanya gambar terbuka.     |
| Tween             | Cleanup callback setelah reset.          | Generation token dan restart-mid-tween.                    |
| Tint/filter       | API Phaser 3 tidak diasumsikan sama.     | Pilih API versi 4 yang dibuktikan; advanced FX optional.   |
| Context lifecycle | Remount/context restore.                 | Satu canvas, cleanup dan rebuild dari authoritative frame. |

Tidak semua area pasti membutuhkan perubahan. Audit berdasarkan usage aktual; jangan merombak modul wallet/chain karena versi Phaser berubah.

## 5. Urutan teknis

### Tahap A — Version spike

1. Pin exact version Phaser 4 dan regenerasi lockfile melalui package manager.
2. Jalankan typecheck/build pada perubahan engine minimum.
3. Muat satu scene WebGL dengan placeholder asli.
4. Periksa lazy import dan cleanup ketika host ditutup.
5. Catat runtime version, browser, screenshot dan error yang tersisa.

Exit: engine siap, bukan dungeon final. Jika API/package tidak kompatibel, selesaikan dahulu; jangan menambah art untuk menutupi error.

### Tahap B — Projection blockout

1. Buat satu projection module sesuai camera spec.
2. Render seed dengan diamond floor dan wall sederhana.
3. Label semua corner, tile 31/38 dan arah pandangan.
4. Tambahkan inverse picking dengan containment diamond.
5. Jalankan fixture movement dan periksa arah visual.

Exit: orientasi dapat dievaluasi dan geometri dapat diuji tanpa aset final.

### Tahap C — Boundary dan animation

1. Ekstrak scene/bridge secukupnya dari Board.
2. Beri frame authoritative dan callback selection/lock yang diperlukan.
3. Implementasikan tween/queue/generation tanpa mengubah aturan path.
4. Pertahankan DOM editor dan wallet flow.
5. Jalankan input, restart, snapshot/live dan recovery regressions.

Exit: playable dengan placeholder, bukan hanya scene dekoratif.

### Tahap D — Asset integration

1. Style sample sesuai proyeksi diterima.
2. Muat atlas, pivot dan animation keys.
3. Ganti placeholder bertahap; pastikan collision tidak pindah ke physics.
4. Depth/cutaway diperiksa pada karakter bergerak dan selection.
5. Loading/failure/retry dan reduced motion tersedia.

### Tahap E — Stabilization

Jalankan full suite pada commit final, visual matrix, performance measurement dan dokumentasi bukti. Local Anvil release dan public Sepolia release dievaluasi terpisah.

## 6. Pilihan rendering tile

Phaser 4 mendukung orientasi isometrik melalui Tilemap API. Untuk 49 tile yang datang dari bitmask dan memerlukan ghost/cutaway, baseline implementasi memakai **sprite/graphics modular dengan projection module**, tanpa dependency map editor tambahan. [Tilemap API resmi](https://docs.phaser.io/api-documentation/4.0.0/class/tilemaps-tilemap).

Tilemap bawaan tetap alternatif sah jika spike menunjukkan manfaat nyata. Dalam pilihan itu, orientasi Tilemap dan rumus picking harus cocok dengan baseline SW→NE; jangan mencampur inverse standar dengan proyeksi custom. Tidak perlu memasang plugin isometric pihak ketiga hanya karena game disebut isometrik.

## 7. Perintah validasi yang sudah tersedia

Perintah berikut dijalankan **saat implementasi**, bukan klaim telah dijalankan untuk paket dokumentasi ini:

```sh
npm run typecheck
npm run build
npm run test:rules
npm run test:browser
npm test
npm run format:check
```

`npm run test:browser` memakai harness Anvil/Vite; hentikan server yang memakai port terkait sebelum tes. `npm run local` untuk inspeksi integrasi; `npm run dev` untuk practice bila deployment metadata tidak ada. Jangan memakai deployment publik untuk tes yang memerlukan reset deterministic.

## 8. Rollback

- Pertahankan perubahan sebagai slice yang dapat dikembalikan; catat commit baseline engine dan asset version.
- Jika engine upgrade gagal, pulihkan dependency/lockfile dan adapter perubahan terkait sebagai satu unit melalui review perubahan biasa.
- Jangan rollback journal atau canonical contract state untuk memperbaiki visual.
- Aset baru yang belum terpakai dapat tetap draft di branch; jangan menganggap cache lama akan memperbaiki package mismatch.
- Hindari dua production renderer aktif bersamaan. Feature flag sementara hanya bila diperlukan untuk perbandingan dan mempunyai rencana penghapusan.

## 9. Gate kelulusan

Migration lulus jika versi engine exact terbukti, build dan gameplay stabil, fixture identik, scene lifecycle bersih, editor/recovery tetap benar, dan visual dapat diperiksa pada target browser. Release evidence Phaser 3 historis tidak membuktikan migration Phaser 4 lulus.
