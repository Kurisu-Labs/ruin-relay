# Perubahan Berdasarkan Uji Pemain: Kamera Dekat dan Dungeon v2

Status: diimplementasikan lokal, 11 Oktober 2026. [ADR-038](../docs/adr/0038-close-top-down-camera.md) mengganti keputusan POV pada ADR-034; [ADR-039](../docs/adr/0039-escape-only-overview.md) menghapus overview manual dan mendekatkan kamera lagi. Dokumen isometrik sebelumnya merupakan baseline historis; ketentuan kamera, arah layar dan artwork di sini berlaku untuk implementasi terkini.

## Pengalaman bermain

Kamera lurus menghilangkan kebutuhan menerjemahkan WASD menjadi diagonal. Pemain melihat karakter berlentera dari atas dengan face selatan pada artwork; W selalu tampak naik, D ke kanan, S turun, A ke kiri. Karakter berada dekat kamera dan berjalan di antara masonry berukir, batu retak, lumut serta perimeter berapi. Semua ornamen kosmetik: wall bit tetap menjadi satu-satunya penentu collision.

Selama run, view dekat selalu mengikuti karakter. Tombol **Full dungeon** dihapus sementara sesuai feedback pengguna agar rute tidak bisa dibaca sekaligus melalui UI. Setelah local escape, overview terbuka otomatis supaya pilihan edit pada seluruh peta dapat dievaluasi. Restart selalu kembali ke view dekat. Mode edit tetap menggunakan snapshot yang diselesaikan; perubahan live dungeon tidak memindahkan tile di tengah run.

Setelah EXIT, klik floor yang disorot untuk mempreview wall atau klik wall untuk mempreview floor. Dim tiles tetap; satu escape hanya memberi satu edit yang menyisakan rute. Preview belum tersimpan. Di bawah **Commit one change**, panel menjelaskan syarat yang belum terpenuhi. Pada live dungeon yang siap, Commit membuka koneksi wallet dan estimasi, kemudian **Sign and submit edit** meminta pengiriman secara terpisah. Practice hanya mendukung preview dan tidak menjadi writable hanya dengan menghubungkan wallet.

## Proyeksi dan kamera

- Tile 96×96 world units; pusat `(x,y)` adalah `((x-3)*96,(y-3)*96)`.
- START 0 di kiri atas dan EXIT 48 di kanan bawah. Indeks `7*y+x` tetap.
- Footprint setengah terbuka menghindari satu klik memilih dua tile; perimeter di luar grid tidak selectable.
- Kamera dekat: `zoom = 0.9 * min(viewportWidth/(96*4), viewportHeight/(96*3.4))`. Tuning terakhir menurunkan zoom 10% dari view sebelumnya sesuai feedback pengguna, dengan target cakupan sekitar 4.44×3.78 tile. Zoom mengikuti ukuran host sehingga kedekatan terasa konsisten.
- Ruin termasuk perimeter berukuran 864×864; camera center dijepit agar view tetap berada pada ruin plus margin 16 world units. Di tengah papan camera center mengikuti posisi visual karakter, termasuk selama tween.
- Overview: `zoom = min(viewportWidth,viewportHeight)/896`, center `(0,0)`. Seluruh grid, wall perimeter dan margin masuk frame.
- Resize, transisi ke editor, Restart, reduced motion dan retry tidak mengubah encoding path atau aturan transaksi. Reduced motion membuat posisi dan kamera berpindah langsung.

## Artwork dan produksi

[Environment](../public/assets/game/v2/environment.png) memuat 16 aset terpisah; [adventurer](../public/assets/game/v2/adventurer.png) memuat 16 frame karakter untuk N/E/S/W. Dua spritesheet dibuat memakai built-in imagegen dan disalin utuh ke repo. PNG tidak dipotong atau dilukis ulang; atlas JSON mendefinisikan frame rectangles dan foot pivots. Metadata menyesuaikan gutter yang sebenarnya agar ujung tangga serta kepala guardian tidak terpotong. [Prompt dan provenance](../public/assets/game/v2/credits.md) disimpan bersama aset.

Generator `npm run assets:game` hanya membangun ulang metadata dan manifest dari PNG yang disertakan; tidak memanggil layanan image generation. Python/Pillow hanya diperlukan untuk regenerasi metadata. Efek build/break memakai atlas v1. Anggaran dua PNG v2 adalah 4 MiB; perubahan dari target lama menerima transfer yang lebih besar untuk detail seni yang diminta pengguna.

## Acceptance yang diperbarui

1. Menekan W dari tile 7 kembali ke START; karakter menghadap utara dan gerak layar menuju atas.
2. Gerak fixture A/B menghasilkan path, steps dan mask yang sama seperti sebelumnya.
3. Kamera dekat menjaga karakter tetap terlihat pada keempat sudut, pusat, dan viewport mobile/desktop.
4. Tombol Full dungeon tidak tersedia saat run maupun editor. Kamera dekat tetap aktif sampai EXIT; Restart mengembalikannya tanpa mengubah snapshot.
5. EXIT membuka overview; tile 31, 38, invalid 8, dan wall 16 cocok dengan editor DOM.
6. Resize, asset failure/retry, WebGL failure/retry dan rapid input tidak menambah canvas, listener atau langkah domain.
7. Konfirmasi/lock/recovery tetap mengikuti attempt; dekorasi, kamera dan animasi tidak menentukan hasil transaksi.
8. Alasan Commit nonaktif terlihat tepat di dekat tombol dan dapat dibaca assistive technology; valid live edit dapat direview sebelum wallet terhubung. Practice tidak menyimpan preview sebagai mutation.

Bukti hasil aktual ada di [validation record](VALIDATION_RECORD.md). Acceptance browser belum dinyatakan lulus ketika harness ditolak oleh sandbox.
