# PRD — Ruin Relay: Phaser 4 Isometric Dungeon

> Pembaruan 11 Oktober 2026: kamera dekat lurus, arah WASD sesuai layar dan artwork v2 menggantikan bagian isometrik/pixel-art awal pada dokumen ini. Lihat [spesifikasi terkini](TOP_DOWN_UPDATE.md), [ADR-038](../docs/adr/0038-close-top-down-camera.md) dan [bukti validasi](VALIDATION_RECORD.md). Aturan domain yang tidak berubah tetap berlaku.

Versi 0.1 · 10 Oktober 2026 · Status: proposed implementation plan.

Rujukan: [README](README.md), [aturan utama](../PRD.md), [game design](GAME_DESIGN.md), [ADR](ADR.md).

## 1. Masalah yang ingin diselesaikan

Game saat ini menyampaikan aturan melalui kotak dan gambar geometris. Aturan sudah dapat dijalankan, tetapi identitas reruntuhan, kedalaman ruang, gerakan karakter, dan dampak mengubah satu tile masih terbatas. Pemain perlu merasakan bahwa ia menjelajahi dungeon dan meninggalkan perubahan untuk pemain berikutnya.

Pengembangan ini meningkatkan bagian bermain dengan Phaser 4, tampilan isometrik, aset dungeon konsisten, serta umpan balik gerak dan edit. Sistem transaksi yang sudah ada tetap menjadi sumber status kontribusi.

## 2. Pernyataan pengalaman

“Aku menjelajahi reruntuhan kecil, menemukan pintu keluar, lalu memilih satu bagian dungeon untuk kubentuk ulang. Pemain berikutnya menghadapi hasil perubahan itu.”

Pemain harus dapat membedakan tiga hasil: berhasil keluar secara lokal, mempunyai usulan edit, dan mempunyai confirmed mutation. Animasi tidak boleh membuat ketiganya tampak sama.

## 3. Tujuan

| ID      | Tujuan                                                                     | Bukti yang diperlukan                                                   |
| ------- | -------------------------------------------------------------------------- | ----------------------------------------------------------------------- |
| GOAL-01 | Dungeon terbaca sebagai ruang isometrik dengan POV yang dimaksud pengguna. | Blockout berlabel dan inspeksi tampilan, bukan deskripsi tertulis saja. |
| GOAL-02 | Pemain mengerti lantai, tembok, posisi karakter, START dan EXIT.           | Uji observasi tanpa penjelasan awal.                                    |
| GOAL-03 | Gerakan terasa langsung dan cocok dengan catatan langkah.                  | Input cepat, animasi, dan path tetap konsisten.                         |
| GOAL-04 | Satu edit mempunyai dampak visual yang jelas.                              | Pratinjau before/after dan perubahan tile yang sesuai bitmask.          |
| GOAL-05 | Migrasi tidak merusak aturan atau recovery.                                | Suite lama dan tes baru lulus pada commit implementasi.                 |
| GOAL-06 | Aset dapat diperluas tanpa menggambar ulang seluruh peta.                  | Tiles modular, frame bernama, pivot dan manifest terdokumentasi.        |

## 4. Pengguna dan kebutuhan

| Pengguna                      | Kebutuhan                                                               | Prioritas                       |
| ----------------------------- | ----------------------------------------------------------------------- | ------------------------------- |
| Pengunjung pertama            | Melihat karakter dan tujuan; mulai tanpa wallet.                        | P0                              |
| Pemain puzzle                 | Menilai rute, bergerak, restart, memahami batas 96 langkah.             | P0                              |
| Pemain yang lolos             | Memilih satu edit dan mengerti apakah dungeon tetap punya jalur keluar. | P0                              |
| Kontributor                   | Mengetahui kapan perubahan masih draft, pending, atau confirmed.        | P0                              |
| Pemain yang kembali           | Memahami revisi yang dimainkan dan revisi live.                         | P0                              |
| Pengguna keyboard             | Memainkan dan memilih edit tanpa mengandalkan pointer.                  | P0                              |
| Pengunjung mobile             | Membaca peta, penjelasan, dan history tanpa layout rusak.               | P0                              |
| Pengguna touch sebagai pemain | Kontrol bergerak di layar sentuh.                                       | P1; belum bagian penerimaan P0. |

