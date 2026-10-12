# Sumber, Baseline dan Batas Pembuktian

Tanggal pemeriksaan: 10 Oktober 2026. Sumber eksternal dipakai untuk kompatibilitas engine, bukan untuk mengklaim implementasi rencana sudah berjalan.

## 1. Sumber repo

| Sumber | Peran |
|---|---|
| [AGENTS](../AGENTS.md), [HANDOFF](../HANDOFF.md) | Instruksi proyek dan urutan membaca. |
| [Domain docs](../docs/agents/domain.md), [GLOSSARY](../GLOSSARY.md) | Satu konteks, vocabulary dan amendment ADR. |
| [Root PRD](../PRD.md) | Ruang lingkup dan aturan gameplay. |
| [Root ADR](../ADR.md) | Keputusan accepted dan normative technical rules. |
| [ADR-029](../docs/adr/0029-frozen-run-snapshot.md) | Frozen run snapshot vs live dungeon. |
| [ADR-030](../docs/adr/0030-commit-attempt-confirmation.md) | Fixed attempt dan contribution/live separation. |
| [ADR-031](../docs/adr/0031-commit-recovery.md) | Durable recovery, replacement, reorg, cross-tab lock. |
| [Fixtures](../reference/fixtures.json) | Seed, edit mask, rute A/B, expected masks. |
| [Public interface](../reference/IRuinRelay.sol) | Bentuk ABI dan aturan kontrak. |
| [Root test plan](../TEST_PLAN.md), [implementation plan](../IMPLEMENTATION_PLAN.md) | Acceptance lama yang harus dipertahankan. |
| [Board](../src/game/Board.tsx) | Renderer/input baseline sebelum migrasi. |
| [Rules](../src/lib/rules/index.ts), [model](../src/lib/model.ts), [relay](../src/lib/relay.ts) | Implementasi domain yang sudah tersedia. |
| [App](../src/App.tsx), [styles](../src/style.css) | Shell, editor, HUD dan host board. |
| [Package](../package.json) | Phaser 3.90.0 dan command validation existing. |
| [Input regression](../tests/browser/game.spec.ts) | Event dedupe/RAF pause dan wallet-free escape existing. |
| [Release evidence](../docs/release-evidence.md) | Hasil historis lokal, recorded Sepolia deployment dan gap browser release. |

HEAD yang diperiksa: `2f18a91`. Root HANDOFF menyatakan keadaan paket spesifikasi awal; kode yang sekarang sudah ada dibedakan dari pernyataan historis tersebut.

Pemeriksaan lanjutan pada HEAD `7562fa8`: README/release evidence mencatat official Sepolia deployment dan Sourcify verification, sementara dua browser-wallet mutation pada kontrak resmi masih pending. `.env.example` berisi alamat/block resmi; environment lokal aktif belum ditemukan. Akses langsung ke halaman transaksi Arbiscan dan Sourcify tidak berhasil melalui browser tool, sehingga catatan deployment ini belum diverifikasi ulang secara independen dalam sesi tersebut.

## 2. Sumber resmi Phaser

| Sumber | Temuan yang dipakai | Batas |
|---|---|---|
| [Phaser 4 releases](https://phaser.io/download/phaser4) | Daftar yang diperiksa menampilkan 4.2.1, 9 Juli 2026, sebagai entri terbaru. | Cek kembali saat pin dependency; bukan hasil install. |
| [Phaser 4.2.1 release](https://phaser.io/download/release/v4.2.1) | Rujukan release calon baseline. | Compatibility repo belum diuji. |
| [Phaser 4.0 changelog](https://github.com/phaserjs/phaser/blob/master/changelog/v4/4.0/CHANGELOG-v4.0.0.md) | Renderer WebGL baru, perubahan API visual, Canvas deprecated. | File master dapat berubah; cocokkan dengan versi exact implementasi. |
| [Tilemap API 4.0](https://docs.phaser.io/api-documentation/4.0.0/class/tilemaps-tilemap) | Mendukung orientasi isometric. | Dukungan API tidak otomatis menentukan projection custom yang dipilih. |
| [Scene2D Camera API](https://docs.phaser.io/api-documentation/class/cameras-scene2d-camera) | Kamera 2D serta operasi world-point/zoom yang relevan. | Halaman berlabel 4.1 saat diperiksa; validasi pada package exact. |

Tautan migration guide yang ditunjuk changelog tidak berhasil dibaca melalui browser tool pada sesi penyusunan ini. Rencana migrasi diturunkan dari changelog yang berhasil dibaca dan usage aktual repo; detail API tetap menjadi bagian version spike. Tidak ada isi migration guide yang diklaim telah dibaca.

## 3. Penalaran dan rekomendasi sendiri

Rumus SW→NE, rasio 64×32, anchor, batas queue4, tween120ms, palet, pilihan karakter, asset budget, dan target performa merupakan **rancangan usulan paket ini**. Nilainya bukan hasil benchmark Phaser atau persetujuan seni dari pengguna.

Contoh mask/rute berasal dari fixture repo. Panjang rute 20/22 tidak diklaim optimal. Angka frame64 berasal dari penjumlahan daftar asset usulan, bukan asset yang sudah tersedia.

## 4. Riset yang tidak dilakukan

Tidak ada riset kompetitor, klaim market/retention, pemilihan chain baru, pemeriksaan aturan kompetisi terkini, audit smart contract, atau pemeriksaan lisensi aset tertentu yang belum dipilih. Paket ini fokus pengembangan game visual existing dan tidak mengklaim bukti pada bidang tersebut.
