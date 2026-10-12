# Test Plan — Phaser 4 Isometric Game

> Pembaruan 11 Oktober 2026: kamera dekat lurus, arah WASD sesuai layar dan artwork v2 menggantikan bagian isometrik/pixel-art awal pada dokumen ini. Lihat [spesifikasi terkini](TOP_DOWN_UPDATE.md), [ADR-038](../docs/adr/0038-close-top-down-camera.md) dan [bukti validasi](VALIDATION_RECORD.md). Aturan domain yang tidak berubah tetap berlaku.

Status: spesifikasi pengujian untuk implementasi mendatang. Tidak ada baris berikut yang boleh dilabeli PASS sebelum dijalankan pada kode terkait.

Rujukan: [PRD](PRD.md), [camera spec](CAMERA_AND_PROJECTION.md), [root test plan](../TEST_PLAN.md).

## 1. Strategi dan oracle

| Lapisan               | Yang dibuktikan                                   | Oracle                                          |
| --------------------- | ------------------------------------------------- | ----------------------------------------------- |
| Pure geometry         | Projection, inverse, containment, facing, bounds. | Titik numerik independen dan property tests.    |
| Rules regression      | Pergerakan/path/mask tidak berubah.               | Fixture canonical dan validator existing.       |
| Scene/bridge behavior | Input, frame, reset, queue, cleanup.              | State authoritative dan observasi browser.      |
| Browser integration   | Practice, Anvil, editor, wallet/recovery.         | Contract nyata di harness + visible DOM/canvas. |
| Visual/manual         | Style, depth, occlusion, keterbacaan.             | Style sample dan checklist dengan screenshot.   |
| Performance           | Latency, frame time, load dan resource.           | Trace pada perangkat/profil yang dicatat.       |

Tes geometri tidak cukup bila forward dan inverse mengandung kesalahan yang saling membatalkan. Sertakan titik expected tetap: tile 0=(-192,0), 6=(0,-96), 24=(0,0), 42=(0,96), 48=(192,0) pada origin nol.

Tidak perlu unit test internal Phaser atau setiap setter sprite. Uji boundary dengan hasil yang dapat dibaca pemain atau memengaruhi integritas game.

## 2. Data acuan

| Data          | Nilai                                         |
| ------------- | --------------------------------------------- |
| Seed walls    | `0xd053827900a`                               |
| Editable mask | `0x1f9e7e1cf00`                               |
| Route A       | `DRRRRURRDDLDLLDDRDRR`, 20, `0x59afba5156`    |
| Edit A        | Tile 31 → rev1 walls `0xd05b827900a`          |
| Route B       | `DRRRRURRDDLDLLLDDRRDRR`, 22, `0x596bfba5156` |
| Edit B        | Tile 38 → rev2 walls `0xd45b827900a`          |
| Invalid edit  | Tile 8 pada seed: unsolvable.                 |
| Valid open    | Tile 15 pada seed: wall→floor solvable.       |
| Noneditable   | Tile 7, START 0, EXIT 48.                     |

Ambil input fixture dari file canonical pada tests implementasi, bukan menduplikasi fixture buatan di `gameplan/`.

## 3. Geometry dan picking

| ID     | Kasus                                        | Expected result                                                  | P   |
| ------ | -------------------------------------------- | ---------------------------------------------------------------- | --- |
| GEO-01 | Proyeksi lima titik acuan origin nol.        | Tepat sesuai tabel, bukan rotasi terbalik.                       | P0  |
| GEO-02 | Semua 49 tile project→pick.                  | Indeks kembali sama.                                             | P0  |
| GEO-03 | Delta U/R/D/L dari tile tengah.              | NW/NE/SE/SW sesuai tabel kontrol.                                | P0  |
| GEO-04 | Klik interior setiap diamond.                | Target indeks benar pada sampel interior.                        | P0  |
| GEO-05 | Klik shared edge dan vertex.                 | Tie-break deterministic indeks terkecil; tidak nondeterministic. | P0  |
| GEO-06 | Klik di luar board, slab dan backdrop.       | Tidak memilih tile.                                              | P0  |
| GEO-07 | Klik wall top/face di luar footprint.        | Tidak memilih neighbor secara tidak sengaja.                     | P0  |
| GEO-08 | Resize, camera fit, DPR1/2 dan browser zoom. | Target tetap benar; semua corner terlihat.                       | P0  |
| GEO-09 | Bounds lantai.                               | 448×224 untuk W64/H32, sebelum visual padding.                   | P0  |
| GEO-10 | Origin selain nol / translation.             | Project/pick tetap sama secara identitas tile.                   | P0  |
| GEO-11 | Parameter W/H berbeda tetapi rasio valid.    | Transform tidak bergantung angka 64/32 tersebar.                 | P1  |

