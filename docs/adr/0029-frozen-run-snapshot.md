---
status: accepted
---

# ADR-029 — Pisahkan run snapshot dari live dungeon

Polling dapat menemukan revisi baru ketika pemain masih berjalan atau memilih edit; mengganti papan saat itu merusak kontinuitas run dan mengaburkan revisi yang diselesaikan. Run mempertahankan snapshot awal sebagai latihan bila menjadi stale, sementara UI menampilkan revisi run dan revisi live secara terpisah serta menonaktifkan commit dari stale run; **Restart** mengulang snapshot yang sama, sedangkan **Play latest** memulai run baru pada live dungeon. Keputusan ini menggantikan acceptance [ADR-014](../../ADR.md#adr-014--phaser-untuk-render-2d-react-untuk-shell-ui) yang menghubungkan setiap perubahan revisi live ke pemuatan papan: hanya pemilihan snapshot untuk run yang memanggil `game.loadBoard(snapshot)` secara atomik.
