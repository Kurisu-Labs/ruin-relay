---
status: accepted
---

# ADR-033 — Phaser 4 WebGL untuk Presentasi Dungeon

Permintaan implementasi gameplan menetapkan Phaser 4 sebagai engine. Kita memakai Phaser **4.2.1** secara exact, renderer WebGL, dan lazy import dari host React. Ini menggantikan pilihan Phaser 3 pada ADR-014 dengan menerima biaya migrasi renderer; React tetap mengelola HUD, editor, wallet, transaksi dan history. Versi diverifikasi melalui package resmi dan instalasi npm; kelulusan arsitektur tidak menyatakan seluruh pengujian release selesai.

Canvas lama dan engine 3D tidak dipilih karena target engine sudah jelas dan 49 tile dapat digambar dengan sprite 2D. Kegagalan import, atlas, atau WebGL memberikan pesan dan Retry dungeon view; recovery transaksi tetap tersedia melalui DOM. Status pengujian dicatat di [validation record](../../gameplan/VALIDATION_RECORD.md), terpisah dari keputusan ini. ADR-029–031 tetap berlaku.
