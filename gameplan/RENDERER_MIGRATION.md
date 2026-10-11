# Migrasi ke game 3D saja

11 Oktober 2026 — keputusan pengguna dan [ADR-042](../docs/adr/0042-threejs-only-dungeon.md).

`/` tetap beranda. Play/Resume membuka game orang pertama di `/play`. Tautan `/play/3d` lama dinormalisasi ke `/play` dengan query/fragment tetap utuh, tanpa reload. Home, editor setelah EXIT, transaksi, dan aturan dungeon tetap menggunakan Relay yang sama. Pilihan renderer, dependency Phaser, kode 2D, atlas v1–v3 dan generator atlas telah dihapus. `src/game3d/` sekarang memiliki renderer, kontrol, suara serta rekonsiliasi presentasi yang sebelumnya dipakai bersama.

## Memulihkan 2D

Git menyimpan versi pada **commit**. Branch menunjuk rangkaian commit; tag memberi nama pada satu commit. GitHub baru mempunyai perubahan setelah commit tersebut di-push. Menghapus file pada commit baru tidak menghapusnya dari riwayat sebelumnya.

Sebelum migrasi, HEAD lokal dan remote-tracking branch `origin/feat/phaser4-dungeon` sama-sama menunjuk `6e6b14b`. Ini menunjukkan baseline 2D yang tercatat lokal, bukan pemeriksaan baru ke server GitHub. Untuk membuka baseline yang sudah di-commit tanpa mengubah folder 3D, jalankan dari repo:

```sh
git worktree add -b restore/2d-baseline ../ruinrelay-2d 6e6b14b
```

Pembaruan 2D/viewport terakhir belum di-commit pada saat migrasi. Sebelum file dihapus, seluruh source, aset dan dokumen yang relevan, termasuk perubahan lokal 2D dan 3D, dicadangkan di mesin pengembangan:

```text
.local/backups/pre-3d-only-20261011-223938/
  working-tree.tar.gz
  manifest.json
  history.bundle
  RESTORE.txt
```

Arsip berisi 190 file. SHA-256 setiap file diverifikasi terhadap working tree sebelum penghapusan. `history.bundle` juga lolos `git bundle verify`. `.env`, kredensial, key, dependencies, build output dan data runtime dikecualikan. Direktori backup diabaikan Git dan diblokir oleh dev server; **backup ini belum berada di GitHub**.

Untuk versi 2D lokal terakhir, ekstrak `working-tree.tar.gz` ke **folder baru yang kosong**, lalu gunakan Node 22.12+ dan `npm ci`. File `RESTORE.txt` memuat petunjuk yang sama. Pada snapshot tersebut `/play` adalah 2D dan `/play/3d` adalah 3D. `history.bundle` sendiri hanya berisi riwayat commit dan tidak mencakup perubahan lokal; gunakan arsip source untuk versi terbaru. Jangan ekstrak di atas folder 3D yang sedang dipakai.

## Verifikasi migrasi

- Build/typecheck: lulus; chunk Phaser dan direktori aset 2D tidak ada di hasil build.
- Unit: 44 tes pada 8 file lulus. Kasus proyeksi, binding kardinal layar dan atlas khusus renderer yang dihapus ikut dihapus; rekonsiliasi Run dan pengujian domain tetap ada.
- Format dan `git diff --check`: lulus. Pemeriksaan artefak memastikan dependency, source, public assets dan chunk Phaser tidak ada; 5.545.285 byte aset 2D dikeluarkan. Build terbaru: shell 593,80 kB / 182,19 kB gzip; ThreeBridge 603,77 kB / 155,16 kB gzip; CSS 22,54 kB / 5,91 kB gzip. Warning ukuran chunk >500 kB tetap ada; engine tetap lazy.
- Browser: tes navigasi, kontrol, canvas picking dan fixture transaksi diarahkan ke kontrol relatif 3D. Verifikasi eksekusi browser setelah migrasi masih pending; sesi agent menolak pembuatan socket lokal dengan `EPERM`. Daftar 88 kasus berhasil ditemukan, tetapi `--list` tidak mengeksekusi tes. Run terfokus 37 kasus diminta dari terminal pengguna:

  ```sh
  npm run test:browser -- tests/browser/game.spec.ts tests/browser/dungeon.spec.ts tests/browser/navigation.spec.ts tests/browser/three.spec.ts tests/browser/commit.spec.ts
  ```

- Kontrak, rules, ABI dan metadata deployment tidak diubah.

Hasil browser sebelumnya pada [catatan 3D](THREE_DUNGEON.md) berasal dari versi sebelum migrasi ini. Riwayat rancangan 2D tetap disimpan di `gameplan/` sebagai dokumentasi historis.

## Persiapan integrasi dengan main

Main GitHub pada `ff8602406391596e1214fd9e7eb93bae5191d7d6` memuat 28 commit baru setelah basis branch 2D, termasuk metadata deployment acceptance, recovery nonce, koordinasi draft dan pemeriksaan history. Source gabungan disiapkan dalam direktori review biasa tanpa menulis metadata Git. Build/typecheck dan **45 tes unit pada 8 file lulus** pada source gabungan tersebut; ini belum merupakan bukti tes browser atau push.

README menggabungkan petunjuk game 3D dengan bukti acceptance upstream, tanpa mengklaim transaksi historis itu dilakukan melalui UI 3D. Tes tambahan upstream disesuaikan untuk HUD revision dan dialog History; context browser terpisah memakai reduced motion untuk tes fungsional, sementara kasus animasi biasa tetap ada. Publikasi hanya ditujukan ke `feat/threejs-dungeon`; main dan branch 2D tidak menjadi target push.