## 5. Ruang lingkup

### 5.1 Wajib untuk pengembangan game ini

- Phaser 4 stable dengan versi exact yang dibuktikan kompatibel.
- Papan 7×7 rendered isometrik dengan kamera tetap.
- Tema dungeon/reruntuhan, lantai modular, wall, karakter, START dan EXIT.
- Animasi idle dan berjalan empat arah visual sesuai grid.
- Keyboard WASD dan arrows mempertahankan arti arah logis yang ada.
- Movement feedback, blocked feedback, local escape, edit selection dan preview.
- Pointer picking tile dan alternatif editor melalui DOM/keyboard.
- Occlusion treatment agar posisi karakter dan pilihan edit tidak hilang di balik wall.
- Integrasi dengan React shell, relay, rules, dan attempt state yang ada.
- Loading, asset failure, WebGL failure, reduced motion, serta mute.
- Ukuran responsif, visual QA, uji input, dan bukti kompatibilitas.

### 5.2 Peningkatan setelah inti stabil

- Jejak langkah opsional, animasi pintu lebih kaya, efek rune.
- Ambience dan variasi langkah jika lisensi dan ukuran unduhan sesuai.
- Pengaturan kualitas visual untuk laptop berdaya rendah.
- D-pad touch; harus melalui penerimaan dan QA tersendiri.

### 5.3 Tidak termasuk

- Memperbesar board, mengubah seed, edit mask, encoding atau MAX_MOVES.
- Monster, combat, damage, perangkap yang mengubah legalitas gerakan, inventory.
- Karakter pemain lain yang bergerak secara realtime.
- Level generator, dungeon factory, season, cooldown edit, voting atau reset admin.
- Token, NFT, hadiah finansial, relayer, sponsorship gas atau chain baru.
- Rewrite landing/history/about secara menyeluruh atau pergantian hosting.
- Deployment publik sebagai bagian otomatis dari migrasi visual.

## 6. Aturan domain yang diwarisi

| Parameter    | Nilai / perilaku                                                        |
| ------------ | ----------------------------------------------------------------------- |
| Board        | 7×7, 49 tile, satu dungeon bersama.                                     |
| Indeks       | `i = 7*y + x`; bukan urutan gambar di layar.                            |
| START / EXIT | 0 / 48, selalu floor dan tidak editable.                                |
| Tile         | Floor dapat dilewati; wall tidak dapat dilewati.                        |
| Batas        | Maksimum 96 gerakan legal per run.                                      |
| Revisit      | Boleh kembali ke tile sebelumnya.                                       |
| Illegal move | Tidak mengubah posisi atau menambah path.                               |
| Escape       | Harus mencapai EXIT pada langkah terakhir path.                         |
| Edit         | Tepat satu editable tile ditoggle setelah local escape.                 |
| Solvability  | Hasil toggle harus mempunyai setidaknya satu jalur START→EXIT.          |
| Snapshot     | Peta run tetap; live updates tidak mengganti papan run.                 |
| Commit       | Menyelesaikan peta lama dan mengusulkan edit terhadap revisi yang sama. |
| Confirmation | Mengikuti receipt/event/linkage verification yang sudah ada.            |

Ukuran 7×7 adalah keputusan produk/kontrak, bukan keterbatasan Phaser. Tema atau animasi tidak mengubah hak edit maupun bukti path.

## 7. Alur utama

### 7.1 Membuka game

1. React menampilkan area game, state loading, dan petunjuk singkat.
2. Relay menyediakan run snapshot, dari practice atau deployment yang dikonfigurasi.
3. Phaser memuat aset kritis dan menggambar snapshot itu.
4. Board menandai readiness; input aktif ketika board memiliki fokus dan run mengizinkan.
5. Pemain melihat START, karakter, EXIT, jumlah langkah, dan status lingkungan.

Tidak ada auto-connect wallet atau permintaan signature di alur ini.

### 7.2 Berjalan

