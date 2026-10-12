# Kamera, Proyeksi, Picking dan Kedalaman

> Pembaruan 11 Oktober 2026: kamera dekat lurus, arah WASD sesuai layar dan artwork v2 menggantikan bagian isometrik/pixel-art awal pada dokumen ini. Lihat [spesifikasi terkini](TOP_DOWN_UPDATE.md), [ADR-038](../docs/adr/0038-close-top-down-camera.md) dan [bukti validasi](VALIDATION_RECORD.md). Aturan domain yang tidak berubah tetap berlaku.

Status: baseline proyeksi usulan; orientasi perlu diterima melalui blockout sebelum produksi aset final.

## 1. Interpretasi POV yang diminta

Permintaan “dari kiri bawah ke kanan atas” ditafsirkan sebagai pengamat berada di sisi **barat daya / southwest (SW)** dunia dungeon, melihat menuju timur laut / northeast (NE), dengan elevasi sehingga lantai dan sisi wall terlihat.

Ini adalah orientasi pandangan. Itu **tidak otomatis berarti** START harus berada di kiri bawah layar dan EXIT di kanan atas layar. Dua hal tersebut adalah keputusan komposisi yang berbeda. Baseline di sini mempertahankan indeks domain dan memilih pandangan SW→NE; posisi endpoint di layar menjadi kiri dan kanan. Bila yang dimaksud pengguna ternyata perjalanan START kiri bawah→EXIT kanan atas, revisi komposisi pada blockout sebelum mengunci aset. Jangan menukar indeks 0 dan 48 untuk mengejar komposisi.

Render memakai gambar 2D yang diproyeksikan agar tampak mempunyai kedalaman. Kamera Phaser tetap kamera Scene2D; tidak ada kamera 3D yang benar-benar ditempatkan di ruang dunia.

## 2. Konvensi koordinat

| Ruang          | Definisi                                                    | Dipakai untuk               |
| -------------- | ----------------------------------------------------------- | --------------------------- |
| Grid logis     | `x=0..6` bertambah ke timur; `y=0..6` bertambah ke selatan. | Rules, path, mask, kontrak. |
| Indeks         | `i=7*y+x`.                                                  | Identitas tile dan event.   |
| Ruang proyeksi | Posisi pusat tile sebelum zoom/scroll kamera.               | Gambar, depth, tween.       |
| Ruang viewport | Posisi relatif canvas setelah transform kamera.             | Pointer dan layout.         |
| Ruang halaman  | CSS pixels relatif browser/document.                        | DOM dan ukuran host.        |

Nama NE/NW/SE/SW pada sprite merujuk **arah di layar**, bukan enum baru untuk kontrak. U/R/D/L tetap enum domain.

## 3. Rasio dan geometri awal

Usulan art grid: diamond **64×32 pixel**, rasio lebar:tinggi 2:1. Ini lazim disebut isometrik dalam game, secara geometris merupakan pendekatan dimetrik; jangan memakai aset dengan proyeksi berbeda lalu berharap cocok.

- `W = 64`: lebar footprint satu floor.
- `H = 32`: tinggi footprint satu floor.
- `Ox, Oy`: titik tengah papan dalam ruang proyeksi.
- `wallHeight = 36`: tinggi visual usulan di atas bidang lantai.
- Sprite boleh melebihi footprint; area collision tetap tile logis.

Ukuran dapat dituning sebelum aset final. Mengubah rasio setelah produksi wall/character biasanya membutuhkan penggambaran ulang dan penyesuaian picking.

## 4. Proyeksi baseline SW→NE

Untuk pusat tile `(x,y)`:

```text
sx = Ox + (x + y - 6) * W/2
sy = Oy + (y - x)     * H/2
```

Ini merupakan orientasi berbeda dari rumus isometrik umum `sx=(x-y)*W/2, sy=(x+y)*H/2`. Jangan mencampur kedua rumus pada rendering, pointer atau depth.

| Tile / koordinat | Posisi relatif `(Ox,Oy)` saat W=64,H=32 | Posisi layar       |
| ---------------- | --------------------------------------- | ------------------ |
| 0 / (0,0)        | (-192, 0)                               | Kiri, START.       |
| 6 / (6,0)        | (0, -96)                                | Sudut jauh/atas.   |
| 24 / (3,3)       | (0, 0)                                  | Tengah.            |
| 42 / (0,6)       | (0, 96)                                 | Sudut dekat/bawah. |
| 48 / (6,6)       | (192, 0)                                | Kanan, EXIT.       |
| 31 / (3,4)       | (32, 16)                                | Target fixture A.  |
| 38 / (3,5)       | (64, 32)                                | Target fixture B.  |

