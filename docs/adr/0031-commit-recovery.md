---
status: accepted
---

# ADR-031 — Pulihkan commit berdasarkan bukti hasil

Timeout pembacaan dan reload tidak membuktikan kegagalan pengajuan, sehingga commit attempt tetap dipertahankan secara lokal beserta hash yang diketahui, dipulihkan dengan verifikasi chain baru, dan menghalangi commit berikutnya selama hasilnya belum pasti. Speed-up dengan aksi yang sama melanjutkan attempt melalui hash pengganti; pembatalan atau replacement dengan aksi berbeda yang terverifikasi mengakhiri attempt tanpa mengklaim keberhasilan edit, sedangkan reorg yang membatalkan inclusion menarik kembali success dan mengembalikan attempt ke pemeriksaan. Keputusan ini memperinci [ADR-030](0030-commit-attempt-confirmation.md), ADR-017, dan ADR-023: kita menerima kemungkinan menunggu lebih lama demi menghindari pengajuan ganda akibat status yang ditebak, dengan aturan operasional pada [master ADR §C.7](../../ADR.md#c7-pemulihan-commit-attempt).

## Konsekuensi

Jika hash tidak kembali dari wallet, UI menyediakan **Recover with transaction hash** dan panduan wallet/explorer; bukti yang masih ambigu mempertahankan status unresolved. Satu unresolved attempt memblok commit baru untuk deployment yang sama di seluruh tab dengan origin dan profil browser yang sama, termasuk setelah berganti akun; ini sengaja lebih ketat daripada lock per akun dan tidak menjanjikan koordinasi lintas profil atau perangkat.