1. Satu input valid dipetakan ke U/R/D/L.
2. Relay/rules memutuskan gerakan legal dan langsung memperbarui run.
3. Scene menginterpolasi karakter menuju posisi tersebut; logika tidak menunggu tween.
4. Jika input ditolak, posisi dan langkah tetap; feedback pendek menunjukkan alasan benturan.
5. Saat mencapai EXIT, pergerakan logis berhenti dan editor dapat digunakan.

### 7.3 Memilih edit

1. Tile yang termasuk mask diberi penanda yang tidak hanya memakai warna.
2. Klik diamond atau tombol tile di DOM memilih indeks yang sama.
3. Pilihan menampilkan ghost wall atau ghost floor di atas snapshot asli.
4. Rules menghitung candidate mask dan solvability; UI menampilkan hasil dengan teks.
5. Pilihan baru menggantikan draft sebelumnya; tidak menumpuk beberapa edit.
6. Membatalkan draft atau restart tidak mengubah live dungeon.

### 7.4 Mengajukan kontribusi

Gunakan flow prepare → simulation/estimate → review → sign yang sudah ada. Animasi pending harus tetap terlihat sebagai draft. Signing, pending, unknown dan syncing mengunci aksi yang mengubah run/attempt. Hanya observer authoritative yang dapat menghasilkan confirmed mutation.

Sesudah confirmed, tampilkan dampak kontribusi pada layer presentasi dan revisi kontribusi. Run snapshot lama tetap mempunyai identitasnya. Peralihan ke peta terbaru dilakukan melalui **Play latest**, bukan mengubah snapshot diam-diam.

## 8. Kebutuhan fungsional

| ID    | Requirement                          | Acceptance yang dapat diperiksa                                              |
| ----- | ------------------------------------ | ---------------------------------------------------------------------------- |
| FR-01 | Engine Phaser 4 exact stable.        | Lockfile dan runtime evidence menunjukkan versi yang sama.                   |
| FR-02 | Render 49 posisi floor.              | Setiap indeks 0–48 mempunyai pusat dan diamond yang berbeda.                 |
| FR-03 | POV SW→NE.                           | Label world/view, visible faces dan corners cocok dengan spesifikasi kamera. |
| FR-04 | Mask sesuai snapshot.                | Wall tile 1 di seed terlihat wall; tile 7 terlihat floor; semua 49 dicek.    |
| FR-05 | START/EXIT jelas.                    | Tetap terlihat pada ukuran desktop target dan tidak dapat diedit.            |
| FR-06 | Gerakan legal melalui rules.         | Fixture A/B menghasilkan posisi, panjang, dan packed path yang identik.      |
| FR-07 | Tidak ada input ganda.               | Satu DOM key event tidak pernah menghasilkan dua langkah.                    |
| FR-08 | Animasi tidak menahan domain.        | Input cepat dan frame pause tidak menghilangkan langkah legal.               |
| FR-09 | Edit langsung di board.              | Klik tile 31 dan tombol DOM Tile 31 memilih draft yang sama.                 |
| FR-10 | Preview lokal.                       | Tile 8 seed invalid; tile 15 dan 31 valid.                                   |
| FR-11 | Snapshot/live terpisah.              | Polling live tidak mengganti mask, posisi atau path run.                     |
| FR-12 | Lock attempt dipatuhi.               | Scene dan DOM tidak mengubah run/draft selama unresolved.                    |
| FR-13 | Konfirmasi jujur.                    | Tidak ada success permanen berdasarkan tween, hash saja atau timer.          |
| FR-14 | Recovery tetap berfungsi.            | Reload, replacement, reorg dan multi-tab memenuhi suite existing.            |
| FR-15 | Karakter tidak hilang di balik wall. | Occlusion treatment aktif pada posisi uji yang ditentukan.                   |
| FR-16 | Lifecycle aman.                      | Mount/unmount tidak menggandakan canvas, listener, atau audio.               |
| FR-17 | Fallback kegagalan aset.             | Error dapat dibaca dan retry aman; state run/attempt tidak dihapus.          |
| FR-18 | Akses keyboard dan DOM.              | Semua pilihan edit dan tombol kritis tersedia di luar canvas.                |
| FR-19 | Mode visual ringan.                  | Reduced motion tetap menampilkan state akhir yang sama.                      |
| FR-20 | Aset berlisensi dan konsisten.       | Manifest/provenance lengkap sebelum publikasi aset.                          |

