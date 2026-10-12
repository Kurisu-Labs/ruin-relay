---
status: accepted
---

# ADR-039 — Overview Setelah Escape dan Petunjuk Edit

Ukuran view untuk layar penuh/rasio ekstrem diperinci kemudian oleh [ADR-040](0040-viewport-game-and-touch-controls.md); zoom viewport referensi tetap sama.

Feedback pengguna pada 11 Oktober 2026 meminta penghapusan sementara **Full dungeon** agar rute tidak mudah dibaca saat bermain, kamera sedikit lebih dekat, dan penjelasan mengapa Commit abu-abu setelah mencapai EXIT. Keputusan ini **menggantikan overview manual dan ukuran view ADR-038**; orientasi lurus dan artwork v2 tetap berlaku.

Selama run, kamera selalu mengikuti karakter dengan `zoom = 0.9 * min(width/(96*4), height/(96*3.4))`. Faktor 0.9 merupakan tuning lanjutan yang diterima pada 11 Oktober 2026: pengguna meminta kamera dijauhkan 10% dari view dekat sebelumnya. Tidak ada tombol overview. Setelah local escape, kamera otomatis menampilkan seluruh dungeon untuk memilih edit draft. Restart kembali ke kamera dekat pada run snapshot yang sama. Alternatif menghapus overview juga dari editor menyulitkan pemilihan tile yang jauh dari EXIT. Kamera tetap merupakan presentasi; ADR-019 dan ADR-029–036 tetap berlaku.

Editor menjelaskan bahwa memilih floor mempreview wall, memilih wall mempreview floor, dim tiles tidak dapat diubah, dan satu escape hanya mengusulkan satu perubahan yang menyisakan rute. Preview belum merupakan mutation. Tombol Commit dihubungkan melalui `aria-describedby` ke petunjuk yang menyebut penghalang aktif: Practice, attempt terkunci, stale run, live dungeon unavailable, koordinasi browser unavailable, belum ada pilihan, atau candidate tidak solvable. Pada live dungeon yang siap, wallet belum tersambung tidak menonaktifkan tombol; connection dan simulation terjadi saat prepare sesuai ADR-016–017, lalu signing merupakan tindakan terpisah. Practice tetap mendukung preview tanpa menyimpan mutation.

Bukti pengujian aktual dan batas browser dicatat pada [validation record](../../gameplan/VALIDATION_RECORD.md).
