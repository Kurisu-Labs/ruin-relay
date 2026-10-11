# Dungeon 3D — Ruin Relay

Tanggal: 11 Oktober 2026. Renderer utama di `src/game3d/`; keputusan aktif: [ADR-042](../docs/adr/0042-threejs-only-dungeon.md), menggantikan dua renderer pada ADR-041.

## Cara mencoba dan batas scope

Jalankan `npm run dev`, buka `http://127.0.0.1:5173/`, lalu pilih **Play without a wallet**. Alamat langsung: `/play`; `/play/3d` tetap berfungsi dan dinormalisasi tanpa reload. **Home** kembali ke beranda dan **Resume your run** mempertahankan Run, tile terpilih dan unsigned preview. Tidak ada lagi pilihan 2D. Source, dependency dan aset Phaser dihapus setelah backup diverifikasi; [catatan migrasi](RENDERER_MIGRATION.md) memuat cara pemulihan.

Versi ini menerapkan perspektif orang pertama untuk dungeon yang sama: satu papan 7×7, START=0, EXIT=48, 96 langkah maksimum, satu edit yang diizinkan setelah escape. Tidak ada monster, combat, loot, inventory, rewards, token atau level tambahan. Keep Out menjadi referensi pengalaman ruang dan eksplorasi, bukan sumber file, model atau kode.

| Kontrol 3D       | Perilaku                                                      |
| ---------------- | ------------------------------------------------------------- |
| W / ↑            | Maju satu tile mengikuti arah pandang.                        |
| S / ↓            | Mundur satu tile.                                             |
| A / ←            | Bergeser satu tile ke kiri tanpa mengubah arah pandang.       |
| D / →            | Bergeser satu tile ke kanan tanpa mengubah arah pandang.      |
| Q / E            | Berputar 90° kiri/kanan, tanpa menambah langkah.              |
| R / Restart      | Mulai lagi pada snapshot yang sama.                           |
| Enam tombol dock | Intent identik melalui mouse/sentuh, target persegi 44–48 px. |

Heading awal selatan, menghadap koridor terbuka dari START. Heading kembali ke selatan setelah restart atau memasuki ulang view. Keyboard hanya berlaku ketika area game fokus; shortcut browser, key-repeat dan komposisi IME diabaikan. Tidak ada pointer lock atau gerakan otomatis ketika tombol ditahan. Turn disimpan langsung sebelum intent berikutnya sehingga input beruntun Q→W memakai arah yang baru. Menu menjelaskan kontrol gerak dan putaran.

## Tampilan dan edit

Kamera berada setinggi mata di tengah tile. Perpindahan sah dianimasikan sepanjang ruas grid; putaran memakai interpolasi sudut. Tidak ada head bob. Input diterima Relay sebelum animasi, dengan antrean visual dibatasi agar input cepat tidak tertinggal panjang. Reduced motion menghapus interpolasi, flicker dan feedback flash. Reduced motion dan overview merender hanya setelah input, perubahan selection, resize atau perubahan visibility; tidak ada RAF berulang ketika scene statis. Animasi biasa tetap berjalan selama view aktif. Scene berhenti merender ketika tab tersembunyi; kembali ke tab menyelaraskan kamera dengan Run terbaru.

World memakai stone courses dengan bevel, variasi warna batu, mortar dan slab lantai yang bertekstur. Pembaruan artwork menambahkan ceruk berdinding belakang dengan relief kompas, rusuk lengkung di langit-langit, kain berjuntai dengan lipatan dan ujung usang, akar serta ivy jarang, pecahan batu di tepi lorong, dan bercak lembap. Sconce mempunyai dudukan melengkung, mangkuk besi berongga, bibir kuningan dan nyala berprofil lengkung. Gerbang EXIT memakai susunan batu lengkung dan glyph teal yang tertanam; orientasi diagonal membuatnya terlihat dari kedua arah masuk.

