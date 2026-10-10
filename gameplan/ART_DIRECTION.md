# Art Direction — Reruntuhan yang Dibentuk Pemain

> Pembaruan 11 Oktober 2026: kamera dekat lurus, arah WASD sesuai layar dan artwork v2 menggantikan bagian isometrik/pixel-art awal pada dokumen ini. Lihat [spesifikasi terkini](TOP_DOWN_UPDATE.md), [ADR-038](../docs/adr/0038-close-top-down-camera.md) dan [bukti validasi](VALIDATION_RECORD.md). Aturan domain yang tidak berubah tetap berlaku.

Status: tema dungeon merupakan permintaan; gaya, palet dan motif di bawah adalah usulan art baseline.

## 1. Identitas visual

Dungeon terasa tua, sunyi, dan masih menyimpan energi. Pemain menemukan sebuah ruang batu yang terus berubah satu bagian setiap kali seorang penjelajah lolos. Perubahan tampil sebagai batu yang menyusun ulang atau runtuh, mengikat tema reruntuhan dengan mekanik toggle.

Kata kunci: batu aus, retak, lumut, lentera, rune, ruang gelap, penjelajah kecil. Hindari tampilan sci-fi neon berlebihan, gore, UI casino, dan ornamen yang menutupi struktur puzzle.

Narasi ini kosmetik. Tidak menambahkan quest, item, kekuatan rune atau plot yang harus diimplementasikan.

## 2. Gaya yang direkomendasikan

**Pixel art isometrik dengan siluet sederhana**, memakai footprint 64×32 dan empat arah karakter. Gaya ini dipilih sebagai baseline produksi karena board kecil membutuhkan bentuk yang mudah dibedakan.

Alternatif yang masih sah: ilustrasi 2D hand-painted dengan proyeksi sama. Jika dipilih, ubah sampling/scaling, detail texture dan anggaran ukuran secara konsisten. Jangan mencampur floor pixel art dengan karakter ilustrasi resolusi tinggi tanpa pengolahan gaya yang disengaja.

Sebelum aset lengkap, buat satu style sample: 3 floor, 1 wall, karakter diam, START dan EXIT dalam susunan 3×3. Evaluasi di ukuran permainan nyata, bukan hanya zoom besar di editor gambar.

## 3. Bentuk dan komposisi

- Floor mempunyai diamond tegas; retakan tidak menghapus batas tile.
- Wall memakai volume batu dengan top dan dua face yang sesuai POV SW→NE.
- Slab bawah memberi ketebalan pada papan; jangan membuat jurang gameplay.
- Karakter mempunyai proporsi kepala/tubuh terbaca pada ukuran kecil.
- EXIT mempunyai siluet berbeda dari wall dan START, dengan rongga pintu jelas.
- Dekorasi tinggi ditempatkan di perimeter/noninteractive backdrop agar tidak menyembunyikan rute.
- Tidak ada atap yang menutup papan pada P0.

Jangan membuat satu lukisan dungeon utuh untuk gameplay. Setiap wall harus dapat ditambah/dihilangkan tanpa menggambar ulang seluruh papan.

## 4. Palet awal

| Peran               | Warna usulan | Penggunaan                            |
| ------------------- | ------------ | ------------------------------------- |
| Background          | `#0B1115`    | Ruang di luar papan.                  |
| Shadow batu         | `#202C30`    | Sisi gelap wall dan floor.            |
| Mid stone           | `#536465`    | Massa wall utama.                     |
| Light stone         | `#91A09A`    | Tepi/top yang menerima cahaya.        |
| Moss                | `#536E4B`    | Aksen kecil, tidak memenuhi floor.    |
| Rune / EXIT         | `#73D9C0`    | Tujuan dan energi reruntuhan.         |
| Lantern / selection | `#E9BD75`    | Karakter, draft selection.            |
| Invalid             | `#E78980`    | Outline invalid dengan ikon dan teks. |
| Teks terang         | `#EDF3EC`    | HUD; contrast harus diperiksa.        |

Warna adalah token awal, bukan hasil audit contrast. Wall/floor dibedakan juga lewat volume, pola dan outline; valid/invalid memakai simbol dan teks.

## 5. Cahaya dan bayangan

Sumber cahaya global usulan berada di kiri atas layar. Wall mempunyai highlight top/face terang dan face lain lebih gelap secara konsisten. Lentera karakter menambah aksen hangat lokal; EXIT memberi aksen teal.

P0 memakai shading baked pada sprite serta glow sederhana. Dynamic light/normal map bersifat P1 karena menambah aset, kompatibilitas, dan beban GPU. Lampu kosmetik tidak mengubah informasi peta atau aturan jalur.

Bayangan karakter dipisah dari sprite, mengikuti kaki dan tetap menempel lantai. Bayangan tidak boleh tampak seperti lubang, wall atau target edit. Jika wall cutaway aktif, visual shadow juga ditinjau agar tidak menyisakan penghalang palsu.

