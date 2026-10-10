# Validasi Kamera Dekat dan Artwork Dungeon v2

Tanggal: 11 Oktober 2026, Asia/Jakarta. Branch game disiapkan di atas `main` terbaru `08e01b5`; belum dipush. Tujuh commit upstream, termasuk perbaikan status dan pemulihan transaksi, dipertahankan. ADR game dinomori ulang menjadi ADR-033–039 agar ADR-032 upstream tetap unik. Kamera lurus dan artwork v2 mengikuti [ADR-038](../docs/adr/0038-close-top-down-camera.md). Feedback berikutnya menghapus overview manual, mendekatkan kamera lagi dan memperjelas syarat Commit sesuai [ADR-039](../docs/adr/0039-escape-only-overview.md).

## Hasil yang benar-benar dijalankan

| Pemeriksaan                                                                                                     | Hasil                                | Bukti / cakupan                                                                                                                                                                                         |
| --------------------------------------------------------------------------------------------------------------- | ------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `npm run build`                                                                                                 | PASS                                 | TypeScript strict dan Vite produksi dengan Phaser 4.2.1.                                                                                                                                                |
| `npm run test:rules`                                                                                            | PASS, 44 tes                         | Rules, presentasi, aset, status transaksi, wallet dan 10 tes editor melalui Relay asli/markup React; termasuk penggabungan own-confirmed revision dengan petunjuk Commit. |
| `npm run test:contract`                                                                                         | PASS, 11 tes | Fuzz 256 run/property, canonical two contributors, 96 langkah, BFS, race dan validasi input. Dijalankan ulang pada branch persiapan setelah integrasi upstream.              |
| `npm run format:check`                                                                                          | PASS                                 | Prettier memeriksa seluruh file yang dicakup perintah repo.                                                                                                                                             |
| `npm run test:browser -- tests/browser/game.spec.ts tests/browser/dungeon.spec.ts tests/browser/commit.spec.ts` | BLOCKED sebelum tes dimulai          | Harness Anvil/Vite ditolak sandbox: `Operation not permitted (os error 1)`. Tidak ada PASS browser v2 yang diklaim.                                                                                     |
| Inspeksi artwork sumber                                                                                         | PASS                                 | Dua PNG RGBA hasil imagegen diperiksa secara visual; alfa asli dipertahankan, 32 frame terdaftar, gutter guardian/tangga diperhitungkan agar tidak terpotong.                                           |

Build, 44 tes unit, 11 tes kontrak, format check dan percobaan browser dijalankan langsung oleh agent setelah integrasi upstream. Tidak ada instalasi dependency baru yang diperlukan. Browser connector juga tidak tersedia pada sesi ini. [Percobaan browser v2](validation/browser-v2-attempt.json) merekam kegagalan startup harness terbaru; discovery seluruh suite dengan `--list` menemukan 68 tes pada 11 file, tanpa mengeksekusinya. Hasil 51 full regression dan 16 tes akhir dari implementasi sebelumnya adalah [arsip v1](VALIDATION_ISOMETRIC_V1.md), bukan validasi runtime v2.

## Perubahan yang diperiksa

- W/↑: atas; A/←: kiri; S/↓: bawah; D/→: kanan. Path U/R/D/L, collision dan fixture tidak dirotasi.
- Kamera mengikuti posisi visual karakter. Tuning terakhir mengurangi zoom 10% dari view 4×3.4 tile, menjadi target cakupan sekitar 4.44×3.78 tile; clamping menjaga karakter tetap terlihat pada tiga ukuran viewport.
- Tombol **Full dungeon** dihapus. Mencapai EXIT otomatis membuka peta penuh untuk editor; Restart selalu kembali ke view dekat.
- Semua tile tetap tersedia untuk editor setelah escape, melalui canvas maupun tombol DOM. Klik dibatasi pada footprint persegi dan tidak mengenai perimeter dekoratif.
- Panel menjelaskan floor → wall, wall → floor, fixed tiles, satu edit, syarat rute dan status preview yang belum tersimpan. Alasan Commit nonaktif tampil dekat tombol melalui `aria-describedby`.
- Atlas environment memuat empat lantai, empat wall, pilar, brazier, urn, tulang, tangga, portal, guardian dan fern. Atlas karakter memuat empat arah × empat pose. Efek v1 tetap dipakai dan bukan asset collision.
- Preferensi reduced motion menghentikan gerak visual dan efek tanpa mengubah state run. Loading, WebGL failure, retry dan satu canvas tetap memakai lifecycle bridge.