Dua DataTexture 256×256 yang dibuat dari kode memberi grain, pori, retakan, albedo dan bump/roughness; keduanya shared, tanpa file gambar atau unduhan. Lipatan dan motif kain dibuat dari geometri dan vertex colors, tanpa texture tambahan. Sconce pertama berada di dekat tile 7 agar terlihat dari lorong awal. Ceruk dan kain hanya berada di tembok permanen/perimeter; tembok editable tetap batu biasa sehingga penghapusan wall tidak meninggalkan ornamen melayang. Akar, serpihan dan lembap ditempatkan di tepi tembok permanen. Semua detail ini bersifat visual; collision tetap mengikuti wall mask.

Revisi penempatan memberi setiap obor, ceruk dan kain bidang tembok tersendiri. Dudukan dan lantai di depannya harus permanen agar letaknya tetap setelah edit player. Obor mendapat ruang terlebih dahulu; akar hanya ditempatkan pada bidang yang tidak dipakai ornamen utama, dengan maksimal enam lokasi dan bentuk lebih tipis. Kain pertama berada di sisi START, terpisah dari obor di tile 7. Tambah/hapus wall tidak memunculkan ornamen acak.

Setelah EXIT, kamera beralih ke overview orthographic, ceiling beserta rusuknya, sconces dan detail tepi lorong disembunyikan, dan panel edit existing muncul. Tile editable diberi tint; pilihan satu tile memperlihatkan wall baru atau wall yang direndahkan menjadi floor preview. Picking canvas diproyeksikan ke bidang grid, tidak memakai siluet dekorasi sebagai identitas tile. Nomor tile opsional; tombol DOM tetap menyediakan seluruh pilihan edit. Preview tidak mengubah snapshot atau chain. Commit, unsigned review, sign dan verification tetap memakai Relay existing, termasuk practice/stale/offline/attempt locks.

## Boundary dan lifecycle

- `Board3D.tsx`: host React, focused input, heading, controls, sound dan preferensi. Intent diteruskan ke Relay; view tidak menjadi otoritas game.
- `preload.ts`: satu lazy import yang dibagi host dengan intent preload Play. Beranda idle tidak memuat Three atau membuat WebGL; preload dilewati pada koneksi hemat data/lambat.
- `ThreeBridge.ts`: renderer WebGL 2, kamera, animasi transient, overview/picking, resize, visibility, context loss dan cleanup.
- `world.ts`: geometri/material/pencahayaan original melalui `createWorld(walls, editableMask)`, tanpa state game, wallet atau RPC. Mask editable membatasi penempatan ornamen pada tembok permanen.
- `spatial.ts`: konversi heading relatif ke U/R/D/L serta koordinat tile.

Run, draft, snapshot, wallet preparation dan CommitAttempt tetap dimiliki Relay yang sama. Route switch mempertahankan data tersebut; full reload tidak menambah jaminan persistensi Run di luar journal existing. Home/Retry membuang renderer lama beserta RAF, listener, observer, canvas, geometries, materials, instance buffers dan WebGL context. Kesalahan import/WebGL/context menampilkan pesan, Retry dan akses Home; tidak mereset attempt.

Mesh batu/slab dan detail yang berulang di-instance; geometry/material dipakai bersama. Sisi masonry yang tertutup tembok permanen atau menghadap keluar perimeter tidak dibuat. Sisi yang bersebelahan dengan tile editable tetap dibuat agar draft penghapusan wall tidak membuka geometri yang hilang. Maksimal lima point lights tanpa shadow maps (tiga obor, EXIT dan camera fill), pixel ratio dibatasi 1.5. Jumlah texture tetap dua; efek post-processing, texture unduhan dan network asset fetch baru tidak diperlukan.

Pada seed yang sama, harness scene mengukur **118.964 triangle sebelum frustum culling**, turun dari 253.284 (sekitar 53%). Triangle yang lolos frustum awal turun dari 199.868 menjadi 96.180; estimasi draw calls awal turun dari 149 menjadi 129. Pengukuran ini menunjukkan penghematan geometri, **bukan kenaikan FPS sebesar 53% atau jaminan performa HP**. Beranda tetap tidak menjalankan renderer 3D.

## Provenance