## 6. Lantai dan tembok

Floor awal mempunyai tiga variasi: batu bersih, retak, dan sedikit lumut. Semua memiliki footprint, pivot, nilai terang dasar dan aturan yang sama. Variasi harus deterministic untuk tile dan deployment agar polling/remount tidak membuat peta tampak berubah.

Wall awal mempunyai dua variasi texture dengan bentuk yang sama. Top cap dan face harus menyatu ketika wall bertetangga. Hindari garis gelap berulang yang membuat wall tampak berlubang saat sebenarnya tidak dapat dilewati.

Pada art pertama, gunakan wall blok mandiri. Autotiling sambungan kompleks dapat ditambahkan hanya jika blockout menunjukkan kebutuhan visual dan jumlah frame dapat diproduksi konsisten.

## 7. Karakter

Usulan: penjelajah berjubah pendek, kepala/hood jelas, tas kecil, lentera. Senjata tidak diperlukan karena game belum mempunyai combat.

- Empat facing: NW, NE, SE, SW di layar.
- Idle 4 frame, walk 6 frame per facing sebagai budget awal.
- Foot contact tidak melompat-lompat antarframe.
- Lentera tidak berpindah tangan secara tidak sengaja saat facing dibalik.
- Hindari mirror otomatis bila membuat arah cahaya atau aksesori tidak konsisten.
- Tidak menambahkan lompat/dash/attack sebagai affordance yang tidak berfungsi.

## 8. START dan EXIT

START diusulkan sebagai tangga batu pendek menuju ruangan. Tangga tetap satu floor yang bisa diinjak; tidak ada perpindahan map.

EXIT berupa gerbang terbuka dengan rune teal. Rongga pintu, glow dan marker memastikan tujuannya terlihat walau tanpa teks. Glow berhenti menjadi efek yang dominan ketika reduced motion aktif; gerbang tetap terbaca.

Kedua endpoint mempunyai label DOM/legend. Jangan menggambar pintu tertutup yang menyiratkan pemain membutuhkan kunci.

## 9. Bahasa visual edit

| Status                  | Penampilan                                                                  |
| ----------------------- | --------------------------------------------------------------------------- |
| Editable, belum dipilih | Corner marks/outline ringan saat editor aktif.                              |
| Hover                   | Outline tipis; belum mengubah draft.                                        |
| Selected valid          | Outline amber, ghost hasil, simbol perubahan.                               |
| Selected invalid        | Outline merah, ikon blokir, penjelasan jalur.                               |
| Pending / unknown       | Ghost tetap jelas sebagai draft, badge status HTML.                         |
| Confirmed contribution  | Efek build/break sekali, label revisi kontribusi.                           |
| Reorg withdrawn         | Hapus label success/effect yang masih aktif; status berubah lewat observer. |

Ghost wall tidak memakai opaque texture identik wall resmi. Ghost floor menandai bagian wall yang akan hilang tanpa menyembunyikan fakta bahwa snapshot asal masih wall.

## 10. Dekorasi dan suasana

Dekorasi P1: lumut kecil, pecahan batu rata, banner rusak di perimeter, pilar patah di luar grid. Tombak, peti besar dan tumpukan rubble tinggi pada floor dihindari karena menyiratkan collision atau interaksi tambahan.

Animasi ambience dibatasi: api lentera, rune pelan, debu jarang. Tidak ada hujan partikel yang mengganggu pemilihan tile. Reduced motion mematikan partikel/dekorasi bergerak; game tetap mempunyai state yang sama.

## 11. Kebutuhan produksi dan originalitas

Gunakan desain asli atau aset dengan lisensi yang jelas dan kompatibel dengan distribusi repo. Referensi boleh membantu memahami proyeksi, tetapi tidak menyalin karakter/tileset game lain.

Jika memakai AI pada tahap berikutnya, hasil konsep perlu dipisahkan menjadi tile/sprite dengan alpha bersih, pivot yang benar dan frame konsisten. Satu gambar konsep tidak memenuhi asset spec. Catat tool, asal, penyuntingan, ketentuan penggunaan dan attribution yang diperlukan. Jangan menyatakan eksklusivitas hak cipta tanpa dasar.

## 12. Kriteria review style sample

- Bisa membedakan floor/wall dari siluet dan volume tanpa warna.
- Karakter terlihat pada floor terang, gelap, dan di belakang wall cutaway.
- Keempat facing sesuai tabel kontrol kamera.
- EXIT dikenali sebelum melihat HUD.
- Pixel scale dan pencahayaan konsisten antarasset.
- Tile dapat ditoggle tanpa meninggalkan jahitan, lubang alpha atau dekorasi menggantung.
- Tidak ada teks baked yang perlu diterjemahkan di texture.
- Style sample belum dianggap aset final sampai lolos format/pivot dan lisensi pada [asset spec](ASSET_SPEC.md).