## Ukuran aktual

Dua PNG v2: 3,857,197 byte raw, di bawah anggaran baru 4 MiB. Masing-masing 1254×1254 RGBA; total decoded source sekitar 12.0 MiB sebelum overhead engine. Manifest memuat ukuran, SHA-256 dan provenance: [manifest](../public/assets/game/v2/manifest.json).

Build produksi branch persiapan: main JS 582.05 kB / gzip 178.49 kB; lazy Phaser/game chunk 1,386.93 kB / gzip 361.89 kB; CSS 8.04 kB / gzip 2.69 kB. Vite masih memberi peringatan chunk di atas 500 kB. Tidak ada klaim FPS, first-playable, atau matrix browser berdasarkan build saja.

## Pemeriksaan Commit abu-abu

Loop `npx vitest run tests/editor.test.ts` menjalankan local escape fixture A dan memilih floor 31 melalui Relay asli, kemudian merender markup App. Sebelum perbaikan, tes gagal karena tombol nonaktif belum memiliki `aria-describedby="commit-help"`. Setelah perbaikan, sembilan tes awal file tersebut lulus, termasuk enam penghalang terpisah: belum memilih tile, tile 8 menutup rute, offline, stale, busy dan koordinasi tab tidak tersedia.

Setelah integrasi upstream, tes kesepuluh memastikan edit milik sendiri yang sudah terkonfirmasi dijelaskan sebagai tersimpan, bukan sebagai perubahan pemain lain.

Practice mempertahankan snapshot dan tidak meminta wallet ketika prepare dipanggil. Dengan live observation yang siap, tombol aktif sebelum wallet terhubung dan prepare baru memanggil wallet; wallet rejection tetap mempertahankan run dan pilihan tile. Tes ini menggunakan wallet boundary mock serta adapter snapshot React untuk server renderer. Tidak ada transaksi yang dikirim dan pengujian markup ini tidak mengukur render WebGL atau interaksi browser.

Pada pemeriksaan konfigurasi berikutnya, `.env`, `.env.local` dan file development belum tersedia; sesi agent juga tidak mewarisi metadata deployment. `.env.local` kemudian dibuat dari `.env.example` berisi metadata publik kontrak resmi yang sudah dicatat repo, dan dikonfirmasi diabaikan Git. Vite `loadEnv` membaca address/block valid serta `VITE_LOCAL=false`. Build dan 34 tes unit kembali lulus dengan file ini. Pemeriksaan read-only RPC tidak dapat menyelesaikan DNS pada sandbox (`EAI_AGAIN`), sehingga koneksi live di browser belum dinyatakan berhasil. Tidak ada wallet atau transaksi yang diaktifkan oleh penulisan konfigurasi ini.

## Batas bukti

Screenshot dalam `validation/desktop.png`, `editor.png`, `mobile.png`, serta `browser-results.json` berasal dari v1. Belum ada screenshot browser v2, karena browser harness tidak dapat dijalankan pada sandbox ini. Tes browser telah diperbarui untuk kamera lurus tanpa map toggle, automatic escape overview, petunjuk Commit, picking, resize, retry dan canonical movement; eksekusinya tetap belum terverifikasi.

Tidak ada transaksi publik atau perubahan akun GitHub. Release Sepolia tetap mengikuti [release evidence](../docs/release-evidence.md).
