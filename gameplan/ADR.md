# ADR — Arsitektur Presentasi Game

Status: **accepted** untuk ADR-033–037 pada implementasi lokal yang diminta pengguna. Record normatif berada di `docs/adr/`; folder `gameplan/adr/` berisi pointer. Penerimaan keputusan terpisah dari hasil pengujian release.

[ADR-038](../docs/adr/0038-close-top-down-camera.md) kini menggantikan ADR-034 dengan kamera dekat lurus, view overview untuk editor dan artwork v2. Indeks awal berikut mempertahankan sejarah keputusan.

[ADR-039](../docs/adr/0039-escape-only-overview.md) mengganti overview manual dan ukuran view ADR-038: kamera lebih dekat, overview hanya setelah escape untuk editor, serta penjelasan syarat Commit di dekat tombol.

## 1. Hubungan dengan ADR yang sudah ada

| ADR accepted      | Hubungan rencana game                                                                              |
| ----------------- | -------------------------------------------------------------------------------------------------- |
| ADR-001, 004, 005 | Satu dungeon, bitmask 49 tile dan editable mask tetap berlaku.                                     |
| ADR-006, 008      | Gerakan lokal dan validitas path tetap berlaku; animasi tidak menjadi validator.                   |
| ADR-009–011       | Solve-and-edit, BFS dan expectedRevision tetap berlaku.                                            |
| ADR-013           | Tidak menambahkan backend authoritative.                                                           |
| ADR-014           | Pilihan engine diamendemen menjadi Phaser 4 melalui ADR-033. Pemisahan React/Phaser dipertahankan. |
| ADR-016–017       | Wallet opsional, prepare/sign/verify tetap milik flow existing.                                    |
| ADR-021, 024      | Fixture dan rules adalah rujukan; visual bukan otoritas.                                           |
| ADR-027           | Desktop-first; mobile spectator tetap P0, touch playable tetap P1.                                 |
| ADR-028           | Perubahan aturan perlu versioning; pengembangan ini mempertahankan aturan.                         |
| ADR-029           | Run snapshot tidak berubah karena polling live.                                                    |
| ADR-030–031       | Attempt tetap, journal, recovery, replacement dan reorg dipertahankan.                             |

Lihat [ADR utama](../ADR.md) dan [amendment accepted](../docs/adr/0031-commit-recovery.md). Jika proposal detail bertentangan dengan dokumen accepted, perbaiki proposal atau terima amendment secara eksplisit sebelum implementasi terkait.

## 2. Indeks keputusan

| ID                                                     | Keputusan                                                    | Trade-off utama                                                     |
| ------------------------------------------------------ | ------------------------------------------------------------ | ------------------------------------------------------------------- |
| [ADR-033](adr/0033-phaser4-renderer.md)                | Migrasi engine ke Phaser 4 WebGL, React shell dipertahankan. | Fitur renderer baru vs risiko kompatibilitas dan biaya migrasi.     |
| [ADR-034](adr/0034-isometric-presentation.md)          | Proyeksi SW→NE hanya pada presentasi.                        | Kedalaman visual vs kontrol/picking/occlusion lebih kompleks.       |
| [ADR-035](adr/0035-authoritative-run-and-animation.md) | Run authoritative terpisah dari animasi dan draft.           | Konsistensi path/recovery vs kebutuhan rekonsiliasi visual.         |
| [ADR-036](adr/0036-modular-asset-pipeline.md)          | Aset modular dengan anchor, manifest dan provenance.         | Produksi awal lebih terstruktur vs integrasi dan toggle yang andal. |
| [ADR-037](adr/0037-scene-bridge-and-lifecycle.md)      | Satu scene bridge dengan lifecycle yang terikat board host.  | Boundary eksplisit vs perubahan kecil pada adapter existing.        |

Nomor 032–036 diperiksa terhadap record existing 029–031 dan diadopsi pada 11 Oktober 2026.

## 3. Keputusan yang tidak memerlukan ADR tersendiri sekarang

Palet, durasi tween, jumlah variasi batu, volume suara, dan ukuran margin adalah tuning yang mudah dibalik. Nilai awalnya dicatat pada spesifikasi terkait, bukan diperlakukan sebagai keputusan arsitektur accepted.

Gaya pixel art menjadi baseline implementasi lokal. Pengguna dapat mengevaluasi tampilannya; perubahan seni tidak mengubah aturan game.

## 4. Prosedur adopsi yang digunakan

1. Periksa codebase, versi engine, dan nomor ADR terbaru.
2. Evaluasi spike/prototype yang menjawab risiko masing-masing draft.
3. Ubah record sesuai keputusan aktual; jangan mengubah proposed menjadi accepted hanya karena filenya ada.
4. Pindahkan record yang diterima ke `docs/adr/` dengan nomor final.
5. Catat bagian ADR lama yang diamendemen dan pertahankan amendment lain.
6. Perbarui tautan/index serta PRD bila keputusan produk berubah.
7. Hapus/ubah draft menjadi pointer agar tidak ada dua record normatif yang divergen.
