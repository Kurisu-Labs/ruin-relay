---
status: accepted
---

# ADR-036 — Aset Modular dengan Anchor dan Provenance

Dungeon dapat berubah satu tile pada setiap revisi, sehingga artwork dibuat sebagai floor, wall, endpoint, karakter empat arah, shadow dan efek modular. Kita memilih atlas raster dengan frame names, pivot dan provenance yang eksplisit dibanding satu ilustrasi papan utuh atau loose sprites tanpa metadata. Biaya menstandarkan aset menghindari perbedaan anchor dan memudahkan depth, toggle serta pemulihan view.

Versi pertama berisi 64 frame pixel art asli yang dibuat secara deterministic oleh [generator](../../scripts/game-assets.py), berlisensi MIT. Atlas untrimmed 800×800 memakai padding dua pixel, manifest SHA-256 dan credits di [public/assets/game/v1](../../public/assets/game/v1/credits.md). Runtime menggunakan berkas hasil yang disertakan; Python/Pillow hanya dibutuhkan untuk regenerasi. Variasi lantai tidak berubah saat polling. Lisensi dependency engine tetap milik upstream masing-masing.

[ADR-038](0038-close-top-down-camera.md) memperbarui gaya dan paket aktif menjadi artwork v2 dari imagegen; modularitas, anchor dan provenance tetap berlaku. Generator v2 membangun metadata tanpa mengubah PNG sumber. Atlas v1 dipertahankan untuk efek.