## 9. Kebutuhan kualitas dan anggaran awal

Angka berikut adalah **target usulan**, bukan hasil pengukuran atau janji untuk semua perangkat.

| Aspek            | Target awal                                                 | Metode                                                                |
| ---------------- | ----------------------------------------------------------- | --------------------------------------------------------------------- |
| Kelancaran       | Target 60 FPS; p95 frame time ≤20 ms pada laptop referensi. | Rekam 60 detik berjalan dan preview setelah warm-up.                  |
| Respons          | Feedback input p95 ≤100 ms; tween langkah awal 120 ms.      | Timestamp input→perubahan visual pertama, bukan durasi selesai tween. |
| First playable   | ≤15 detik pada profil jaringan/perangkat yang dicatat.      | Cold load sampai board ready dan input pertama diterima.              |
| Asset kritis     | ≤2 MiB transfer total, di luar bundle JS dan font.          | Network panel pada cold load.                                         |
| Audio opsional   | ≤1 MiB transfer; tidak menghalangi board ready.             | Pemuatan lazy dan catatan network.                                    |
| Canvas           | Satu instance aktif; tidak tumbuh setelah 10 remount.       | DOM, listener counter saat diagnosis, dan memory trend.               |
| Layout desktop   | 1280×720 dan 1440×900; semua 49 tile terlihat.              | Screenshot dan inspeksi.                                              |
| Mobile spectator | 375×812; tanpa horizontal page overflow.                    | Screenshot dan pemeriksaan navigasi.                                  |
| Keterbacaan      | Semua status kritis disertai teks/ikon, bukan warna saja.   | Checklist aksesibilitas.                                              |

Reference hardware, browser, DPR, power mode, network dan efek aktif wajib dicatat sebelum mengevaluasi target. Bila gagal, kurangi efek sebelum mengubah aturan puzzle.

## 10. Skenario buruk yang harus dipahami pengguna

- Peta berubah saat bermain: run boleh diteruskan sebagai latihan, commit stale tidak tersedia.
- Wallet menolak: kembali ke editor, tanpa animasi sukses kontribusi.
- Receipt belum diketahui: tampilkan pemeriksaan status, jangan membuka edit baru.
- Konfirmasi terkena reorg: tarik success dan effect kontribusi; jangan membalik history authoritative sendiri.
- Texture gagal: tampilkan fallback yang membedakan wall/floor atau error; jangan memalsukan board ready.
- WebGL gagal: tampilkan pesan dan pilihan retry; DOM status/recovery tetap dapat dibaca.

## 11. Evaluasi pengguna

Usulan uji awal: 5 orang, tanpa instruksi langsung selain teks dalam game. Sampel ini untuk diagnosis, bukan bukti statistik atau traction.

Amati: apakah mereka tahu karakter dan tujuan; memahami arah tombol; mengenali wall/floor; menemukan pilihan edit; memahami beda local escape dan confirmed mutation. Catat kebingungan, salah klik, wall occlusion dan reaksi terhadap preview.

Target eksploratif: sedikitnya 4 dari 5 dapat menjelaskan loop solve→edit dengan kata sendiri. Jika gagal, perbaiki keterbacaan/onboarding sebelum menambah mekanik baru.

## 12. Definition of done

- Semua requirement P0 memiliki bukti di test plan.
- Kamera dan gaya aset telah dievaluasi pada blockout/style sample.
- Fixture A/B, mask, posisi, codec dan editor identik dengan baseline rules.
- Full suite existing dijalankan pada commit final; hasil historis tidak dipakai menggantikannya.
- Visual QA desktop dan mobile spectator selesai; kontrol keyboard dan reduced motion diperiksa.
- Tidak ada klaim deployment/test/performa yang belum dibuktikan.
- Release visual lokal dibedakan dari release Sepolia yang mempunyai gate sendiri.