Sampel edge memakai epsilon kecil di kedua sisi untuk menguji bahwa tile berubah pada batas yang benar. Jangan hanya menguji pusat tile.

## 4. Input, gerak dan animasi

| ID    | Kasus                                            | Expected result                                                        | P   |
| ----- | ------------------------------------------------ | ---------------------------------------------------------------------- | --- |
| IN-01 | Practice tanpa wallet extension.                 | Board ready, keyboard memainkan route A.                               | P0  |
| IN-02 | ArrowUp atau ArrowRight pada START seed.         | Tidak bergerak; langkah tetap nol.                                     | P0  |
| IN-03 | Satu DOM event diproses lagi oleh engine.        | Paling banyak satu move domain.                                        | P0  |
| IN-04 | Dua keypress cepat dengan RAF paused.            | D lalu R menghasilkan tile8, path DR, dua langkah.                     | P0  |
| IN-05 | Banyak input legal saat tween tertinggal.        | Path lengkap; visual catch-up berakhir di posisi authoritative.        | P0  |
| IN-06 | Restart di tengah tween.                         | Posisi START/path kosong; callback lama tidak memindahkan sprite lagi. | P0  |
| IN-07 | Play latest saat animasi dan live berbeda.       | New snapshot atomik, draft/queue lama hilang; rules gate dipatuhi.     | P0  |
| IN-08 | Karakter mencapai EXIT.                          | Satu local escape; movement berikutnya ditolak.                        | P0  |
| IN-09 | Cap 96 sebelum EXIT.                             | Input tambahan tidak mengubah path; petunjuk Restart tersedia.         | P0  |
| IN-10 | Revisit legal.                                   | Langkah dicatat; tidak ditolak oleh renderer.                          | P0  |
| IN-11 | Fokus berada di recovery input/modal/DOM editor. | WASD/arrows/R tidak menggerakkan karakter.                             | P0  |
| IN-12 | Blur/refocus dan tab background/foreground.      | Tidak ada stuck key atau langkah sintetis.                             | P0  |
| IN-13 | event.repeat dan Ctrl/Meta/Alt/composition.      | Diabaikan sesuai policy; path tidak bertambah.                         | P0  |
| IN-14 | Reduced motion diubah saat tween.                | State akhir identik; tidak restart run.                                | P0  |
| IN-15 | Pemain memilih edit sebelum tween EXIT selesai.  | Sprite diselaraskan ke EXIT; editor tetap konsisten.                   | P0  |

Pertahankan test existing “rapid keys are applied once even when animation frames pause”. Perubahan visual tidak menjadi alasan menghapus assertion path/steps.

## 5. Editor dan visual state

| ID    | Kasus                                         | Expected result                                        | P   |
| ----- | --------------------------------------------- | ------------------------------------------------------ | --- |
| ED-01 | Click editable tile sebelum escape.           | Tidak masuk edit/prepare/sign.                         | P0  |
| ED-02 | Tile31 via pointer dan DOM.                   | Pilihan/mask preview sama.                             | P0  |
| ED-03 | Tile8 seed.                                   | Invalid text/icon; prepare/commit disabled.            | P0  |
| ED-04 | Tile15 seed.                                  | Ghost floor benar, solvable; base snapshot tetap wall. | P0  |
| ED-05 | Pilih tile baru.                              | Hanya satu draft; ghost lama hilang.                   | P0  |
| ED-06 | Hover tanpa click.                            | Tidak mengganti selected draft atau memanggil wallet.  | P0  |
| ED-07 | Klik 0/48/7 atau luar board.                  | Tidak ada edit draft illegal.                          | P0  |
| ED-08 | Cancel draft / Restart.                       | Preview bersih; contract/live tidak berubah.           | P0  |
| ED-09 | Poll live N→N+1 saat playing/editing.         | Run mask/path/position tetap; stale Commit disabled.   | P0  |
| ED-10 | Live metadata berubah tanpa mask run berubah. | Tidak reset scene/player/variant.                      | P0  |
| ED-11 | Semua 23 editable target pada seed.           | Board mark dan daftar DOM mengikuti mask persis.       | P0  |