Geometri, material, texture prosedural, atlas angka kecil dan synthesized cues ditulis di proyek. Tidak ada model, texture, sprite, audio atau kode Keep Out yang diambil. [Provenance world](../src/game3d/README.md) menjelaskan konstruksi aset. Three.js **0.186.1** adalah dependency MIT; [notice lisensinya](../public/assets/game3d/THREE-LICENSE.txt) disertakan di public build. Types dipin ke **0.186.0** dan tidak masuk runtime. Aset Phaser lama tidak lagi dikirim pada build; provenance historis tersimpan dalam riwayat dan backup.

Pengungkapan submission tetap perlu menyebutkan dependency pihak ketiga dan pekerjaan yang sudah ada sebelum window kompetisi. Catatan provenance ini tidak menjamin kelayakan hackathon atau hak eksklusif.

Rujukan primer yang diperiksa saat implementasi: [Three.js WebGLRenderer](https://threejs.org/docs/pages/WebGLRenderer.html), [InstancedMesh](https://threejs.org/docs/pages/InstancedMesh.html), dan [Keep Out oleh Little Workshop](https://www.littleworkshop.fr/projects/keepout/).

## Verifikasi migrasi 3D saja

[Catatan migrasi](RENDERER_MIGRATION.md) memuat hasil pemeriksaan terbaru. Build/typecheck dan 44 tes unit lulus; verifikasi browser untuk perubahan rute/default renderer masih pending. Angka dan screenshot berikut adalah hasil **sebelum** penghapusan 2D.

## Verifikasi historis sebelum migrasi

Revisi penempatan/optimasi 11 Oktober 2026: **build dan 60 tes unit pada 8 file lulus**. Regression test mereproduksi jarak obor yang terlalu dekat dengan kain pada perimeter dekat tile 7 sebelum fix, lalu lulus setelah alokasi bidang tembok dipisahkan. Tes tambahan memeriksa penempatan obor/ceruk/kain yang tetap pada setiap toggle seed yang solvable dan kedua revisi fixture, serta budget seed di bawah 150 ribu triangle dan maksimal lima point lights. Run browser dari terminal pengguna pukul 22:08 WIB menghasilkan **6/6 tes lulus, tanpa skipped atau flaky**, dalam 217.2 detik: animasi biasa, escape/editor beserta unsigned preview lintas renderer, galeri artwork, dan tiga viewport mobile. Screenshot memperlihatkan obor dan kain pada bidang tembok terpisah; relief, lorong, pendekatan EXIT serta play/editor mobile diperiksa. Hasil tersebut memvalidasi fungsi dan tampilan pada browser uji, bukan FPS pada perangkat mobile nyata.

Pembaruan keybinding dan artwork sebelumnya: WASD/tombol panah untuk berpindah dan Q/E untuk berputar. Run browser terfokus dari terminal pengguna pukul 19:42 WIB menghasilkan **7/7 tes lulus, tanpa skipped atau flaky**, dalam 294.5 detik. Kasus tersebut memeriksa lazy loading, binding dan relative movement, fixture escape beserta unsigned preview lintas renderer, galeri artwork, serta viewport 320×568, 390×844 dan 844×390. Screenshot relief, kain/sconce, lorong, pendekatan EXIT serta play/editor mobile telah diperiksa pada revisi tersebut.

Sebelum pembaruan keybinding/artwork, run 3D lengkap menghasilkan **9/9 tes lulus, tanpa skipped atau flaky**, dalam 380.7 detik, termasuk animasi biasa, WebGL failure dan context loss. **12/12 tes navigasi** juga telah lulus setelah perbaikan resize/fokus. Kasus kegagalan WebGL dan context loss tidak diulang pada revisi penempatan terakhir; kode lifecycle tidak berubah. Hasil ini berasal dari run terfokus yang berbeda, bukan klaim seluruh suite browser lulus pada revisi terakhir.

Verifikasi sebelumnya menemukan dan memperbaiki tiga masalah: cache parent bounds Phaser yang membuat overview mobile terpotong, fokus keyboard menu/navigasi, dan render 3D berulang saat scene statis. Trace tanpa screencast menunjukkan GPU ReadPixels stalls. Bridge sekarang merender reduced-motion/overview hanya ketika berubah. Regression test memakai bridge, world dan kamera nyata dengan boundary GPU diganti: render statis berulang terdeteksi sebelum fix, lalu lulus sesudahnya bersama pemeriksaan movement, resize, visibility dan disposal. Setelah optimasi geometri, harness CPU membangun world dalam sekitar 155 ms pada percobaan pertama dan 47–95 ms pada percobaan berikutnya; angka konstruksi ini bergantung pada kondisi CPU dan tidak mengukur kinerja GPU.

Suite fungsional 3D memakai reduced motion, dan satu kasus terpisah memakai animasi biasa. Screenshot desktop, portrait kecil, portrait dan landscape telah diperiksa: lorong, toolbar, editor serta tombol Commit berada dalam viewport; panel editor dapat discroll. Pengujian context loss memakai event browser sintetis, bukan kerusakan GPU fisik.

| Pemeriksaan                                | Hasil                                                                                                                                                       |
| ------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `npm run build`                            | PASS — typecheck dan Vite build.                                                                                                                            |
| `npm run test:rules`                       | PASS — 60 tes pada 8 file.                                                                                                                                  |
| `npm run format:check`                     | PASS.                                                                                                                                                       |
| Scene tanpa WebGL                          | PASS — 49 footprint wall, tembok editable tanpa ornamen khusus, visibility overview, dua texture shared, light cap, reduced motion dan disposal idempotent. |
| Browser navigasi dari terminal pengguna    | PASS sebelumnya — 12/12, desktop dan empat viewport mobile/tablet.                                                                                          |
| Browser 3D setelah binding/artwork         | PASS — 7/7 terpilih, termasuk galeri artwork dan tiga viewport mobile.                                                                                      |
| Browser setelah revisi penempatan/optimasi | PASS — 6/6 terpilih, tanpa skipped/flaky; animasi biasa, escape/editor, galeri artwork dan tiga viewport mobile.                                            |
| Browser 3D lengkap sebelum binding/artwork | PASS sebelumnya — 9/9, termasuk animasi biasa dan kegagalan/context loss WebGL.                                                                             |
| Screenshot / WebGL nyata                   | PASS — first-person dan overview, desktop serta 320×568, 390×844 dan 844×390.                                                                               |
| Browser/dev server dari sesi agent         | BLOCKED — sandbox menolak port lokal (EPERM); eksekusi browser di atas dilakukan dari terminal pengguna.                                                    |
| Mobile FPS perangkat nyata                 | Belum diukur.                                                                                                                                               |

Build menghasilkan chunk terpisah: ThreeBridge **603.79 kB / 155.19 kB gzip**, Phaser GameBridge **1,387.90 kB / 362.20 kB gzip**, shell **600.56 kB / 183.35 kB gzip**, CSS **23.02 kB / 6.02 kB gzip**. Warning chunk Vite >500 kB masih ada; engine sudah lazy dan tidak dimasukkan ke chunk shell.

Suite browser 3D sebelum migrasi berisi 10 kasus: lazy loading, relative movement dan rapid input, animasi biasa, mode switch tanpa reload, WebGL 2 failure/Retry, context loss dan Home cleanup, fixture escape, unsigned preview lintas renderer, galeri artwork, serta viewport 320×568, 390×844 dan 844×390. Tes visual menghasilkan screenshot di `test-results/` ketika dijalankan. Kontrak dan rules tidak diubah; tidak mengulang contract test hanya karena renderer tambahan.

Perintah verifikasi terpilih untuk penempatan/optimasi:

```sh
npm run test:browser -- tests/browser/three.spec.ts --grep 'artwork|3D mobile|3D escape|ordinary motion'
```

Verifikasi browser terfokus (hentikan `npm run local` terlebih dahulu; harness membuat server sendiri):

```sh
npm run test:browser -- tests/browser/three.spec.ts
```

Belum ada commit, push atau deployment untuk migrasi 3D saja.
