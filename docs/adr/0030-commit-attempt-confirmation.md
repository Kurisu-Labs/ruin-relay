---
status: accepted
---

# ADR-030 — Konfirmasi mutation terhadap commit attempt

Perubahan pilihan saat signing atau pembaruan dungeon setelah transaksi berhasil dapat membuat UI menghubungkan hasil ke run atau revisi yang salah; karena itu setiap commit attempt menangkap run, tile, akun, chain, dan kontrak tujuan secara tetap, dengan perubahan tile, Restart, Play latest, dan submit ulang terkunci selama signing/pending sementara history tetap dapat dilihat. Confirmed mutation diverifikasi terhadap receipt dan event milik attempt tersebut, sedangkan live dungeon direkonsiliasi secara terpisah sehingga kontribusi pada revisi N+1 tetap berhasil ketika dungeon telah mencapai N+2. Keputusan ini memperinci [ADR-017](../../ADR.md#adr-017--tx-lifecycle-simulate-sign-wait-reconcile) dan menggantikan interpretasi kesamaan mutlak event dengan state terbaru pada §C.5; penolakan wallet mengembalikan editor yang dipertahankan, dan aturan verifikasi terperinci tetap berada di master ADR.
