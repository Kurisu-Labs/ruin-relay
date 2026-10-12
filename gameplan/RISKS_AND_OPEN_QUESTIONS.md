# Risiko, Asumsi dan Keputusan Terbuka

Status: daftar aktif untuk perencanaan. Tidak ada jawaban pengguna yang diinventarisasi secara fiktif.

## 1. Asumsi baseline

| ID | Asumsi | Dasar | Dampak jika berubah |
|---|---|---|---|
| A-01 | Aturan 7×7 existing dipertahankan. | Permintaan berfokus engine/POV/aset; root scope. | ADR, fixture dan deployment baru jika aturan berubah. |
| A-02 | POV dimaksud adalah pengamat di SW menghadap NE. | Uraian pengguna tentang sudut kiri bawah. | Proyeksi dan art framing perlu revisi pada blockout. |
| A-03 | Pixel art 2:1 menjadi baseline usulan. | Rekomendasi percakapan, belum dipilih pengguna. | Ganti style spec sebelum produksi final. |
| A-04 | Kamera tetap dan seluruh board terlihat. | Papan kecil dan kebutuhan menilai jalur. | Camera/picking/occlusion QA meluas jika ada pan/rotate. |
| A-05 | Desktop keyboard P0, mobile spectator. | ADR-027 existing. | Touch controls menambah UX/test scope. |
| A-06 | Existing wallet/journal direuse. | Pengembangan visual tidak mengubah transaksi. | Audit boundary dan regressions lebih besar jika rewrite diperlukan. |

## 2. Risk register

| ID | Risiko | Dampak | Mitigasi | Bukti / pemicu tindakan |
|---|---|---|---|---|
| R-01 | Interpretasi kamera berbeda dari keinginan pengguna. | Art dibuat dengan orientasi yang salah. | Blockout dengan world axes, corner dan arrow view. | Review sebelum GP-12. |
| R-02 | Forward/inverse projection berbeda. | Klik memilih tile salah; kontribusi tidak sesuai niat. | Satu projection boundary, independent expected coordinates. | GEO P0; blocker jika mismatch. |
| R-03 | Animasi menghilangkan/menggandakan langkah. | Path invalid atau karakter berbeda dari HUD. | Domain-first movement, dedupe event, queue bounded. | IN-03–07. |
| R-04 | Wall menutupi karakter/target. | Pemain tersesat atau salah edit. | Wall height rendah, depth by foot, cutaway, DOM alternative. | VIS-03/04 dan playtest. |
| R-05 | Asset style/projection/pivot tidak konsisten. | Sprite mengambang, seam dan depth salah. | Style sample terintegrasi sebelum bulk production. | ASSET acceptance. |
| R-06 | Phaser 4 API berbeda dari docs yang dibaca. | Build/runtime failure. | Pin exact, inspect package types/source, version spike. | M1 exit criteria. |
| R-07 | Rendering remount membuka lock/mereset journal. | Duplicate submission dan recovery hilang. | Scene tidak memiliki authority attempt. | TX-07/11/12. |
| R-08 | Draft/animation terlihat seperti confirmed mutation. | Pemain mengira perubahan sudah tersimpan. | Ghost label, status DOM, cue dari observer saja. | TX-03–06. |
| R-09 | Aset/bundle terlalu berat pada laptop target. | Loading lambat, FPS drop. | Lazy import, compressed budgets, baked light, kurangi efek. | PERF measurements. |
| R-10 | Pemain sulit memahami kontrol diagonal. | Input salah dan onboarding gagal. | Diamond control legend, playtest mapping. | D3 dan observasi tester. |
| R-11 | Aset tidak berlisensi untuk distribusi repo. | Tidak dapat dipublikasikan/digunakan. | Provenance dan credits perasal; placeholder asli sementara. | Publication gate asset. |
| R-12 | Game tetap terlalu sederhana meskipun visual bagus. | Pemain tidak kembali. | Uji run kedua dan kualitas keputusan edit; jangan mengklaim retention. | Playtest; fitur baru butuh rancangan terpisah. |
| R-13 | Satu live dungeon cepat berubah ketika ramai. | Banyak stale run, kontribusi sulit. | Snapshot jujur, Play latest, catat contention. | Bukan diselesaikan dengan perubahan renderer. |
| R-14 | Dokumen proposed dibaca sebagai accepted. | Implementer mengabaikan aturan repo. | Status eksplisit, calon nomor ADR dan adoption procedure. | Review PRD/ADR sebelum implementasi. |

## 3. Pertanyaan yang perlu diputuskan pada milestone

| ID | Pertanyaan | Usulan default | Batas keputusan |
|---|---|---|---|
| OQ-01 | POV SW→NE atau posisi START kiri bawah/EXIT kanan atas? | POV SW→NE; endpoint mengikuti proyeksi indeks existing. | Sebelum art final. |
| OQ-02 | Pixel art atau ilustrasi halus? | Pixel art 64×32, karakter 48×64. | Sebelum bulk asset production. |
| OQ-03 | Wall rendah atau tinggi dengan cutaway lebih kuat? | Tinggi visual 36 px, alpha treatment terukur. | Style sample/occlusion test. |
| OQ-04 | Karakter penjelajah berlentera sesuai selera? | Jubah pendek, tanpa senjata/combat affordance. | Style sample. |
| OQ-05 | Mapping keyboard canonical terasa nyaman? | Pertahankan U/R/D/L existing dengan legend diamond. | Playable playtest. |
| OQ-06 | Hardware/browser minimum yang benar-benar diuji? | Satu laptop referensi; Chrome/Firefox desktop. | Sebelum performance acceptance. |
| OQ-07 | Audio dibutuhkan pada release visual pertama? | P1, muted default, tidak memblokir inti. | M6 scope. |
| OQ-08 | Metode produksi art: manual, AI-assisted, atau paket berlisensi? | Pilih berdasarkan konsistensi/provenance; belum diputuskan. | Sebelum GP-12. |
| OQ-09 | Touch play dibutuhkan sekarang? | Tetap P1 sesuai ADR-027. | Scope review tersendiri. |

Pertanyaan ini tidak menghalangi paket dokumentasi atau engine spike. Jangan menandai jawaban sebagai disetujui hanya karena ada default usulan.

## 4. Masalah desain di luar pengembangan visual

Reversibility edit, bot solver, public path, satu board contention dan tidak adanya kesulitan minimum adalah sifat aturan existing. Kamera/aset tidak menghapusnya. Jika playtest menuntut seasons, cooldown atau banyak dungeon, buat PRD/amendment terpisah, evaluasi kontrak dan versioning. Jangan menyelundupkan perubahan tersebut melalui “polish game”.

## 5. Decision log

| Tanggal | Keputusan | Status | Bukti |
|---|---|---|---|
| 2026-10-10 | Pengguna meminta Phaser 4, POV miring kiri bawah→kanan atas dan aset dungeon. | Requested. | Percakapan sumber paket. |
| 2026-10-10 | Paket dokumentasi terpisah di `gameplan/`. | Authorized dan dibuat. | Permintaan pengguna saat ini. |
| 2026-10-10 | Pixel art, proyeksi numerik, ukuran/pivot dan kamera tetap. | Proposed. | Dokumen paket; belum keputusan seni final. |
| — | Penerimaan blockout/style sample. | Pending. | Belum dibuat/diperiksa. |
| — | Exact Phaser 4 dan compatibility tests. | Pending. | Spike implementasi belum dijalankan. |
