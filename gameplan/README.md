# Ruin Relay — Game Plan dan Riwayat Presentasi

Tanggal rancangan: 10 Oktober 2026 · Implementasi lokal: 11 Oktober 2026 · Versi paket: 0.4.

**Versi aktif:** [dungeon orang pertama Three.js](THREE_DUNGEON.md) di `src/game3d/` dan `/play`. Pengguna memilih 3D sebagai satu-satunya game; `/play/3d` tetap berfungsi sebagai alias. Phaser, source 2D dan atlas telah dihapus setelah backup lokal diverifikasi. Keputusan dan cara memulihkan versi lama ada di [ADR-042](../docs/adr/0042-threejs-only-dungeon.md) serta [migrasi renderer](RENDERER_MIGRATION.md).

Beranda `/` dan game yang memenuhi viewport tetap berbagi satu sesi tanpa reload, dengan tombol Home, kontrol mouse/sentuh dan fullscreen opsional. Aturan 7×7, EXIT, satu edit dan transaksi tetap sama. Status tes terbaru ada di catatan migrasi dan dokumen 3D.

Paket di bawah menyimpan **rancangan dan validasi historis 2D**: isometrik Phaser 4, kamera dekat lurus, artwork v2/v3, lalu [pembaruan viewport](VIEWPORT_UPDATE.md). Rujukan `src/game/` dan atlas pada dokumen lama mengacu pada snapshot sebelum migrasi, bukan file runtime saat ini. Detail engine/kamera/aset tersebut digantikan oleh ADR-042; aturan domain tetap berlaku.

## 1. Cara membaca

| Urutan | Dokumen                                                     | Kegunaan                                                                             |
| ------ | ----------------------------------------------------------- | ------------------------------------------------------------------------------------ |
| 1      | [PRD](PRD.md)                                               | Tujuan, ruang lingkup, kebutuhan pengguna, acceptance criteria.                      |
| 2      | [Game design](GAME_DESIGN.md)                               | Aturan, pengalaman satu run, edit, replayability, dan contoh konkret.                |
| 3      | [Kamera dan proyeksi](CAMERA_AND_PROJECTION.md)             | Arti POV kiri bawah, orientasi, rumus, picking, ukuran, dan occlusion.               |
| 4      | [Arahan seni](ART_DIRECTION.md)                             | Dunia, warna, pencahayaan, karakter, dan prinsip visual.                             |
| 5      | [Spesifikasi aset](ASSET_SPEC.md)                           | Daftar aset, ukuran, pivot, animasi, ekspor, lisensi, dan pemeriksaan.               |
| 6      | [UX dan aksesibilitas](UX_AND_ACCESSIBILITY.md)             | Kontrol, fokus, HUD, editor, status transaksi, suara, reduced motion.                |
| 7      | [ADR](ADR.md)                                               | Indeks keputusan arsitektur yang diusulkan dan hubungannya dengan ADR repo.          |
| 8      | [Rancangan teknis](TECHNICAL_DESIGN.md)                     | Batas modul, data frame, lifecycle scene, input, animasi, dan recovery.              |
| 9      | [Migrasi Phaser 4](PHASER4_MIGRATION.md)                    | Urutan upgrade, kompatibilitas, pembuktian versi, dan rollback.                      |
| 10     | [Rencana implementasi](IMPLEMENTATION_PLAN.md)              | Milestone, pekerjaan, dependency, output, dan syarat selesai.                        |
| 11     | [Rencana pengujian](TEST_PLAN.md)                           | Matriks geometri, gameplay, visual, input, integrasi, dan performa.                  |
| 12     | [Risiko dan keputusan terbuka](RISKS_AND_OPEN_QUESTIONS.md) | Asumsi, risiko, prioritas, dan keputusan yang perlu dibahas.                         |
| 13     | [Sumber](SOURCES.md)                                        | Baseline repo dan rujukan resmi yang diperiksa.                                      |
| 14     | [Template bukti validasi](VALIDATION_RECORD.md)             | Tempat mencatat versi, hasil tes, screenshot, performa dan gap setelah implementasi. |

Mulai dari PRD bila ingin memahami hasil akhir. Untuk engineer, lanjutkan sampai rancangan teknis dan test plan sebelum mengubah kode. Untuk pembuat aset, baca kamera terlebih dahulu sebelum art direction dan asset spec.

## 2. Permintaan dan usulan awal (historis)

Arah layar, kamera dan artwork pada tabel awal berikut telah diperbarui oleh [ADR-038](../docs/adr/0038-close-top-down-camera.md). Aturan domain tetap berlaku.

| Kategori            | Isi                                                                | Perlakuan                                                                                      |
| ------------------- | ------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------- |
| Permintaan pengguna | Menggunakan Phaser 4.                                              | Target engine pengembangan.                                                                    |
| Permintaan pengguna | POV dari sisi kiri bawah menuju kanan atas.                        | Diterjemahkan menjadi pandangan miring dari barat daya; perlu dicek melalui blockout berlabel. |
| Permintaan pengguna | Bentuk papan tidak lagi tampak sebagai grid persegi dari atas.     | Render isometrik dengan lantai berbentuk diamond.                                              |
| Permintaan pengguna | Aset bertema dungeon/reruntuhan.                                   | Tema visual wajib; detail gaya masih usulan.                                                   |
| Batas paket ini     | Membuat dokumentasi sangat detail dalam folder baru.               | Seluruh hasil kerja tahap ini berada di `gameplan/`.                                           |
| Usulan desain       | Pixel art, rasio lantai 2:1, karakter penjelajah berlentera.       | Baseline konkret untuk perencanaan, belum persetujuan final seni.                              |
| Usulan desain       | Kamera tetap, wall cutaway, animasi langkah, efek debu.            | Dievaluasi pada milestone yang relevan.                                                        |
| Diwarisi dari repo  | Aturan 7×7, satu shared dungeon, transaksi, snapshot dan recovery. | Tetap berlaku; paket ini tidak mengubahnya.                                                    |