Blockout harus menampilkan label indeks, panah world north, panah pandangan SW→NE, serta label START/EXIT. Jangan menyetujui sudut dari screenshot dekoratif tanpa penanda arah.

## 5. Arah input dan orientasi sprite

| Input          | Direction domain | Perubahan grid | Perubahan layar | Facing sprite |
| -------------- | ---------------- | -------------- | --------------- | ------------- |
| W / ArrowUp    | U                | (0,-1)         | (-W/2,-H/2)     | NW            |
| D / ArrowRight | R                | (+1,0)         | (+W/2,-H/2)     | NE            |
| S / ArrowDown  | D                | (0,+1)         | (+W/2,+H/2)     | SE            |
| A / ArrowLeft  | L                | (-1,0)         | (-W/2,+H/2)     | SW            |

W bergerak ke kiri atas layar dalam baseline ini. Petunjuk kontrol harus menggambarkan hubungan tersebut. Jangan diam-diam mengganti arrow keys menjadi arah layar karena path fixture dan arti kontrol existing akan berubah.

Jika uji pengguna menunjukkan mapping sulit dipahami, alternatif pemetaan perlu dicatat sebagai keputusan terpisah, dengan update petunjuk dan pengujian. Penyimpanan arah domain tidak boleh ikut berubah hanya karena layout keyboard berubah.

## 6. Bentuk diamond dan batas papan

Diamond tile berpusat `(sx,sy)` dengan empat vertex:

```text
top    = (sx,       sy-H/2)
right  = (sx+W/2,   sy)
bottom = (sx,       sy+H/2)
left   = (sx-W/2,   sy)
```

Total lantai 7×7 menempati bounding box `7*W × 7*H` = **448×224 pixel** sebelum wall, pintu dan dekorasi. Mengukur hanya pusat corner menghasilkan 384×192 dan akan memotong tepian setengah tile; gunakan vertex footprint.

Envelope awal di atas lantai: 64 pixel untuk aset tertinggi; di bawah lantai: 24 pixel untuk ketebalan slab; margin aman semua sisi: 24 pixel. Hitung bounds nyata dari aset yang sudah dimuat sebelum camera fit. EXIT glow dan sprite tinggi harus masuk bounds atau mendapat padding tambahan.

## 7. Kamera dan layout

- Kamera tetap selama run; tidak mengikuti langkah karakter pada board kecil.
- Tidak ada rotasi/pan otomatis P0.
- Fit seluruh scene envelope ke host; jangan memotong corner saat viewport berubah.
- Area game usulan: logical viewport 640×420, disesuaikan dengan layout actual.
- Zoom fit: `min(availableWidth/boundsWidth, availableHeight/boundsHeight)` setelah padding.
- Untuk pixel art pada desktop, pilih pembesaran integer jika muat. Downscale pecahan dibolehkan untuk mobile spectator; inspeksi keterbacaan dan aliasing.
- Resize hanya mengubah transform/presentasi; tidak mengganti snapshot atau run.
- UI HTML berada di luar world transform sehingga teks tidak ikut miring.
- Jangan memakai CSS rotate pada canvas sebagai pengganti proyeksi.

Default pointer mapping harus memakai transform kamera yang sama dengan render. Jika browser zoom atau DPR berubah, CSS coordinate tidak boleh langsung dianggap world coordinate.

## 8. Inverse projection dan pointer picking

Langkah algoritme usulan:

1. Konversi pointer dari canvas/viewport ke ruang proyeksi melalui inverse transform kamera.
2. Definisikan `q=(px-Ox)/(W/2)+6`, `r=(py-Oy)/(H/2)`.
3. Hitung `xf=(q-r)/2`, `yf=(q+r)/2`.
4. Evaluasi kandidat integer di sekitar `(xf,yf)`, bukan memakai bounding rectangle sprite wall.
5. Untuk masing-masing kandidat, lakukan containment diamond:
   `abs(px-sx)/(W/2) + abs(py-sy)/(H/2) <= 1` dengan epsilon kecil numerik.