## 6. Integrasi transaksi dan recovery

Suite existing untuk wallet, journal, replacement, observation dan operator-file guard tetap wajib. Tambahan berikut memeriksa dampak presentasi baru:

| ID    | Kasus                                          | Expected result                                               | P   |
| ----- | ---------------------------------------------- | ------------------------------------------------------------- | --- |
| TX-01 | Signing/pending/unknown/syncing.               | Scene dan DOM tidak mengubah run/draft/reset/submit baru.     | P0  |
| TX-02 | Wallet reject.                                 | Editor dipertahankan; tidak ada mutation success effect.      | P0  |
| TX-03 | Hash kembali tetapi belum receipt.             | Pending cue saja, tidak build/break resmi.                    | P0  |
| TX-04 | Receipt sukses tetapi event mismatch/missing.  | Tidak ada success cue; verification status tetap.             | P0  |
| TX-05 | Kontribusi verified N+1, live N+2.             | Label dua revisi; effect untuk contribution N+1 saja.         | P0  |
| TX-06 | Poll/rerender confirmed event sama.            | Effect tidak berulang.                                        | P0  |
| TX-07 | Reload dengan unresolved journal.              | Run/draft restored, scene mengikuti; tidak signing otomatis.  | P0  |
| TX-08 | Speed-up atau cancellation terverifikasi.      | Presentasi mengikuti outcome relay, bukan animation timer.    | P0  |
| TX-09 | Confirmation menjadi orphaned.                 | Success ditarik, effect dibersihkan, lock mengikuti observer. | P0  |
| TX-10 | RPC error saat memeriksa confirmed.            | Tidak mengklaim reorg/failed karena read error saja.          | P0  |
| TX-11 | Dua tab same deployment, akun berbeda.         | At most satu wallet request; lock tercermin di kedua board.   | P0  |
| TX-12 | Scene remount/context lost saat attempt aktif. | Journal/attempt tetap; tidak membuka commit baru.             | P0  |
| TX-13 | Cache successful contribution saat reload.     | Cue menunggu revalidation, bukan cached state saja.           | P0  |

## 7. Visual dan aset

| ID     | Kasus                                           | Expected result                                                | P   |
| ------ | ----------------------------------------------- | -------------------------------------------------------------- | --- |
| VIS-01 | Seed dan revisi1/2.                             | Semua wall cocok fixture; tile31/38 berubah di tempat benar.   | P0  |
| VIS-02 | Empat facing karakter.                          | Bentuk/arah cocok delta, feet anchor stabil.                   | P0  |
| VIS-03 | Karakter di belakang wall dan saat interpolasi. | Tetap teridentifikasi; collision wall tidak berubah.           | P0  |
| VIS-04 | Wall adjacent, corners dan overlapping door.    | Depth benar, tidak ada seam/lompatan layer yang membingungkan. | P0  |
| VIS-05 | Hover/selected/invalid/pending/confirmed.       | Bisa dibedakan melalui bentuk/teks, bukan hue saja.            | P0  |
| VIS-06 | Atlas pada zoom integer/pecahan.                | Tidak ada bleeding/background halo.                            | P0  |
| VIS-07 | Remount dan polling.                            | Texture variants tidak beracak ulang.                          | P0  |
| VIS-08 | 1280×720, 1440×900, 375×812.                    | Corner/endpoint terlihat; halaman tidak overflow horizontal.   | P0  |
| VIS-09 | Critical/optional asset gagal.                  | Error/fallback sesuai; no fake readiness.                      | P0  |
| VIS-10 | Mute, gesture unlock, remount.                  | Tidak ada audio autoplay/duplikasi ambience; cue jujur.        | P1  |

Screenshot regression difokuskan pada state stabil. Freeze clock/idle animation yang diperlukan agar diffs bermakna. Screenshot tidak menggantikan pemeriksaan state domain dan occlusion saat bergerak.

## 8. Lifecycle dan compatibility

