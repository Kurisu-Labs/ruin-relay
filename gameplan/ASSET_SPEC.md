# Spesifikasi Produksi dan Integrasi Aset

> Pembaruan 11 Oktober 2026: kamera dekat lurus, arah WASD sesuai layar dan artwork v2 menggantikan bagian isometrik/pixel-art awal pada dokumen ini. Lihat [spesifikasi terkini](TOP_DOWN_UPDATE.md), [ADR-038](../docs/adr/0038-close-top-down-camera.md) dan [bukti validasi](VALIDATION_RECORD.md). Aturan domain yang tidak berubah tetap berlaku.

Status: daftar kebutuhan; **belum ada aset baru yang dibuat oleh paket ini**. Dimensi berikut adalah baseline usulan yang dikunci setelah blockout/style sample.

## 1. Struktur paket aset yang direncanakan

```text
art-source/ruin-relay/       # sumber yang dapat diedit, jika lisensi mengizinkan
  tiles/
  character/
  effects/
  audio/
public/assets/game/v1/
  dungeon.png               # atlas texture
  dungeon.json              # atlas frame metadata
  character.png
  character.json
  effects.png
  effects.json
  audio/
  manifest.json
  credits.md
```

Path tersebut adalah proposal untuk implementasi, belum dibuat. Sumber berukuran besar dapat disimpan melalui kebijakan repo tersendiri; jangan menambahkan Git LFS atau layanan eksternal secara otomatis.

## 2. Kontrak geometri

| Jenis              | Canvas frame | Anchor/pivot pixel | Isi utama                                                        |
| ------------------ | ------------ | ------------------ | ---------------------------------------------------------------- |
| Floor              | 64×32        | (32,16)            | Diamond pusat tile.                                              |
| Wall               | 64×80        | (32,64)            | Basis ground diamond berpusat di anchor, top naik 36 px.         |
| START              | 64×64        | (32,48)            | Tangga/marker; ground footprint berpusat di anchor.              |
| EXIT               | 64×96        | (32,80)            | Gerbang dan rune; maksimum 64 px di atas anchor.                 |
| Karakter           | 48×64        | (24,56)            | Titik kontak kaki; padding bawah 8 px.                           |
| Bayangan karakter  | 32×16        | (16,8)             | Ellipse di ground center.                                        |
| Build/break effect | 96×96        | (48,64)            | Pusat kontak ground; boleh overlap tile sekitar secara kosmetik. |

Wall frame menyediakan ruang ground diamond sampai y=80. Tinggi block dan pivot tidak boleh disimpulkan dari bounding box alpha karena tiap texture dapat memiliki detail berbeda. Metadata anchor harus dipakai setelah trimming atlas; hindari setting origin yang berubah antarframe.

P0 semua wall punya footprint 64×32. Dekorasi besar atau objek yang menempati beberapa kotak tidak ditambahkan ke grid gameplay.

## 3. Daftar kebutuhan P0

| ID    | Frame / key                    | Jumlah | Ukuran/frame | Kebutuhan                                             |
| ----- | ------------------------------ | ------ | ------------ | ----------------------------------------------------- |
| AS-01 | `floor/stone-01..03`           | 3      | 64×32        | Bersih, retak, sedikit moss; aturan sama.             |
| AS-02 | `wall/stone-01..02`            | 2      | 64×80        | Volume konsisten, shading dua face.                   |
| AS-03 | `endpoint/start`               | 1      | 64×64        | Tangga/marker bisa diinjak.                           |
| AS-04 | `endpoint/exit`                | 1      | 64×96        | Gerbang terbuka; tidak menyiratkan kebutuhan kunci.   |
| AS-05 | `player/idle/{facing}/{frame}` | 16     | 48×64        | 4 facing × 4 frame.                                   |
| AS-06 | `player/walk/{facing}/{frame}` | 24     | 48×64        | 4 facing × 6 frame.                                   |
| AS-07 | `player/shadow`                | 1      | 32×16        | Terpisah dari tubuh.                                  |
| AS-08 | `fx/build/{frame}`             | 8      | 96×96        | Batu menyusun diri; final wall berasal dari renderer. |
| AS-09 | `fx/break/{frame}`             | 8      | 96×96        | Debu/pecahan; final floor berasal dari renderer.      |

