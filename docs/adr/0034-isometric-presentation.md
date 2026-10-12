---
status: superseded by ADR-038
---

# ADR-034 — Proyeksi Isometrik Tanpa Mengubah Grid Domain

Keputusan historis. [ADR-038](0038-close-top-down-camera.md) mengganti POV ini berdasarkan feedback pengguna; detail di bawah merekam implementasi v1.

Pandangan dari barat daya memakai footprint 64×32 dengan pusat tile `(x+y-6)*32, (y-x)*16`. Indeks tetap `7*y+x`, sehingga kamera tidak mengubah fixture, collision atau calldata. Kita menerima kompleksitas depth dan inverse picking untuk memenuhi POV pengguna tanpa mengubah grid domain. Dunia 3D dan pemutaran indeks tidak diperlukan.

[Projection module](../../src/game/projection.ts) memiliki rumus forward, diamond containment, tie break indeks terkecil, depth groundY, dan camera fit. U/R/D/L terlihat sebagai NW/NE/SE/SW. Kamera tetap dan menyesuaikan ukuran host; tembok yang menutupi karakter menjadi transparan, dengan collision tetap berdasarkan bitmask. START berada di kiri dan EXIT di kanan pada orientasi ini. Detail dimensi ada di [camera specification](../../gameplan/CAMERA_AND_PROJECTION.md); evaluasi visual tidak mengubah aturan ADR-004/007/008/028.
