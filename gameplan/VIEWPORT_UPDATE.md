# Game Memenuhi Layar dan Kontrol Mouse/Sentuh

Implementasi lokal 11 Oktober 2026, setelah baseline `6e6b14b` pada `feat/phaser4-dungeon`. Pembaruan ini mengikuti permintaan pengguna untuk mempertahankan landing, membuka game yang memenuhi layar dalam website yang sama, dan menambahkan tombol arah. Belum ada commit, push atau deployment untuk perubahan ini.

## Cara mencoba

Jalankan `npm run dev`, lalu buka `http://127.0.0.1:5173/`. Pilih **Play without a wallet**. `/play` juga dapat dibuka langsung. Jika Vite sudah berjalan di terminal, muat ulang tab yang ada untuk mengambil perubahan.

- Beranda tetap berisi pengenalan, petunjuk dan history, dengan ilustrasi portal ringan.
- Game memenuhi viewport; header hanya berisi brand, jaringan, Steps/revision. Semua kontrol berada pada dock di dalam bingkai game bagian bawah. **Home** kembali ke landing; Restart, History, fullscreen, Menu, Play latest dan Refresh tetap tersedia tanpa menggulir halaman.
- Tombol arah dapat diklik atau ditap. Keempat tombol sama-sama persegi 48 px (44 px untuk layar kecil/landscape pendek) dengan satu SVG panah yang diputar. Satu aktivasi mengirim satu langkah; tembok, batas papan, EXIT, 96 langkah dan lock transaksi tetap berlaku. **Settings** membuka Sound, Reduced motion dan Tile numbers.
- WASD/arrow keys bekerja ketika dungeon mendapat fokus. Menu memakai dialog native: fokus tidak keluar ke game, Escape menutupnya, fokus kembali ke tombol pemicu.
- Home → Resume dan Back/Forward mempertahankan Run, pilihan tile dan preparation transaksi. Reload penuh tetap mengikuti journal existing; Run biasa belum disimpan lintas reload.
- Fullscreen browser opsional pada browser yang mendukung. Kegagalan izin tetap memungkinkan bermain dalam viewport. Tidak ada permintaan fullscreen otomatis.
- Setelah EXIT, seluruh peta terlihat dan panel edit terbuka. Pada mobile portrait, panel berada di bawah game dan dapat digulir sendiri. Setelah EXIT pada lebar ≤850 px, D-pad nonaktif disembunyikan untuk memberi ruang pada peta; Restart mengembalikannya. Pada tablet portrait sampai 850 px, editor juga ditumpuk agar toolbar tidak terpotong. Landscape menempatkannya di samping. Commit tetap melalui prepare lalu persetujuan tanda tangan terpisah.

## Batas komponen dan pemuatan

`navigation.ts` memberi view melalui History API. Relay tetap satu pemilik state; Board hanya dipasang pada `/play`. Kembali ke beranda membersihkan Phaser, canvas, listeners dan audio. Resume membuat view baru dari frame Relay terkini, bukan Run baru. History/petunjuk tidak memerlukan route reload.

`game/preload.ts` membagi satu import promise antara intent Play dan Board. Hover, fokus atau pointer down memanaskan kode engine; koneksi lambat/data saver tidak melakukan pemanasan spekulatif. Atlas baru dimuat ketika Board dibuka. Beranda tidak memakai canvas atau engine kedua. Karena atlas masih didekode ketika masuk, perpindahan pertama tidak dijanjikan tanpa loading.

Feedback lanjutan meminta zoom-out 10% lagi: hasil zoom follow pada semua viewport dikalikan 0.9, sehingga tuning referensi menjadi 0.81 dari baseline awal. Cakupan normal sekitar 6.67 kolom/5.56 baris; pada rasio ekstrem keseluruhan karakter diprioritaskan. Canvas dan dock memakai dua area dalam satu bingkai; tinggi kamera dihitung dari stage sehingga karakter dan tile tidak berada di balik tombol. Teks “Close view · camera follows you” dihapus. Kamera lurus dan zoom overview setelah EXIT tetap berlaku. Keputusan: [ADR-040](../docs/adr/0040-viewport-game-and-touch-controls.md).

## Dekorasi tambahan

Atlas [relics.png](../public/assets/game/v3/relics.png) dibuat melalui **built-in imagegen**, dengan [prompt lengkap](../public/assets/game/v3/prompts.md) dan [provenance](../public/assets/game/v3/credits.md). Empat frame baru: kristal teal, relik senjata/perisai, obelisk berantai, dan jamur merah/akar. PNG RGBA asli dipertahankan tanpa perubahan piksel. Ukuran tambahan 1,617,737 byte; dua atlas v2 ditambah v3 total 5,474,934 byte, dengan budget tes 6 MiB (v2 tetap di bawah 4 MiB, v3 di bawah 2 MiB). Metadata dapat dibangun ulang dengan `python3 scripts/game-assets-v3.py`.

