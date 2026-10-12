---
status: accepted
---

# ADR-035 — Run Authoritative Mendahului Animasi

Gerakan diterima langsung oleh Relay/rules melalui event DOM, lalu scene menganimasikan perubahan path. Menunggu tween selesai atau mengunci input selama tween akan membuat langkah bergantung frame rate; kita memilih konsistensi domain dengan biaya rekonsiliasi presentasi. Posisi visual, suara, ghost, dan partikel tidak menulis run atau menentukan konfirmasi.

Queue visual dibatasi empat segmen, lalu fast-forward ke posisi authoritative bila tertinggal. Perubahan snapshot, restart, path non-prefix, dan reduced motion membatalkan tween melalui generation token. Draft adalah overlay satu tile pada snapshot run; efek kontribusi hanya menerima mutation terverifikasi, dideduplikasi dengan chain/contract/hash/log/block identity, dan dihapus bila confirmation ditarik. Polling tidak mengganti base run. Keputusan memperinci ADR-006/024 dan mempertahankan ADR-029–031.
