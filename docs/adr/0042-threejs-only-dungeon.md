---
status: accepted
---

# ADR-042 — Three.js sebagai Satu-satunya Presentasi Dungeon

Setelah mencoba kedua versi, pengguna memilih pengalaman dungeon orang pertama dan meminta game 2D dihapus dari aplikasi pada 11 Oktober 2026. Three.js kini menjadi satu-satunya renderer pada `/play`; `/play/3d` menjadi alias yang mengganti URL tanpa memuat ulang dokumen. Keputusan ini menggantikan pilihan Phaser ADR-014/033, pipeline atlas aktif ADR-036, kamera dan kontrol 2D ADR-038/040, serta pilihan dua renderer ADR-041; keputusan snapshot, lifecycle, viewport, navigasi, dan overview setelah EXIT tetap berlaku.

Phaser, kode presentasi 2D, atlas v1–v3 dan generator atlas dihapus dari runtime dan dependency. React/Relay tetap memiliki Run, draft dan CommitAttempt; kontrol relatif WASD/panah serta Q/E mengikuti ADR-041 dan menghasilkan intent U/R/D/L yang sama. Home/Resume mempertahankan run dan preview dalam satu dokumen. Import Three dapat disiapkan ketika pengguna mengarahkan/fokus/menyentuh Play, kecuali koneksi hemat data/lambat; canvas dan resource GPU hanya dibuat saat bermain. WebGL 2 dibutuhkan: kegagalan menyediakan Retry dan Home, tanpa fallback 2D.

Konsekuensinya, aplikasi memelihara satu renderer dan tidak lagi mengirim aset atau chunk Phaser, tetapi perangkat tanpa WebGL 2 tidak dapat memainkan versi ini. Riwayat Git menyimpan versi 2D yang sudah di-commit; perubahan lokal terbaru dicadangkan dan diverifikasi sebelum penghapusan. Backup lokal bukan commit atau unggahan GitHub. Pemulihan dilakukan dalam folder atau branch terpisah agar tidak menimpa versi 3D; detail ada pada [catatan migrasi](../../gameplan/RENDERER_MIGRATION.md).