Dekorasi baru dicampur dengan pilar, brazier, urn dan guardian lama di ceruk perimeter. Setelah feedback bahwa prop terlihat ditempel di tengah tembok, seluruh tumpukan prop pada tile wall dihapus. Tembok memakai ukiran, lumut, rune dan retakan yang sudah menyatu di tekstur v2. Objek besar berdiri di atas alas batu horizontal, dengan titik kaki sesuai batas alpha atlas, bayangan kontak, sisi ceruk yang gelap dan bibir batu di depan kaki objek. Ceruk menggantikan gambar tembok penuh di lokasinya, sehingga tidak ada lagi fasad tembok di belakang alas objek. Jumlah landmark juga dikurangi untuk memberi jarak antarornamen.

Seluruh ceruk berada di luar area 7×7; hanya debris kecil yang tetap berada di sudut lantai. Tidak ada collision, pickup, atau aturan baru; START/EXIT dan koridor tidak diubah. Zoom, tombol, dan alur edit tetap sama. Penataan ini memakai PNG existing tanpa mengubah piksel atau menambah unduhan aset. Atlas baru hanya dimuat saat masuk ke game, bukan pada landing/preload intent.

Feedback berikutnya menghapus garis berwarna pada sisi dan bibir ceruk obor/ornamen. Sisi ceruk sekarang memakai potongan tekstur batu yang sama dengan perimeter, dibantu bayangan berlapis tanpa stroke dekoratif. Penanda pilihan edit setelah EXIT tetap tersedia. Tembok yang ditambah/dihapus pemain memakai empat variasi masonry v2 sesuai indeks tile; preview penambahan kini menunjukkan varian yang sama dengan hasilnya. Pemain memilih perubahan wall/floor, bukan skin atau ornamen perimeter.

## Bukti validasi

| Pemeriksaan             | Hasil                                                                                                                       |
| ----------------------- | --------------------------------------------------------------------------------------------------------------------------- |
| TypeScript + Vite build | PASS. Engine Phaser tetap dalam chunk lazy.                                                                                 |
| Unit suite              | PASS, 46 tes pada 5 file. Termasuk 11 tes editor/lobby dan 20 tes game.                                                     |
| Kamera                  | Seluruh 49 posisi pada viewport lama, 1920×500, 390×650, 2560×300; zoom referensi, target cakupan, safety cap dan overview. |
| Browser discovery       | 80 tes pada 12 file terdaftar; 12 kasus navigasi baru. Discovery bukan eksekusi.                                            |
| Browser runtime         | BLOCKED sebelum tes dimulai: harness Anvil/Vite `Operation not permitted (os error 1)`.                                     |
| Pratinjau Vite langsung | BLOCKED: `listen EPERM ... 127.0.0.1:5173`.                                                                                 |
| Chromium langsung       | BLOCKED: `sandbox_host_linux.cc ... Operation not permitted`. Tidak ada browser CUA terhubung.                              |

Tes browser baru mencakup beranda tanpa engine, intent preload, satu dokumen/canvas, Home/Resume/Back/Forward, D-pad/collision/96 langkah/EXIT, draft dan unsigned preparation yang bertahan, modal/focus, native fullscreen, portrait/landscape tanpa overflow serta panel edit mobile. Tes history existing diperbarui agar membuka dialog sebelum memeriksa konten. Screenshot hanya akan dihasilkan bila tes browser benar-benar dijalankan; belum ada bukti visual baru dari sesi ini.

Perintah yang siap dijalankan dalam terminal biasa:

```sh
npm run test:browser -- tests/browser/navigation.spec.ts tests/browser/game.spec.ts tests/browser/dungeon.spec.ts tests/browser/commit.spec.ts
```

`npm run format:check` dan `git diff --check` juga lulus. Setelah penataan ceruk, pemeriksaan geometri memastikan seluruh frame 12 prop berada dalam perimeter 864×864 dan tidak memotong 49 tile yang bisa dimainkan. Build terakhir setelah penghapusan outline ceruk: main JS 589.77 kB (gzip 180.80 kB), lazy engine 1,388.15 kB (gzip 362.30 kB), CSS 20.89 kB (gzip 5.53 kB).

Setelah pemeriksaan terarah lulus, seluruh `npm run test:browser` memeriksa regresi wallet/recovery/history. Tidak ada perubahan kontrak atau `src/lib/`; tes kontrak tidak dijalankan ulang untuk perubahan UI ini. Peringatan build chunk di atas 500 kB tetap ada. Tidak ada klaim FPS, waktu first-playable, hasil lintas browser, atau transaksi onchain baru.
