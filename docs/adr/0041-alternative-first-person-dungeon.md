---
status: accepted
---

# ADR-041 — Alternatif Dungeon Orang Pertama, Satu Run

Permintaan pengguna pada 11 Oktober 2026 menerima percobaan dungeon orang pertama di folder terpisah, terhubung ke beranda dan mempertahankan game lama. **Keputusan ini mengamendemen pilihan engine tunggal ADR-014/033 serta routing ADR-040:** `/play/3d` memakai Three.js 0.186.1 melalui `src/game3d/`, sementara `/play` tetap memakai Phaser 4.2.1 di `src/game/`. Keduanya memasok intent ke satu Relay dan memakai editor/commit yang sama. Hanya renderer terpilih yang dibuat; navigasi menghancurkan canvas, observer, listener, audio dan resource GPU renderer sebelumnya. Import Three ditunda sampai view 3D dibuka. Biayanya adalah dua renderer yang harus dipelihara dan persyaratan WebGL 2; keuntungan utamanya adalah evaluasi pengalaman baru tanpa menghilangkan presentasi lama.

**Hanya pada view 3D**, semantik kontrol layar ADR-038/040 diganti dengan W/↑ maju, S/↓ mundur, A/← dan D/→ bergeser kiri/kanan tanpa berputar, Q/E berputar 90° ke kiri/kanan. Binding mengikuti penyesuaian pengguna setelah mencoba versi 3D pada 11 Oktober 2026. Heading merupakan state presentasi, mulai menghadap selatan dan kembali ke selatan saat restart atau memasuki ulang view. Putaran tidak masuk path; perpindahan diterjemahkan ke U/R/D/L sebelum diterima Relay. Tidak ada free movement, diagonal, pointer lock, atau collision kedua. Animasi mengikuti langkah yang sudah diterima dan tidak menghalangi input berikutnya. ADR-029/035 tetap berlaku untuk snapshot dan otoritas Run. Ini mempertahankan fixture dan kontrak tanpa menjadikan orientasi kamera bagian dari bukti escape.

ADR-039 tetap berlaku: peta penuh hanya tersedia setelah EXIT sebagai editor satu tile. Pada view 3D peta memakai kamera orthographic dari atas, ceiling/dekorasi tinggi disembunyikan, dan tile dipilih dengan ray-plane picking atau tombol DOM existing. Draft hanya mengubah visual; prepare, sign, receipt verification, stale handling dan recovery tidak berpindah ke renderer. Lingkungan 3D dibuat dari geometri dan material original: masonry, slabs, pilasters, sconces, START dan portal EXIT. Tidak ada aset/kode Keep Out yang disalin, monster, combat, loot, inventory, token atau level baru. Hak dan kewajiban dependency tetap terpisah; lisensi Three.js disertakan.

Penerimaan keputusan tidak menyatakan pengujian GPU/browser selesai. Scope, sumber dan hasil verifikasi: [catatan implementasi 3D](../../gameplan/THREE_DUNGEON.md).