Total awal: **64 frame raster**. Floor/wall variant dipilih deterministic, bukan random setiap redraw. Frame effect boleh dikurangi pada first playable; final P0 tetap membutuhkan dampak edit yang jelas, walau implementasinya memakai efek prosedural sederhana sebagai pengganti raster yang disepakati.

AS-08/09 adalah usulan produksi final, bukan syarat untuk memulai migrasi. Jangan menunggu semua 64 frame sebelum membuat blockout.

## 4. Elemen prosedural P0

| ID    | Elemen                                        | Alasan tidak harus bitmap                                    |
| ----- | --------------------------------------------- | ------------------------------------------------------------ |
| AS-10 | Outline diamond normal/hover/selected/invalid | Mengikuti proyeksi dan resize dengan tepat.                  |
| AS-11 | Ghost tint dan ikon wall↔floor                | Konsisten dengan tile source, menghindari duplikasi texture. |
| AS-12 | Focus indicator dan hit footprint debug       | Dapat diukur dari geometri.                                  |
| AS-13 | Slab edge sederhana                           | Dihasilkan dari batas board; bukan lukisan peta tetap.       |
| AS-14 | Backdrop gradient/vignette ringan             | Tidak perlu texture besar.                                   |

Ikon dan teks status kritis berada di HTML/SVG/code jika lebih tepat. Jangan menghasilkan bitmap untuk teks yang perlu dibaca, diterjemahkan, atau disesuaikan aksesibilitasnya.

## 5. Aset P1

| ID    | Aset                           | Budget awal                          |
| ----- | ------------------------------ | ------------------------------------ |
| AS-15 | EXIT rune pulse                | 6 frame atau animasi tint ringan.    |
| AS-16 | Moss/rubble ground decal       | 4 frame statis maksimum; area kecil. |
| AS-17 | Perimeter broken pillar/banner | 2–3 objek; tidak menutupi grid.      |
| AS-18 | Footstep stone                 | 2 variasi pendek.                    |
| AS-19 | Blocked movement               | 1 cue pendek dan pelan.              |
| AS-20 | Local escape                   | 1 cue; berbeda dari confirmation.    |
| AS-21 | Edit select / invalid          | 2 cue pendek.                        |
| AS-22 | Build / break                  | 2 cue.                               |
| AS-23 | Confirmed contribution         | 1 cue, hanya berdasarkan observer.   |
| AS-24 | Ambience loop                  | 1 loop halus; optional lazy load.    |

Audio optional: ketidakhadirannya tidak memblokir acceptance gameplay. Bila tersedia, audio harus mengikuti mute/reduced distraction serta gesture unlock browser.

## 6. Animasi karakter

Facing key: `nw`, `ne`, `se`, `sw`; bukan `up/right/down/left` karena arah visual berbeda dengan enum logis.

| Clip    | Frame                  | Kecepatan awal              | Loop                   | Catatan                                           |
| ------- | ---------------------- | --------------------------- | ---------------------- | ------------------------------------------------- |
| Idle    | 0..3                   | 4 fps                       | Ya                     | Gerak kecil, feet anchor stabil.                  |
| Walk    | 0..5                   | 10 fps                      | Ya selama tween        | Clip dipilih dari delta grid yang sudah diterima. |
| Blocked | Pakai pose idle/facing | Feedback prosedural ≤100 ms | Tidak                  | Tidak wajib clip raster baru.                     |
| Escape  | Idle + effect pintu    | Sesuai effect               | Tidak untuk cue escape | Tidak memindahkan posisi lagi.                    |

Tween per langkah 120 ms tidak harus memainkan seluruh satu siklus walk. Feet anchor harus tetap sama sehingga menghentikan clip tidak menyebabkan sliding besar. Reduced motion dapat memakai pose facing langsung tanpa walk cycle.

## 7. Alpha, atlas dan sampling

