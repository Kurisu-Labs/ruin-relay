---
status: accepted
---

# ADR-038 — Kamera Dekat Lurus dan Aset Dungeon v2

Ketentuan overview manual dan ukuran view di bawah telah digantikan oleh [ADR-039](0039-escape-only-overview.md). Orientasi layar, artwork v2 dan batas presentasi lainnya tetap berlaku.

Feedback pengguna pada 11 Oktober 2026 menunjukkan bahwa arah diagonal membuat WASD sulit dipahami dan seluruh papan sekaligus terasa seperti papan catur. Keputusan ini **menggantikan ADR-034**: presentasi kini lurus dari atas dengan sedikit face selatan pada artwork, sehingga U/R/D/L terlihat sebagai atas/kanan/bawah/kiri. Grid, indeks `7*y+x`, fixture, collision dan encoding path tidak berubah. Merotasi input dipertimbangkan, tetapi tetap menyisakan ambiguitas antara tombol dan arah layar.

Kamera dekat mengikuti posisi visual karakter, memperlihatkan sekitar 4.8×4.05 tile dan berhenti pada perimeter reruntuhan. **Full dungeon** memberi overview tanpa mengubah run; mencapai EXIT otomatis membuka overview agar semua pilihan edit terlihat. Zoom, resize dan retry hanya mengubah presentasi, sementara ADR-029–031 dan ADR-035/037 tetap berlaku. Kita menerima sebagian peta berada di luar viewport saat menjelajah untuk mendapatkan rasa berada di dalam dungeon.

Aset v2 menggunakan dua spritesheet hasil built-in imagegen dengan PNG asli, metadata frame/pivot, hash, credits dan prompt tersimpan di [public/assets/game/v2](../../public/assets/game/v2/credits.md). Ini memperbarui baseline seni ADR-036; atlas v1 tetap dipakai untuk efek build/break. Artwork lebih rinci menaikkan anggaran dua PNG baru menjadi 4 MiB dibanding target awal 2 MiB. Tidak ada dekorasi yang menambah collision atau aturan baru. Bukti pemeriksaan aktual dicatat pada [validation record](../../gameplan/VALIDATION_RECORD.md).