## 3. Kedudukan terhadap dokumen repo

Ruin Relay tetap satu konteks domain. [GLOSSARY](../GLOSSARY.md) adalah kamus domain; paket ini tidak membuat kamus domain kedua. Istilah teknis presentasi dijelaskan pada dokumen terkait.

Aturan authoritative tetap berasal dari [PRD utama](../PRD.md), [ADR utama](../ADR.md), [ADR-029](../docs/adr/0029-frozen-run-snapshot.md), [ADR-030](../docs/adr/0030-commit-attempt-confirmation.md), [ADR-031](../docs/adr/0031-commit-recovery.md), dan [fixture kanonik](../reference/fixtures.json).

Jika proposal di sini bertentangan dengan ADR accepted, perilaku accepted tetap berlaku sampai amendment diterima secara eksplisit. Khusus Phaser 4, [ADR-033](../docs/adr/0033-phaser4-renderer.md) mengganti pilihan Phaser 3 pada ADR-014. Pemisahan React/Phaser dan amendment snapshot ADR-029 tetap dipertahankan.

ADR-038 mengganti ADR-034 dengan kamera dekat lurus berdasarkan feedback pengguna. [ADR-039](../docs/adr/0039-escape-only-overview.md) kemudian menghapus overview manual, mendekatkan kamera sekitar 20% lagi, dan memperjelas preview serta syarat Commit. ADR-033–037 telah diadopsi di `docs/adr/` untuk implementasi yang diminta pengguna. File di `gameplan/adr/` adalah pointer ke record normatif tersebut. Penerimaan keputusan tidak menggantikan bukti build, browser atau release.

## 4. Baseline historis sebelum implementasi

- HEAD saat penulisan: `2f18a91` — implementasi lokal sudah ada.
- `package.json`: `phaser` masih `3.90.0`.
- `src/game/Board.tsx` pada snapshot historis: Canvas 560×560, grid tegak, gambar geometris, keyboard; belum isometrik.
- [Rules](../src/lib/rules/index.ts): board 7, EXIT 48, batas 96 langkah, preview toggle dan solvability.
- [Relay](../src/lib/relay.ts): pemilik run, pilihan edit, dan koordinasi commit.
- [Release evidence](../docs/release-evidence.md): hasil pengujian historis dan status release; bukan bukti migrasi Phaser 4 sudah diuji.

Pemeriksaan lanjutan pada HEAD `7562fa8` menemukan update repo: release evidence sekarang mencatat kontrak resmi Arbitrum Sepolia `0xDaFc851910D91D54916349EECB8d320a5a56b988`, deployment block `317783571`, dan Sourcify `exact_match`. Browser-wallet mutations pada kontrak resmi serta video release masih pending. Status ini berasal dari catatan repo; explorer/Sourcify tidak dapat dibuka melalui browser tool pada pemeriksaan lanjutan.

`.env.example` sudah memuat metadata kontrak tersebut, tetapi pada folder lokal yang diperiksa belum ada file environment aktif maupun override `VITE_*` pada shell. Contoh konfigurasi tidak otomatis dimuat aplikasi; `npm run dev` tanpa metadata aktif memakai practice seed. Hosting harus menerima metadata publik saat build. Tidak ada konfigurasi deployment, wallet, atau kontrak yang diubah oleh paket ini.

Kalimat “specification only” dalam handoff awal mendeskripsikan paket awal, bukan seluruh keadaan kode sekarang. Gunakan kode dan release evidence untuk status implementasi; gunakan spesifikasi untuk aturan normatif.

## 5. Cara memakai paket ini untuk pekerjaan berikutnya

Contoh instruksi: “Kerjakan milestone M1 pada `gameplan/IMPLEMENTATION_PLAN.md`, mengikuti PRD dan draft ADR yang relevan. Laporkan hasil pengujian serta perubahan asumsi.”

Kerjakan satu milestone dengan hasil yang dapat diperiksa. Jangan menafsirkan selesainya dokumentasi sebagai izin otomatis untuk menghasilkan seluruh aset, merombak website utama, mengubah aturan, atau deploy ke jaringan publik.

## 6. Batas keberhasilan tahap dokumentasi

- Spesifikasi cukup rinci untuk membangun blockout dan memeriksa arah kamera.
- Aturan lama dan usulan visual dapat dibedakan tanpa membaca percakapan.
- Daftar aset mempunyai kebutuhan produksi dan ukuran yang terukur.
- Migrasi mempertahankan path, fixture, attempt recovery, dan pemisahan snapshot/live.
- Test plan memiliki expected result, termasuk race, input cepat, dan restart saat animasi.
- Semua target angka ditulis sebagai target, bukan hasil pengukuran.
