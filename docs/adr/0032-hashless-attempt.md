---
status: accepted
---

# ADR-032 — Bukti untuk commit attempt tanpa hash

[ADR-031](0031-commit-recovery.md) menahan unresolved commit attempt yang belum punya hash transaksi. Itu tetap berlaku ketika bukti chain tidak cukup. Dua pengamatan read-only, pada pemuatan dan pada Retry status, dapat mengakhiri attempt tersebut.

Jika live revision sudah melewati snapshot attempt, transaksi itu tidak dapat lagi menjadi mutation: `completeAndMutate` menolak `expectedRevision` yang bukan revision saat ini, jadi paling banyak ada satu mutation per revision. Event `DungeonMutated` kanonik pada revision snapshot+1 yang editor, tile, wall mask, dan transaksinya cocok dengan attempt dikonfirmasi lewat pemeriksaan receipt biasa. Event lain pada revision itu mengakhiri attempt sebagai non-mutation dan memulihkan run. Jika revision tidak berubah, attempt diperlakukan belum terkirim hanya bila nonce `pending` akun sama dengan nonce `latest` (tidak ada transaksi in-flight pada RPC sequencer), nonce `latest` yang tercatat sebelum signing — bila ada — masih sama, dan tidak ada event `DungeonMutated` untuk snapshot+1. Jurnal baru menyimpan kedua nonce sebelum permintaan signing. Prompt wallet yang masih terbuka di tab lain memegang document lock, jadi kesamaan nonce itu belum bukti selama prompt itu hidup. Jurnal lama tanpa nonce memakai `pending == latest` dan tidak adanya event itu. Aplikasi tidak memindai transaksi yang masuk setelah waktu pembuatan attempt, karena jurnal tidak menyimpan waktu itu. Pembacaan nonce atau log yang gagal membiarkan attempt terkunci. Timeout atau respons wallet yang hilang bukan bukti dengan sendirinya. Kasus terburuk setelah attempt dilepas adalah salinan transaksi yang datang terlambat dan revert `StaleRevision`; receipt revert itu sudah ditangani sebagai hasil yang terbukti.

## Konsekuensi

Attempt tanpa hash tidak lagi terkunci semata-mata karena revision belum berubah. Kunci tetap bila ada transaksi in-flight, nonce akun sudah maju, event snapshot+1 ada tetapi tidak dapat dicocokkan, atau RPC gagal.
