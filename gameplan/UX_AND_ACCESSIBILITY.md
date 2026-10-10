# UX, Kontrol, Aksesibilitas dan Audio

> Pembaruan 11 Oktober 2026: kamera dekat lurus, arah WASD sesuai layar dan artwork v2 menggantikan bagian isometrik/pixel-art awal pada dokumen ini. Lihat [spesifikasi terkini](TOP_DOWN_UPDATE.md), [ADR-038](../docs/adr/0038-close-top-down-camera.md) dan [bukti validasi](VALIDATION_RECORD.md). Aturan domain yang tidak berubah tetap berlaku.

Status: usulan presentasi yang mempertahankan perilaku accepted pada root PRD dan ADR-029–031.

## 1. Struktur layar bermain

Desktop: board isometrik menjadi area utama; panel samping berisi status run, langkah, kontrol, editor dan transaksi. Pada viewport sempit, panel turun di bawah board. Header/landing/history tidak perlu dirombak menyeluruh.

Informasi minimum yang selalu dapat ditemukan:

- Mode lingkungan: Practice / Local Anvil / Arbitrum Sepolia sesuai konfigurasi nyata.
- Playing revision dan live revision jika tersedia.
- Steps `N / 96`.
- Petunjuk fokus dan arah kontrol.
- Restart dan Play latest dengan status disabled/reason.
- Status edit dan attempt tanpa mengandalkan warna canvas.

Tidak meletakkan alamat kontrak/gas/RPC di tengah jalur permainan jika pemain belum masuk flow kontribusi. Detail yang relevan tetap tersedia pada panel review/about.

## 2. State permainan dan state transaksi

State presentasi permainan: loading, playing, escaped/editing, blocked, renderer error. Ini bukan pengganti enum AttemptState. Stale/offline adalah atribut eligibility, tidak selalu menghapus local play.

| Keadaan                         | Board                                   | DOM / tindakan                                            |
| ------------------------------- | --------------------------------------- | --------------------------------------------------------- |
| Loading aset                    | Placeholder/loading, input belum aktif. | “Loading dungeon…”; status attempt tetap dapat dibaca.    |
| Playing                         | Snapshot run, player bergerak.          | Steps, Restart, help.                                     |
| Escaped                         | Player di EXIT, movement berhenti.      | “Dungeon Escaped!” dan pilihan satu edit.                 |
| Draft valid                     | Ghost hasil, outline valid.             | Penjelasan jalur; prepare hanya jika eligible.            |
| Draft invalid                   | Ghost invalid, ikon blokir.             | “That edit blocks every route to the exit.”               |
| Stale                           | Snapshot tetap, badge stale.            | Playing/live revisions; Play latest; commit disabled.     |
| Offline tanpa unresolved        | Snapshot lokal tetap bisa dimainkan.    | Commit disabled sampai observasi pulih.                   |
| Signing                         | Draft beku.                             | Menunggu wallet, tidak mengizinkan edit/reset/new commit. |
| Pending                         | Draft beku, bukan wall permanen.        | Hash/explorer/status reads.                               |
| Unknown / syncing               | Draft/run attempt beku.                 | Retry status dan recovery; tidak resubmit otomatis.       |
| Confirmed                       | Contribution cue sesuai event.          | Revision contribution dan live terpisah; Play latest.     |
| Rejected                        | Tidak ada contribution cue.             | Editor dipertahankan, eligibility dicek lagi.             |
| Reverted / cancelled / replaced | Tidak ada mutation success.             | Penjelasan hasil, refetch, aturan stale tetap.            |
| Reorg menarik confirmation      | Hapus success/effect terkait.           | Status diperiksa ulang; unresolved lock sesuai observer.  |

Network/read failure tidak menjadi animasi “transaksi gagal”. Kegagalan pengamatan tetap dibedakan dari canonical revert.

## 3. Kontrol keyboard

Mapping baseline mengikuti [camera spec](CAMERA_AND_PROJECTION.md): W/↑→NW visual, D/→→NE, S/↓→SE, A/←→SW. Diagram kontrol isometrik dan teks bantuan muncul pada first run dan bisa dibuka lagi.

- Klik board atau Tab ke host memberi fokus.
- Fokus terlihat melalui outline host, bukan warna tile semata.
- R melakukan Restart hanya ketika board fokus dan domain mengizinkan.
- Jangan menangkap panah ketika fokus pada daftar tile, input recovery hash atau modal.
- Tidak ada keyboard trap; Tab dapat meninggalkan board.
- Key event yang sama tidak diproses berulang; auto-repeat baseline diabaikan.

Jika pengguna menginginkan remapping atau screen-direction controls, catat sebagai keputusan terbuka. Jangan merubah arah fixture tanpa pembahasan.

## 4. Editor pointer dan keyboard

Saat escaped, tampilkan 23 target dari mask canonical melalui daftar DOM existing dan highlight pada board. Pada deployment lain, daftar mengikuti mask yang dibaca.

- Hover hanya menyorot target potensial, tidak mengganti selected draft.
- Click footprint editable memilih tile.
- Click noneditable memberikan feedback ringan atau tidak memilih; tidak membuka wallet.
- Daftar DOM memakai button berlabel `Tile 31: floor to wall` sesuai keadaan run.
- Selected button memakai `aria-pressed` atau semantik setara.
- Fokus keyboard pada button dapat meng-highlight tile tanpa menjalankan submit.
- Enter/Space memilih target melalui handler DOM.
- Memilih target baru menghapus ghost lama, mempertahankan satu draft.

Klik top/sisi wall tidak otomatis dianggap footprint lain. Pilihan harus dapat dibatalkan tanpa transaksi.

## 5. Pembatasan attempt