| ID      | Kasus                                                   | Expected result                                                 | P   |
| ------- | ------------------------------------------------------- | --------------------------------------------------------------- | --- |
| LIFE-01 | Unmount sebelum lazy import selesai.                    | Tidak membuat instance di host yang hilang.                     | P0  |
| LIFE-02 | 10 mount/unmount dan resize.                            | Satu canvas aktif; listener/audio/observer tidak bertambah.     | P0  |
| LIFE-03 | React development remount.                              | Tidak ada duplikasi input.                                      | P0  |
| LIFE-04 | Restore/context lost simulation bila browser mendukung. | Scene rebuilt dari frame, recovery tetap tersedia.              | P0  |
| LIFE-05 | WebGL unavailable.                                      | DOM error/retry dan status transaksi dapat dibaca.              | P0  |
| LIFE-06 | Chrome dan Firefox stable desktop saat pengujian.       | Engine/render/input bekerja; exact version dicatat.             | P0  |
| LIFE-07 | Safari desktop jika tersedia.                           | Smoke dan visual diperiksa; jika tidak, dukungan belum diklaim. | P1  |

Headless Chromium/SwiftShader dapat memberi smoke tetapi bukan bukti performa GPU laptop. Catat renderer backend ketika mengukur.

## 9. Aksesibilitas

- A11Y-01: Tab menuju/meninggalkan board tanpa trap, focus terlihat.
- A11Y-02: Semua pilihan edit dan recovery dapat dioperasikan keyboard melalui DOM.
- A11Y-03: Invalid/stale/attempt status terbaca tanpa warna/suara.
- A11Y-04: Reduced motion menghasilkan path/mask sama dan menghentikan efek besar.
- A11Y-05: Contrast text/control final diperiksa; tidak mengklaim compliance penuh tanpa audit.
- A11Y-06: Screen reader smoke memeriksa role board dan pengumuman penting tanpa spam tiap polling.

## 10. Performa

PERF-01 first playable; PERF-02 input latency; PERF-03 frame time; PERF-04 asset transfer/texture memory; PERF-05 resource trend setelah remount. Target ada pada PRD, metode harus dicatat bersama hasil.

Prosedur: build production, cold-cache load yang dicatat, warm-up 10 detik, rekam 60 detik gerak/preview, ulang 3 kali pada hardware/power/browser/network sama. Laporkan median dan p95, serta jank terlihat. Pengukuran FPS rata-rata saja dapat menyembunyikan pause panjang.

Jika belum ada perangkat uji, biarkan hasil pending. Tidak menggunakan hasil build untuk mengklaim target FPS/load tercapai.

## 11. End-to-end lokal

1. Mulai fresh Anvil deployment menggunakan harness existing.
2. Browser A memainkan route A melalui keyboard scene, memilih31 melalui board/DOM, lalu sign melalui flow existing.
3. Verifikasi receipt/event/revision1/mask dan cue contribution.
4. Browser B memuat rev1, memainkan route B, memilih38 dan sign.
5. Verifikasi rev2/mask/history dan seluruh endpoint tetap floor.
6. Ulang satu stale race dan satu invalid preview8.
7. Simpan log, screenshot dan commit; label bukti **Local Anvil**.

Untuk release Sepolia, gunakan prosedur root release evidence dengan dua profil wallet dan hash nyata. Tidak melakukan auto-deploy sebagai bagian test visual.

## 12. Traceability requirement

| Requirement PRD | Tes utama                                   |
| --------------- | ------------------------------------------- |
| FR-01           | LIFE-06 + migration version/build evidence. |
| FR-02–05        | GEO-01/02/08/09, VIS-01/08.                 |
| FR-06–08        | IN-01–10 + existing rules/contract suites.  |
| FR-09–10        | GEO-04–07, ED-01–08.                        |
| FR-11           | ED-09/10, TX-05.                            |
| FR-12–14        | TX-01–13 + existing recovery suites.        |
| FR-15           | VIS-03/04.                                  |
| FR-16–17        | LIFE-01–05, VIS-09.                         |
| FR-18–19        | A11Y-01–06, IN-11/14.                       |
| FR-20           | ASSET_SPEC acceptance + VIS-02/06/07.       |

## 13. Go/no-go

No-go: tile/index/path mismatch, lost/duplicated legal input, ghost dianggap committed, snapshot diganti polling, recovery lock terbuka akibat renderer, critical endpoint terpotong, atau aset tidak dapat didistribusikan secara sah.

Go lokal: seluruh P0 berhasil pada commit final, style/orientasi diterima, evidence dapat direproduksi, gap P1 jelas. Gunakan [validation record](VALIDATION_RECORD.md) untuk hasil; jangan mengubah test plan menjadi laporan PASS massal.