- PNG RGBA tanpa background baked; tidak ada kotak putih/hitam di luar sprite.
- Pixel art diekspor tanpa antialias blur atau resizing pecahan pada sumber.
- Atlas dapat memakai trim jika sourceSize, spriteSourceSize dan pivot dipertahankan.
- Padding awal 2 px dengan edge extrusion yang benar; cek bleeding pada zoom pecahan.
- Rotated atlas frame dimatikan pada pipeline awal agar review mudah; aktifkan hanya setelah loader diuji.
- Maksimum texture awal 2048×2048 per atlas. Jumlah atlas dievaluasi setelah pack, tidak dipaksakan satu texture untuk semua.
- Estimasi decoded RGBA untuk 2048×2048 sekitar 16 MiB per texture, sebelum overhead; ukuran PNG kecil tidak sama dengan GPU memory kecil.
- Gunakan nearest-neighbor untuk baseline pixel art; downscale mobile diperiksa secara visual.
- Jangan menambahkan normal map kecuali fitur lighting terkait dipilih dan diuji.

## 8. Manifest yang harus dihasilkan saat produksi

Manifest memuat setidaknya:

| Field        | Isi                                                            |
| ------------ | -------------------------------------------------------------- |
| `version`    | Versi paket aset, contoh `1`.                                  |
| `projection` | Nama proyeksi dan W/H, mengacu dokumen kamera.                 |
| `atlases`    | URL relatif, nama texture, hash atau versi cache.              |
| `frames`     | Key, source size, anchor pixel, status P0/P1.                  |
| `animations` | Facing, urutan frame, fps, loop.                               |
| `provenance` | Pembuat/tool/sumber, tanggal, lisensi/ketentuan, attribution.  |
| `fallbacks`  | Frame pengganti yang jelas untuk texture optional yang hilang. |

Jangan menaruh key API, prompt berisi rahasia, akun wallet privat, atau path home pribadi dalam manifest yang didistribusikan.

## 9. Proses produksi

1. Terima blockout orientasi dan ukuran footprint.
2. Buat style sample dan ekspor dengan anchor yang sama seperti target.
3. Integrasikan satu floor/wall/character sebelum membuat seluruh variasi.
4. Periksa seam, depth dan cutaway dengan seed serta tile 31/38.
5. Produksi facing dan animation sheet; periksa contact feet frame-by-frame.
6. Pack atlas dan rekam metadata.
7. Validasi key, frame count, file size, alpha dan provenance.
8. Jalankan visual regression pada build yang memuat aset final.

Jika memakai generasi gambar, hasil tetap memerlukan cleanup/penyusunan sprite. Minta hasil terpisah perjenis dengan proyeksi konsisten; jangan memakai screenshot konsep sebagai tileset. Penggunaan tool generasi pada tahap berikutnya mengikuti instruksi dan izin pekerjaan tahap tersebut.

## 10. Lisensi dan credits

Kode repo berlisensi MIT tidak otomatis membuat semua aset pihak ketiga MIT. Credits mencatat lisensi perpaket/aset, source URL yang spesifik, pembuat, perubahan, dan attribution wajib.

Tidak ada aset yang dianggap “bebas dipakai” hanya karena dapat diunduh atau ditemukan melalui pencarian. Jika ketentuan distribusi sumber/komersial belum jelas, tandai blocked untuk publikasi aset itu dan gunakan placeholder asli yang sederhana untuk pengembangan.

## 11. Penerimaan aset

- [ ] Semua key P0 terdaftar dan tidak duplikat.
- [ ] Alpha bersih pada background terang maupun gelap.
- [ ] Diamond/anchor sama antarfloor dan wall.
- [ ] Empat facing sesuai arah proyeksi, termasuk lentera dan bayangan.
- [ ] Semua animation frame mempunyai ukuran/pivot stabil.
- [ ] Tidak ada texture seam atau atlas bleeding pada zoom target.
- [ ] Wall cutaway tidak meninggalkan shadow yang tampak sebagai collision tambahan.
- [ ] Draft wall/floor berbeda dari base board yang terverifikasi.
- [ ] Budgets transfer dan texture dicatat, bukan diasumsikan.
- [ ] Provenance/lisensi/credits siap diperiksa sebelum aset dipublikasikan.