6. Buang kandidat di luar `0..6`, lalu tie-break dengan indeks terkecil pada shared edge/vertex.
7. Kembalikan indeks; domain memeriksa fase run, mask, lock dan legalitas edit.

Tidak ada pilihan jika pointer di luar union diamond board. Klik backdrop, slab edge atau bagian wall yang menjulang tidak boleh otomatis memilih tile tetangga. P0 memakai **footprint lantai** sebagai hit target; bila kelak sisi/top wall ingin clickable, tambahkan polygon hit geometry terpisah dan uji tumpang-tindih.

Dasar wall yang dipilih harus disorot agar pemain memahami area klik. Daftar tile DOM selalu menjadi alternatif jika wall footprint sulit ditunjuk.

Picking diuji setelah resize, kamera zoom, device DPR 1/2, dan browser zoom. Hover tidak mengubah draft; klik/Enter pada kontrol editor yang mengubah draft.

## 9. Urutan gambar dan depth

Urutan besar:

1. Backdrop dan slab bawah.
2. Semua floor dan ground decal.
3. Wall, pintu dan karakter yang dapat saling menutupi.
4. Selection outline/ghost yang sesuai kebutuhan keterbacaan.
5. Screen-space label dan HUD HTML.

Pada kelompok ketiga, urutkan berdasarkan **posisi kaki/basis di layar**, bukan index tile atau tinggi bitmap. Baseline comparator: `(groundY, tiePriority, tileIndex/stableId)`. Angka tiePriority hanya memecahkan groundY yang sama; jangan membuat semua wall selalu di depan karakter.

Pada proyeksi ini `groundY ∝ y-x`. Penggunaan `x+y` sebagai depth dari rumus lain akan salah. Karakter yang bergerak memakai groundY hasil interpolasi untuk sorting visual; posisi logis tetap di relay.

Hindari Container besar yang mengurung semua wall jika karakter perlu tersisip di antaranya. Aset wall tinggi yang melintasi banyak footprint memerlukan split cap/face atau pengujian occlusion tambahan; tidak diasumsikan selesai hanya dengan `setDepth`.

## 10. Occlusion dan cutaway

Masalah: wall dekat kamera bisa menutup karakter atau target edit.

Baseline usulan:

- P0 mengutamakan wall rendah/modular dengan tinggi konsisten.
- Jika polygon wall menutupi area kepala/tubuh karakter, render wall itu pada alpha sekitar 0.35.
- Alpha berubah melalui fade 80 ms; reduced motion mengubah langsung.
- Saat wall transparan, footprint dan outline tetap menunjukkan bahwa tile tidak dapat dilewati.
- Selection outline digambar setelah wall agar target tetap terbaca.
- Pulihkan opacity ketika tidak lagi menghalangi; jangan menyimpan alpha ke state domain.
- Sistem juga memeriksa overlap pada gerakan antar-tile, bukan hanya setelah sprite berhenti.

Jangan menurunkan seluruh wall di dunia hanya karena satu wall menutupi karakter. Evaluasi beberapa kandidat yang secara visual berada di depan pemain. Definisi overlap didasarkan polygon/rect sprite yang terukur; detail implementasi diverifikasi pada spike M2.

## 11. Preview dan snapshot

Board dasar selalu menampilkan `run.snapshot.walls`. Preview adalah layer terpisah untuk candidate edit. Ghost tidak mengubah collision atau snapshot.

Confirmed contribution effect juga merupakan layer berlabel hasil kontribusi. Jika live telah berubah lagi, jangan menggunakan efek untuk menyatakan kandidat sebagai live. **Play latest** mengganti base board secara atomik dan membersihkan layer run/draft lama.

## 12. Acceptance kamera

- Semua 49 pusat dapat diproyeksikan lalu dipilih kembali ke indeks yang sama.
- Corner dan titik fixture 31/38 cocok tabel proyeksi.
- Kontrol mengikuti tabel: W=U, D=R, S=D, A=L; facing cocok arah layar.
- START/EXIT dan wall tinggi tidak terpotong pada viewport target.
- Karakter tetap teridentifikasi di belakang wall tanpa mengubah collision.
- Outline tile mengikuti diamond, termasuk setelah resize/zoom.
- Permintaan arah kamera dinilai melalui blockout; keputusan seni final tidak dipalsukan dari asumsi.