Signing/pending/unknown/syncing mengunci pergerakan run, pilihan tile, Restart, Play latest dan commit baru sesuai relay. History, membaca petunjuk, mute dan reduced motion tetap tersedia karena tidak mengubah attempt.

Kontrol disabled menjelaskan alasan, misalnya “Your previous transaction is still being checked.” Jangan menyembunyikan semua tombol sehingga pengguna tidak tahu apa yang sedang ditunggu.

Retry status hanya membaca. Recovery hash tidak meminta signature. Remount scene atau mengganti preferensi tidak melepaskan lock durable.

## 6. Microcopy produk

Teks produk tetap English; contoh berikut merupakan draft konsisten, bukan kewajiban mengganti semua copy existing:

| Situasi         | Copy                                                                             |
| --------------- | -------------------------------------------------------------------------------- |
| Awal            | “Reach the exit. Then change one tile.”                                          |
| Fokus           | “Click the dungeon, then use WASD or arrow keys.”                                |
| Kontrol         | “Movement follows the diamond grid.”                                             |
| Local escape    | “Dungeon Escaped! Choose one change for the next player.”                        |
| Draft           | “Preview only — not saved to the shared dungeon.”                                |
| Valid           | “Your edit keeps an escape route open.”                                          |
| Invalid         | “That edit blocks every route to the exit.”                                      |
| Stale           | “The shared dungeon changed. Finish as practice or play the latest revision.”    |
| Pending         | “Your change is pending. The shared dungeon has not been confirmed yet.”         |
| Unknown         | “Still checking your transaction. Keep the hash for recovery.”                   |
| Contribution    | “Your change created revision N.”                                                |
| Live lebih baru | “The live dungeon is now revision M.”                                            |
| Renderer error  | “The dungeon view could not load. Your transaction tracking is still available.” |

Jangan memakai “permanent forever”, “final”, “unique human” atau “bot-proof”. Nilai N/M berasal dari verified state, bukan hardcode.

## 7. Visual accessibility

- Wall/floor berbeda lewat volume/pola, tidak hanya hue.
- Valid/invalid memakai ikon dan teks.
- Selected/hover/focus mempunyai penanda yang berbeda.
- Ukuran body text minimal usulan 16 CSS px; status kecil tidak boleh menjadi satu-satunya informasi kritis.
- Target pointer usulan minimal 24×24 CSS px; daftar DOM menyediakan target lebih besar jika diamond downscaled terlalu kecil.
- Teks DOM normal ditargetkan contrast 4.5:1; large text dan kontrol bermakna 3:1, diperiksa pada warna final.
- Tidak ada flashing cepat atau efek yang menutupi path.

Target di atas adalah kriteria internal, bukan klaim audit/sesuai keseluruhan WCAG.

## 8. Canvas dan bantuan nonvisual

Host existing `role="application"` perlu ditinjau lewat penggunaan keyboard/screen reader karena dapat memengaruhi navigasi. Pertahankan atau ubah semantik berdasarkan pemeriksaan, bukan menyalinnya tanpa evaluasi.

Sediakan nama board, posisi tile, langkah, dan bantuan kontrol dalam DOM. Announce local escape, invalid draft, stale state dan status transaksi melalui live region yang sesuai. Jangan membacakan update polling atau setiap tween frame.

P0 menyediakan keyboard play dan editor DOM. Pengalaman puzzle yang sepenuhnya setara untuk pengguna nonvisual memerlukan desain tambahan (misalnya deskripsi tetangga/grid semantik) dan **belum diklaim** oleh paket ini. Catat hasil pemeriksaan dan gap secara jujur.

## 9. Reduced motion

- Hormati `prefers-reduced-motion` sebagai default, dengan toggle bila tersedia.
- Gerak antartile snap atau fade pendek; path tetap identik.
- Matikan shake, idle bob besar, debu berulang dan glow pulse kuat.
- Build/break memakai state change/outline singkat, tanpa menahan confirmation.
- Update preferensi saat bermain tidak restart run atau membuka lock attempt.

## 10. Audio

Audio adalah P1 dan tidak wajib untuk memahami game. Default usulan muted pada kunjungan pertama, opt-in setelah gesture; preferensi boleh disimpan.

- Footstep hanya untuk move legal yang direpresentasikan; jangan memutar belasan suara saat visual fast-forward.
- Blocked cue berbeda dari move, dengan volume rendah dan rate limit.
- Local escape cue berbeda dari contribution confirmed cue.
- Pending/unknown tidak memutar success sound.
- Context restore/remount tidak menggandakan ambience.
- Semua cue mempunyai visual/text equivalent.

## 11. Responsif dan mobile

Desktop mempertahankan seluruh board dan panel yang terbaca. Mobile spectator mempertahankan map, revision, penjelasan dan history tanpa horizontal overflow. Canvas boleh mengecil; tidak menjanjikan keyboard/touch play penuh pada ponsel.

Jika D-pad P1 dibuat, tombol tetap mengirim Direction yang sama ke relay, menghindari halaman scroll tidak sengaja, dan diuji terhadap lock/focus. Tambahan touch tidak mengubah collider, path cap, snapshot atau transaksi.

## 12. Onboarding dan playtest

Onboarding maksimal beberapa instruksi pendek: tujuan, klik untuk fokus, arah gerak diamond, hak satu edit setelah lolos. Penjelasan chain diberikan ketika pemain hendak berkontribusi.

Saat playtest, jangan mengajari mapping sebelum melihat apakah petunjuk cukup. Catat salah arah, salah klik, kehilangan karakter di balik wall, kebingungan draft/confirmed dan keberatan terhadap stale run. Gunakan temuan untuk memperbaiki presentasi sebelum menambah mekanik baru.
