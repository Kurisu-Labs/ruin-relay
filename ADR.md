# Ruin Relay — Architecture Decision Records (ADR)

> **Versi:** 1.0 | **Tanggal:** 10 Oktober 2026 | **Scope:** Colosseum Crypto World’s Fair 2026 / Arbitrum Sepolia  
> **Status keseluruhan:** Accepted for MVP design, belum diimplementasikan/audit  
> **Dokumen produk:** [`PRD.md`](PRD.md)  
> **Spesifikasi antarmuka:** [`reference/IRuinRelay.sol`](reference/IRuinRelay.sol), [`reference/fixtures.json`](reference/fixtures.json)  
> **Rencana pengujian:** [`TEST_PLAN.md`](TEST_PLAN.md)

**Amendment diterima:** [ADR-029 — Run snapshot terpisah dari live dungeon](docs/adr/0029-frozen-run-snapshot.md) menggantikan acceptance pemuatan papan pada ADR-014; [ADR-030 — Konfirmasi terhadap commit attempt](docs/adr/0030-commit-attempt-confirmation.md) memperinci ADR-017 dan rekonsiliasi §C.5. Istilah domain mengikuti [`GLOSSARY.md`](GLOSSARY.md).

[ADR-031 — Pemulihan commit berdasarkan bukti hasil](docs/adr/0031-commit-recovery.md) memperinci recovery, replacement, dan reorg pada ADR-017/023; aturan operasional ada di §C.7. [ADR-032 — Bukti untuk commit attempt tanpa hash](docs/adr/0032-hashless-attempt.md) menambah pengecualian read-only pada attempt yang belum punya hash.

[ADR-033](docs/adr/0033-phaser4-renderer.md) mengganti engine ADR-014 menjadi Phaser 4. Presentasi lurus dengan kamera dekat mengikuti [ADR-038](docs/adr/0038-close-top-down-camera.md), yang menggantikan proyeksi isometrik [ADR-034](docs/adr/0034-isometric-presentation.md) berdasarkan feedback pengguna. Pemisahan animasi, aset modular dan lifecycle bridge mengikuti [ADR-035](docs/adr/0035-authoritative-run-and-animation.md), [ADR-036](docs/adr/0036-modular-asset-pipeline.md), dan [ADR-037](docs/adr/0037-scene-bridge-and-lifecycle.md). Status pengujian implementasi dicatat terpisah dari penerimaan keputusan.

[ADR-039](docs/adr/0039-escape-only-overview.md) menggantikan overview manual dan ukuran view pada ADR-038: peta penuh hanya muncul setelah local escape untuk editor, kamera bermain lebih dekat, dan alasan Commit nonaktif dijelaskan di panel edit.

## A. Ringkasan arsitektur terkunci

**Keputusan inti:** gunakan satu kontrak Solidity sebagai canonical state + validator untuk satu puzzle dungeon 7×7. Pergerakan karakter terjadi lokal di Phaser. Setelah pemain mencapai EXIT pada snapshot revisi tertentu, UI meminta wallet mengirim satu transaksi **solve-and-edit**. Kontrak memvalidasi path pada peta lama, mengganti satu bit tile, menjalankan BFS pada peta baru, memperbarui revisi, dan mengirim event. Tidak diperlukan backend real-time atau token.

```text
                                     Arbitrum Sepolia (421614)
  Browser / Phaser             +----------------------------------+
  +-------------------------+  | RuinRelay.sol                    |
  | Local movement & HUD    |  | - uint64 walls                  |
  | Path packer / local BFS |--| - uint64 revision               |
  | Wallet via viem/wagmi   |  | - uint64 editableMask (immut.)  |
  +-------------------------+  | - verify path on old walls       |
       |    ^                 | - verify new walls reachable    |
       |    | eth_call + logs | - emit DungeonMutated             |
       +----+-----------------+----------------------------------+
                     Public RPC; no authoritative game server
```

**State machine contract:** Valid rev N + valid path + valid editable tile + solvable resulting map → rev N+1; semua kondisi lain revert tanpa perubahan. **Gameplay UI:** loading → playing → escaped → editing; stale adalah status snapshot run. **Commit attempt:** signing → pending / unknown → syncing → confirmed, dengan hasil terverifikasi lain berupa rejected / reverted / cancelled / replaced; reorg dapat mengembalikan hasil sebelumnya ke unknown. Detail dan transisi pemulihan ada di §C.7.

### Invariant kontrak (normatif)

1. `0 <= revision <= type(uint64).max`; setiap transaksi mutasi berhasil menambah `revision` **tepat satu**.
2. `walls >> 49 == 0`; `editableMask >> 49 == 0`.
3. Start (bit 0) dan exit (bit 48) tidak boleh wall ataupun editable.
4. Peta saat ini selalu memiliki rute dari tile 0 ke tile 48.
5. Satu mutasi sukses mengubah tepat satu bit yang diizinkan: `popcount(oldWalls XOR newWalls) == 1`.
6. Path yang diterima valid pada **oldWalls**, bukan candidate map, dan berakhir di EXIT persis pada langkah terakhir.
7. `revision` saat commit sesuai `expectedRevision`; transaksi revisi stale tidak mempunyai efek state.
8. Event mutasi merepresentasikan state pascamutasi dan sender transaksi sebenarnya (`msg.sender`).
9. Tidak ada ETH/ERC20/NFT yang dikelola kontrak. Tidak ada fungsi admin untuk mengubah peta sewaktu-waktu.
10. Input replays/public path tidak menghasilkan reward bernilai finansial.

## B. Daftar ADR dan keputusan

### ADR-001 — Satu dungeon persisten bersama

**Status:** Accepted (MVP)  
**Konteks:** Hackathon butuh gameplay dan efek onchain yang terlihat langsung; membuat banyak dungeon menciptakan layer factory, discovery, storage, dan konten level.  
**Keputusan:** MVP hanya punya **satu global board**, satu seed, satu urutan revisi. Setiap kemenangan yang menghasilkan mutasi sah memperbarui tantangan yang sama untuk semua pengguna.  
**Alternatif:** dungeon per pemain; banyak room; level procedural; one-room-per-NFT.  
**Konsekuensi:** alur produk mudah dipahami dan demo lebih kuat; throughput kontribusi terserialisasi, risiko griefing meningkat.  
**Acceptance:** dua browser pada contract address sama membaca revision dan mask yang sama ketika state sudah direkonsiliasi.

### ADR-002 — Arbitrum Sepolia sebagai target deploy

**Status:** Accepted (MVP)  
**Konteks:** Perlu EVM contract dan transaksi nyata untuk track Arbitrum dengan biaya eksperimen yang terkendali.  
**Keputusan:** deploy ke Arbitrum Sepolia (`chainId=421614`, RPC publik `https://sepolia-rollup.arbitrum.io/rpc`, explorer `https://sepolia.arbiscan.io`). Semua alamat kontrak masuk file config publik, tidak hardcode di dalam game logic.  
**Alternatif:** Ethereum mainnet (biaya dan risiko), Arbitrum One (biaya nyata), local Anvil saja (kurang kuat untuk submission).  
**Konsekuensi:** faucet/testnet dan RPC menjadi dependency demo; produk tidak boleh dipasarkan sebagai mainnet-ready atau memiliki aset riil.  
**Acceptance:** verified address dan dua mutation event hidup pada chain 421614, bukan chain lokal.

### ADR-003 — Solidity + Foundry, tanpa Stylus atau proxy upgrade

**Status:** Accepted (MVP)  
**Konteks:** Logic puzzle kecil didominasi bit operations, checks, dan BFS bounded; mengadopsi Rust/Stylus dan proxy menambah permukaan risiko.  
**Keputusan:** Solidity versi compiler yang dipin (`pragma solidity ^0.8.24` atau versi patch lebih baru yang diuji), Foundry test/deploy, contract immutable dari sisi upgradeability.  
**Alternatif:** Stylus/Rust, Diamond/proxy, onchain interpreter.  
**Konsekuensi:** keamanan dan auditability lebih sederhana; perubahan fundamental rules memerlukan deploy baru, diikuti migrasi UI secara eksplisit.  
**Acceptance:** `forge test` lulus, ABI verified, tidak ada upgrade admin.

### ADR-004 — Representasi board `uint64` untuk 49 tile

**Status:** Accepted (MVP)  
**Konteks:** Board 7×7 mempunyai 49 state boolean. Array storage boros dan rawan divergensi client.  
**Keputusan:** `walls` adalah `uint64` bitmask. `i = 7*y+x`; bit ke-i = 1 untuk wall; 0 untuk floor. Nilai di atas bit 48 ditolak pada constructor. Tile 0 dan 48 wajib floor.  
**Alternatif:** `bool[49]`, bytes/string map, packed tiles dalam bytes32.  
**Konsekuensi:** single storage slot, bitwise toggle sederhana; parsing memerlukan test parity TypeScript–Solidity.  
**Acceptance:** fixture ASCII `S#.#...` dst menghasilkan `walls=0xd053827900a` persis.

### ADR-005 — Seed dan playable editable mask adalah konfigurasi immutable

**Status:** Accepted (MVP)  
**Konteks:** Tanpa batas editing, user bisa menghapus start/exit atau merusak visual dan game feel; seed seharusnya dapat direproduksi.  
**Keputusan:** deploy constructor menerima `initialWalls` dan `editableMask`/`editMask`. Constructor cek valid 49 bit, START/EXIT bukan wall/editable, initial board reachable, `editMask != 0`, dan tidak membiarkan konfigurasi diganti setelah deploy. Mask kanonik tersimpan di fixtures.  
**Alternatif:** semua sel bisa diedit; allowlist disimpan backend; admin mengganti mask tiap hari.  
**Konsekuensi:** curasi menjaga MVP; karena mask fixed, beberapa tile tetap tidak dapat dimainkan meskipun valid secara algoritmis.  
**Acceptance:** builder tidak bisa deploy mask dengan endpoint editable, out-of-bounds, atau seed tanpa rute.

### ADR-006 — Aktivitas gameplay lokal; chain tidak digunakan per langkah

**Status:** Accepted (MVP)  
**Konteks:** Meminta transaksi untuk setiap gerak mengurangi feel puzzle dan memperbanyak signing.  
**Keputusan:** path dikumpulkan lokal. Saat victory, satu submit memverifikasi seluruh run. Tidak ada langkah offchain yang diklaim immutable sebelum tx confirmed.  
**Alternatif:** move per transaction; game server authoritative; ZK proof interaktif.  
**Konsekuensi:** game lancar tetapi aktivitas lokal dapat direkayasa; validator memeriksa path matematika, bukan perilaku manusia.  
**Acceptance:** pemain menekan arah dan selesai tanpa wallet.

### ADR-007 — Encoding path 2 bit little-endian dalam `uint256`

**Status:** Accepted (MVP)  
**Konteks:** ABI `uint8[]` mahal secara calldata; board hanya butuh empat arah.  
**Keputusan:** encode masing-masing arah dengan dua bit: `U=0`, `R=1`, `D=2`, `L=3`. Langkah `i` disimpan pada bit `2*i`. Gunakan `moveCount` eksplisit 1..96. Tolak bila `(packedDirections >> (2*moveCount)) != 0` untuk canonical encoding.  
**Alternatif:** string `"URDDL"`; array bytes; Merkle commitment.  
**Konsekuensi:** kompak dan mudah diverifikasi, tetapi human readability memerlukan decoder di UI. `moveCount=96` muat pada 192 bit `uint256`.  
**Acceptance:** fixture rev0 path `DRRRRURRDDLDLLDDRDRR` menjadi `0x59afba5156`, `moveCount=20`.

### ADR-008 — Definisi valid escape path

**Status:** Accepted (MVP)  
**Konteks:** Jika hanya memeriksa posisi akhir secara lokal, siapa pun dapat skip tembok.  
**Keputusan:** pemeriksaan onchain mengawali `pos=0`, membaca arah berurutan, menolak out-of-bounds, menolak wall pada `oldWalls`, menolak tiba di EXIT sebelum langkah terakhir, dan mengharuskan posisi final = 48. Revisit cell diizinkan; path length di-hard-cap.  
**Alternatif:** shortest path only; non-repeating path; proof from signed backend.  
**Konsekuensi:** mendukung eksplorasi bebas dan sederhana; dapat diautomasi dan path yang sudah onchain bisa disalin. Tidak ada reward finansial.  
**Acceptance:** semua tes edge path / wall / early exit / length di `TEST_PLAN.md`.

### ADR-009 — Solusi dan edit digabung dalam satu transaksi atomik

**Status:** Accepted (MVP)  
**Konteks:** Transaksi terpisah untuk klaim kemenangan dan edit memungkinkan grief/spam/timing window, memerlukan token izin sementara.  
**Keputusan:** satu call `completeAndMutate(expectedRevision, packedDirections, moveCount, tileIndex)` memvalidasi solve dan edit terhadap revisi sama lalu commit sekali.  
**Alternatif:** `claimWin` lalu `editTile`; role NFT setelah menang; server-issued coupon.  
**Konsekuensi:** gas lebih besar per transaksi tetapi lifecycle UX sederhana; pemain yang menang dan tidak mengedit tidak meninggalkan record di chain.  
**Acceptance:** setiap event `DungeonMutated` memiliki tepat satu update revisi dan tile.

### ADR-010 — Verifikasi solvability dengan BFS bounded onchain

**Status:** Accepted (MVP)  
**Konteks:** Pemain tidak boleh mengubah dungeon menjadi mustahil ditembus. Proof jalur untuk map baru melalui calldata akan membuka solusi map berikutnya secara publik.  
**Keputusan:** kontrak menghitung BFS di memori pada **candidateWalls**, maksimal 49 node × 4 tetangga. Gunakan visited bitmask `uint64` dan queue `uint8[49] memory`, iterasi neighbor dengan boundary check sebelum bit shift. Kembalikan true jika EXIT tercapai; jika queue habis, false.  
**Alternatif:** DFS rekursif (stack risk), meminta witness path baru (bocor solusi berikutnya), backend oracle (centralized), SNARK (overkill).  
**Konsekuensi:** proof baru tidak bocor, invariant dipaksakan onchain; biaya gas harus diukur pada Sepolia.  
**Acceptance:** mutation yang memblok seluruh rute revert `UnsolvableMutation`; BFS parity dengan TypeScript dan grid exhaustive/fuzz.

### ADR-011 — Optimistic concurrency melalui `expectedRevision`

**Status:** Accepted (MVP)  
**Konteks:** Dua pemain bisa memecahkan snapshot N bersamaan. Hanya satu perubahan yang boleh diterapkan terhadap snapshot tersebut.  
**Keputusan:** syarat pertama `expectedRevision == revision`. Jika salah, revert custom error `StaleRevision(expected, actual)`. Tidak ada auto-retry dengan menggunakan path lama terhadap map baru.  
**Alternatif:** optimistic last-write-wins, queue offchain, locks terpusat.  
**Konsekuensi:** race tetap mungkin menimbulkan biaya tx revert; sistem deterministik dan tidak silently overwrite.  
**Acceptance:** bila dua tx memakai N, hanya satu yang sukses; revision N+1, bukan N+2.

### ADR-012 — Event log adalah history; storage hanya current state

**Status:** Accepted (MVP)  
**Konteks:** Menyimpan seluruh 49-bit board per revisi di storage menambah biaya yang tidak perlu.  
**Keputusan:** state storage menyimpan `walls`, `revision`, `editableMask`. Emit `DungeonMutated(revision, editor, tileIndex, becameWall, wallMask)` sebagai log. UI mengambil latest 10–20 log dengan filter kontrak dan block range paginated.  
**Alternatif:** append semua revisi di contract storage, centralized DB, The Graph indexer.  
**Konsekuensi:** history bergantung ketersediaan logs dari RPC; kontrak tetap playable jika history service gagal.  
**Acceptance:** history rev1,rev2 cocok `wallMask` dan tx; duplikasi event tidak menghasilkan duplikasi baris.

### ADR-013 — UI tidak mempunyai backend game authoritative

**Status:** Accepted (MVP)  
**Konteks:** Multiplayer sinkron bukan kebutuhan; server menambah biaya dan potensi inkonsistensi.  
**Keputusan:** deploy static SPA (Vite) atau Next export dengan host web biasa; game membaca state langsung dari RPC, perubahan melalui wallet. Tidak perlu WebSocket server, PostgreSQL, atau session service.  
**Alternatif:** Node WebSocket game server, REST state API, game state terpusat.  
**Konsekuensi:** biaya operasional rendah; RPC reliability memengaruhi keterbaruan UI.  
**Acceptance:** saat web host berjalan dan API tim lainnya mati, game masih mampu membaca Arbitrum Sepolia dari RPC.

### ADR-014 — Phaser untuk render 2D, React untuk shell UI

**Status:** Accepted (MVP)  
**Konteks:** Pemain perlu animasi tile sederhana dan UI wallet yang konsisten.  
**Keputusan (diamendemen ADR-033–037):** Phaser 4 + TypeScript untuk presentasi map/player; host React menangkap focused keyboard intent dan mengelola landing, editor, tx state, history. Satu bridge memberi frame dan callback spesifik supaya Phaser tidak menyimpan state chain kedua.\
**Alternatif:** HTML canvas murni, Unity/WebGL, React grid DOM penuh.  
**Konsekuensi:** tambahan library tetapi produktif untuk game feel; integration boundary perlu dijaga.  
**Acceptance (diamendemen ADR-029):** pemilihan snapshot untuk run memanggil `game.loadBoard(snapshot)` secara atomik. Refetch live dungeon tidak mengganti run aktif; lihat [ADR-029](docs/adr/0029-frozen-run-snapshot.md).

### ADR-015 — viem/wagmi untuk EVM RPC & wallet

**Status:** Accepted (MVP)  
**Konteks:** Butuh connecting wallet, chain switch, contract simulate/write dan transaction receipt.  
**Keputusan:** gunakan wagmi wallet connection + viem public/wallet clients; `chain.id=421614` explicit; pelaku wallet hanya menandatangani fungsi `completeAndMutate`, tidak memberi approval ke token.  
**Alternatif:** ethers-only, custom EIP-1193, account abstraction untuk semua.  
**Konsekuensi:** dependensi React relatif ringan; wallet extension tetap perlu dipasang untuk kontribusi, belum onboarding mainstream.  
**Acceptance:** connect, reject, wrong network, insufficient test ETH, pending, success, revert semua memiliki UX jelas.

### ADR-016 — Wallet opsional sampai edit permanen

**Status:** Accepted (MVP)  
**Konteks:** Wallet-gate di awal mengurangi discovery dan mengubah game menjadi transaksi-first.  
**Keputusan:** read-only and local play tersedia tanpa wallet. Pemain yang selesai puzzle dapat menekan **Commit on Arbitrum** untuk membuka connection flow.  
**Alternatif:** connect-on-entry, anonymous relayer/gas sponsorship.  
**Konsekuensi:** commit conversion belum tentu tinggi, tetapi akses game jauh lebih sederhana.  
**Acceptance:** first successful local escape tanpa wallet extension.

### ADR-017 — TX lifecycle: simulate, sign, wait, reconcile

**Status:** Accepted (MVP)  
**Konteks:** Button sukses yang berubah sebelum receipt bisa memberi klaim palsu.  
**Keputusan (diperinci ADR-030):** sebelum signing, refetch current revision, simulasikan path/tile, dan tangkap run snapshot, payload, akun, chain, serta kontrak tujuan sebagai satu commit attempt tetap. Selama signing/pending, kunci perubahan tile, Restart, Play latest, dan submit ulang; history tetap dapat dilihat, dan penolakan wallet mengembalikan editor yang dipertahankan. Sesudah broadcast, tampilkan hash pending; konfirmasi receipt/event terhadap attempt tersebut dan rekonsiliasi live dungeon sesuai §C.5. Jika receipt sukses tetapi event belum tersedia, tampilkan "confirmation syncing" dan ulangi pembacaan.  
**Alternatif:** optimistically update as committed, rely solely on tx hash, backend confirmer.  
**Konsekuensi:** UX sedikit lebih lambat tetapi konsisten. L2 receipt bukan berarti telah final di Ethereum L1; jangan mengklaim finality absolut.  
**Acceptance:** reject, revert, stale, mismatch receipt/events tidak menghasilkan success. Event sah untuk N+1 tetap mengonfirmasi kontribusi bila live dungeon sudah N+2; UI menampilkan revisi kontribusi dan revisi live secara terpisah. Lihat [ADR-030](docs/adr/0030-commit-attempt-confirmation.md).

**Pemulihan (ADR-031):** timeout tetap unresolved; attempt dipulihkan setelah reload dan diperiksa kembali. Replacement dan reorg mengikuti §C.7. Kunci kontrol juga berlaku selama unknown/syncing.

### ADR-018 — Tidak ada tokenomics atau NFT pada MVP

**Status:** Accepted (MVP)  
**Konteks:** Monetary rewards menarik bot dan memerlukan mekanisme proof-of-human/score integrity yang tidak tersedia.  
**Keputusan:** tidak ada ERC20/721/1155, tidak ada real-value stake atau payment. Kontributor tercatat sebagai `msg.sender` pada event; leaderboard informal P1 hanya untuk fun.  
**Alternatif:** mint NFT per run, token economy, entry fee atau wager.  
**Konsekuensi:** lebih aman dan feasible; bisnis masih berupa hipotesis yang harus diuji.  
**Acceptance:** kontrak tidak menerima deposit/withdraw/transfer dan UI tidak meminta token approvals.

### ADR-019 — Anti-cheat dimaknai sebagai validity, bukan human authenticity

**Status:** Accepted (MVP)  
**Konteks:** Semua board data publik; solver otomatis dapat membuat route valid dengan BFS dan mengirim transaksi tanpa bermain manual.  
**Keputusan:** klaim hanya bahwa route valid berdasarkan rules dan edit tidak membuat map buntu. Tidak memakai istilah "bot-proof" atau "fair speedrun". Jelaskan keterbatasan di About dan README.  
**Alternatif:** captcha centralized, hidden map, trusted anti-cheat server, ZK attestations.  
**Konsekuensi:** bot dapat mengubah board berkali-kali; tidak ada financial advantage dalam MVP.  
**Acceptance:** README menjelaskan batas dan pitch tidak mengklaim pembuktian pemain manusia.

### ADR-020 — Anti-grief minimal berupa edit mask + solvability

**Status:** Accepted (MVP)  
**Konteks:** Jika pemain boleh menghapus semua jalan, level rusak permanen.  
**Keputusan:** whitelist tile edit dan BFS; tidak menambahkan sybil-resistant permission, deposit, atau cooldown yang mempersulit demo. Beri before/after preview.  
**Alternatif:** curated edits by moderators, epoch cooldown, anti-bot fees.  
**Konsekuensi:** masih bisa di-spam untuk membuat puzzle mudah/berulang; prefer sempurnakan di pilot berdasarkan playtest.  
**Acceptance:** editor tidak dapat flip endpoint/noneditable atau membuat map unreachable.

### ADR-021 — Source of truth dan parity lintas bahasa

**Status:** Accepted (MVP)  
**Konteks:** Risiko bug paling umum adalah arah bitpacking dan row/column orientation tidak cocok.  
**Keputusan:** `reference/fixtures.json` menjadi kumpulan input/output kanonik; TypeScript dan Solidity harus menguji hasil yang sama. Tidak boleh ada dua mapper `x,y→index` independen tanpa shared test.  
**Alternatif:** manual screenshots, random-only testing.  
**Konsekuensi:** membutuhkan sedikit pekerjaan test awal; mencegah kegagalan demo.  
**Acceptance:** test reference route, wall masks untuk rev0/1/2 identik di frontend & kontrak.

### ADR-022 — No privileged owner, no backend editorial override

**Status:** Accepted (MVP)  
**Konteks:** Jika owner bisa edit/downgrade peta, narasi "community-shaped" tidak dapat diverifikasi.  
**Keputusan:** setelah deploy, admin tidak punya fungsi mutate paksa, freeze, atau reset. Jika seed salah, deploy baru dan perbarui address dengan disclosure jelas.  
**Alternatif:** Ownable pausable, role-based emergency editor, offchain map state.  
**Konsekuensi:** kesalahan deployment tidak bisa diperbaiki tanpa redeploy; tetapi aman dari privileged state manipulation.  
**Acceptance:** ABI tidak memiliki admin write function untuk `walls`/`revision`.

### ADR-023 — History via bounded event queries dengan reorg resilience

**Status:** Accepted (MVP)  
**Konteks:** Public RPC tidak menjamin event scan tak terbatas atau WebSocket.  
**Keputusan:** `getLogs` per block window terbatas dan page 10–20 results; dedupe dengan chain+txHash+logIndex; jika ada log hilang atau reorg, refetch latest onchain snapshot dan label historical log unavailable. Poll `getDungeon()` ringan / refetch pada focus dan after tx.  
**Alternatif:** full blockchain indexer sebagai dependency P0.  
**Konsekuensi:** history panjang bisa lebih lambat, tetapi gameplay tidak terkunci pada indexer.  
**Acceptance:** event query error tidak memblok game atau membuat state palsu.

**Pemulihan (ADR-031):** hapus log yang terbukti orphaned, tarik success yang kehilangan inclusion canonical, dan periksa ulang attempt sesuai §C.7. Snapshot run yang berbeda layout menjadi stale walau nomor revisinya sama.

### ADR-024 — Game UI sebagai visualisasi state, bukan trusted verifier

**Status:** Accepted (MVP)  
**Konteks:** Frontend bisa dibajak atau diubah pengguna; kontrak harus benar meski bypass UI.  
**Keputusan:** `localValidatePath()` dan `localIsSolvable()` hanya preview. Seluruh precondition diulang kontrak. State banner mengambil nilai onchain, bukan sekadar local React state.  
**Alternatif:** backend validation only, frontend validation only.  
**Konsekuensi:** sedikit duplikasi rule cross-language yang harus dijaga fixture parity.  
**Acceptance:** panggilan langsung ke ABI dengan tile invalid tetap revert.

### ADR-025 — Security posture: minimal external attack surface

**Status:** Accepted (MVP)  
**Konteks:** Smart contract game dengan dana/token menciptakan blast radius lebih besar.  
**Keputusan:** tidak ada external calls, token handling, delegatecall, upgrade hooks, user-supplied arbitrary code, atau dynamic loops tanpa batas. Bounded loops: path ≤96 dan BFS ≤49×4; custom errors untuk invalid input.  
**Alternatif:** plugin-driven onchain game interpreter / extensible arbitrary action handlers.  
**Konsekuensi:** scope sangat terbatas dan mudah diuji; bukan sertifikasi keamanan penuh.  
**Acceptance:** `forge inspect`, test, fuzz, gas snapshots, code review; tidak ada `.call` eksternal pada mutation path.

### ADR-026 — Pengukuran dan data minimal

**Status:** Accepted (MVP)  
**Konteks:** Perlu sinyal produk tanpa mengumpulkan identitas pribadi.  
**Keputusan:** ukuran agregat opt-in atau analytics tanpa wallet-level profiling: page viewed, started run, reached exit, previewed edit, transaction attempted, tx confirmed/reverted (tanpa PII). Onchain address/edits tetap publik.  
**Alternatif:** login/email database, in-game behavioral replay telemetry.  
**Konsekuensi:** daya analisis terbatas; untuk MVP cukup observasi manual dari tester.  
**Acceptance:** tidak mengirim private key, raw signature, IP/address linkage ke analytics pihak ketiga secara tidak perlu.

### ADR-027 — Mobile friendly read-only, desktop-first controls

**Status:** Accepted (MVP)  
**Konteks:** Deadline sangat singkat; dukungan gamepad touch meningkatkan QA matrix.  
**Keputusan:** desktop keyboard P0; mobile UI tidak rusak dan bisa melihat map/history, D-pad opsional P1.  
**Alternatif:** mobile native, Flutter, Unity.  
**Konsekuensi:** jangkauan mobile terbatas pada MVP; jangan mengiklankan "playable on any device" sampai D-pad selesai.  
**Acceptance:** Chrome/Firefox desktop diuji, mobile narrow viewport tidak clipped.

### ADR-028 — Perubahan aturan gameplay harus versioned

**Status:** Accepted (MVP)  
**Konteks:** Kontrak immutable dan encoding eksplisit berarti perubahan spesifikasi memengaruhi keamanan serta kompatibilitas client.  
**Keputusan:** setiap perubahan `BOARD_SIZE`, direction enum, start/exit, edit mask, cap step, atau event layout harus punya ADR amendment, fixture baru, deployment baru, serta version gating pada frontend.  
**Alternatif:** diam-diam mengganti UI rules setelah deploy.  
**Konsekuensi:** lambat mengubah rules tetapi mengurangi canonical state confusion.  
**Acceptance:** UI memvalidasi `chainId+contractAddress+expected constants` sebelum commit.

## C. Spesifikasi kontrak referensi (normatif)

### C.1 Interface publik

Referensi ABI eksplisit ada pada [`reference/IRuinRelay.sol`](reference/IRuinRelay.sol). Implementasi final harus setidaknya kompatibel dengan shape berikut:

```solidity
interface IRuinRelay {
    event DungeonMutated(
        uint64 indexed revision,
        address indexed editor,
        uint8 indexed tileIndex,
        bool becameWall,
        uint64 wallMask
    );

    error StaleRevision(uint64 expected, uint64 actual);
    error InvalidMoveCount(uint8 count);
    error NonCanonicalDirections();
    error InvalidStep(uint8 stepIndex);
    error PathDoesNotReachExit();
    error ExitReachedEarly(uint8 stepIndex);
    error TileNotEditable(uint8 tileIndex);
    error UnsolvableMutation();

    function getDungeon()
        external view
        returns (uint64 walls, uint64 revision, uint64 editableMask);

    function completeAndMutate(
        uint64 expectedRevision,
        uint256 packedDirections,
        uint8 moveCount,
        uint8 tileIndex
    ) external;

    function isSolvable(uint64 candidateWalls) external pure returns (bool);
}
```

Kontrak implementasi tetap perlu menyimpan deklarasi constants seperti `START=0`, `EXIT=48`, `BOARD_SIZE=7`, `MAX_MOVES=96` agar dapat diperiksa publik. Query `isSolvable()` mengembalikan `false` untuk kandidat dengan bit di atas 48 atau START/EXIT berupa wall; kandidat valid mengembalikan hasil reachability. Constructor dan operasi mutasi tetap menolak input yang melanggar invariant; query ini bukan satu-satunya authorization.

### C.2 Operasi `completeAndMutate` — urutan checks

```text
function completeAndMutate(expectedRev, packedDirs, moveCount, tile):
  require(expectedRev == revision, StaleRevision)
  require(1 <= moveCount <= 96, InvalidMoveCount)
  require((packedDirs >> (2*moveCount)) == 0, NonCanonicalDirections)
  _validatePathAgainst(walls, packedDirs, moveCount)
  require(tile < 49 && editableMask has bit tile, TileNotEditable)
  newWalls = walls XOR (1 << tile)
  require(_isSolvable(newWalls), UnsolvableMutation)
  // all checks complete before storage update
  walls = newWalls
  revision = revision + 1
  emit DungeonMutated(revision, msg.sender, tile, newWalls has bit tile, newWalls)
```

**Guards wajib:** periksa `moveCount` sebelum shift `2*moveCount`, `tile<49` sebelum mask bitshift, initial/endpoints valid constructor. Jika `revision` overflow (ekstrem), checked math Solidity revert. `completeAndMutate` tidak `payable`.

### C.3 Validator path

```text
pos = 0
for i in [0 .. moveCount-1]:
    dir = (packedDirs >> (2*i)) & 0b11
    x = pos % 7
    y = pos / 7
    if dir == UP:    require(y > 0); next = pos - 7
    if dir == RIGHT: require(x < 6); next = pos + 1
    if dir == DOWN:  require(y < 6); next = pos + 7
    if dir == LEFT:  require(x > 0); next = pos - 1
    require((walls & (1 << next)) == 0)
    if next == 48 and i != moveCount-1: revert ExitReachedEarly(i)
    pos = next
require(pos == 48, PathDoesNotReachExit)
```

Validator langkah input langsung dari calldata; hanya wall dan revisi lama yang menjadi acuan. No state writes until all checks success.

### C.4 BFS bounded di memori

```text
function reachable(uint64 w):
    if w >> 49 != 0 or bit0 != 0 or bit48 != 0: return false
    visited = uint64(1 << 0)
    queue = fixed_array<uint8,49>()
    queue[0] = 0
    head = 0
    tail = 1
    while head < tail:
        p = queue[head++]
        if p == 48: return true
        for each neighbor (UP, RIGHT, DOWN, LEFT):
            if within board and not walled and not visited:
                 visited |= (1 << neighbor)
                 queue[tail++] = neighbor
    return false
```

`tail` hanya bertambah untuk setiap tile yang belum pernah masuk queue, maksimum 49, sehingga array tidak overflow. Gas worst case perlu diukur; jangan mengandalkan klaim target gas tanpa pengukuran. Hindari recursion.

### C.5 Event log dan histori

1. UI request `getDungeon()` dari kontrak.
2. Verifikasi receipt sukses untuk hash commit attempt pada chain tujuan dan event `DungeonMutated` dari **contract address yang ditangkap attempt**. Cocokkan `editor` dengan akun attempt, `tileIndex` dengan tile pilihan, `revision == expectedRevision + 1`, `wallMask == snapshot.walls XOR (1 << tileIndex)`, serta `becameWall` dengan bit hasil tersebut.
3. Refetch live dungeon secara terpisah. Bila revisi live sama dengan event, wall mask harus sama; bila revisi live lebih besar, wall mask boleh berbeda dan kontribusi tetap berhasil. Bila hasil read tertinggal di bawah revisi event atau tidak konsisten pada revisi yang sama, tetap tampilkan syncing dan ulangi pembacaan untuk rekonsiliasi.
4. Beberapa mutation dapat terjadi dalam satu block. Hasil `getDungeon()` pada block receipt merupakan state akhir block, sehingga tidak wajib sama dengan event transaksi yang lebih awal pada block tersebut. Success copy menyebut revisi yang dibuat kontribusi; revisi terbaru ditampilkan terpisah.
5. UI history untuk window baru meminta `getLogs` dari deployed contract; jangan scan block genesis.
6. Saat history log unavailable, UI tidak mengarang editor atau riwayat; tampilkan current state saja. Ini terpisah dari event receipt milik commit attempt yang dibutuhkan untuk mengonfirmasi kontribusi.

### C.6 Reference test vector

Seed `0xd053827900a`, rev 0. Player A submits:

```text
expectedRevision = 0
path              = DRRRRURRDDLDLLDDRDRR
moveCount         = 20
packedDirections  = 0x59afba5156
tileIndex         = 31
expectedAfter     = walls 0xd05b827900a, revision 1
```

Player B solves rev1 and submits:

```text
expectedRevision = 1
path              = DRRRRURRDDLDLLLDDRRDRR
moveCount         = 22
packedDirections  = 0x596bfba5156
tileIndex         = 38
expectedAfter     = walls 0xd45b827900a, revision 2
```

Fixture JSON menyimpan seluruh detail deterministik. Semua angka adalah test vectors untuk implementasi, bukan bukti bahwa kontrak sudah deploy.

### C.7 Pemulihan commit attempt

**Batas status:** `pending` berarti hash diketahui dan hasil belum terkonfirmasi; `unknown` berarti hasil belum dapat dipastikan akibat gangguan observasi; `syncing` berarti receipt sukses tersedia tetapi verifikasi event/state belum lengkap. Ketiganya unresolved, seperti `signing` yang masih menunggu hasil wallet. Timeout, receipt yang belum ditemukan, atau waktu tunggu panjang bukan bukti gagal maupun batal; kontrol edit/run dan commit ulang tetap terkunci, sementara pembacaan history, Retry status, serta link wallet/explorer tetap tersedia. Retry status hanya mengulangi pembacaan, tidak menyiarkan transaksi lagi.

**Reload:** simpan fixed attempt, snapshot/path yang diperlukan untuk memulihkan run dan edit draft, serta hash original/pengganti yang diketahui dalam jurnal lokal. Setelah reload, pulihkan konteks tersebut dalam keadaan terkunci dan baca ulang chain; status sukses dari cache adalah hasil observasi sebelumnya, bukan bukti baru. Jurnal adalah state pemulihan client, bukan sumber otoritas dungeon. Attempt yang muncul kembali akibat reorg tetap dilacak dengan identitasnya sendiri; commit baru diblok selama masih ada attempt terkait yang unresolved.

**Ketersediaan recovery:** penulisan jurnal awal harus berhasil sebelum permintaan signing dikirim. Bila penyimpanan ditolak/gagal, blok pengajuan dan tetap izinkan local play; bila penyimpanan hash gagal setelah pengajuan, pertahankan pelacakan di memori, tampilkan hash yang diketahui untuk disalin, dan pertahankan catatan unresolved yang sudah tersimpan. Menghapus seluruh data situs atau berakhirnya penyimpanan private browsing menghilangkan jurnal; recovery berbasis cache dan pemblokiran setelah reload tidak dapat dijamin ketika bukti lokal itu hilang.

**Perubahan wallet:** sebelum mengirim permintaan signing, cocokkan akun/network aktif dengan konteks attempt; mismatch membatalkan preflight tanpa write. Setelah permintaan wallet terbit, account/network change tidak membuktikan pembatalan: pertahankan konteks dan lock attempt original, proses respons terlambat terhadap attempt itu, dan lakukan pembacaan status pada chain asal. Event wallet tidak boleh mengubah payload atau mengesahkan hasil atas nama akun yang baru dipilih.

**Hash belum diketahui:** jika respons wallet hilang atau halaman dimuat ulang sebelum hash tersimpan, pertahankan attempt sebagai unknown dan sediakan **Recover with transaction hash** beserta panduan wallet/explorer. Baca transaksi pada chain attempt dan periksa sender, target, value, calldata, serta nonce atau bukti pengaitan lain yang sudah diketahui. Hash yang terhubung ke aksi original diikuti melalui receipt/event seperti §C.5; hash dengan target/value/calldata berbeda hanya boleh diperlakukan sebagai cancellation/replacement bila pengaitan sender dan nonce original terverifikasi, lalu ikuti aturan **Replacement** di bawah. Persamaan payload saja tidak menyelesaikan ambiguitas bila ada transaksi duplikat dengan nonce berbeda. Simpan metadata transaksi dan bukti pengaitan yang telah diperoleh agar tersedia setelah reload; jangan menebak nonce original dari hash kandidat yang belum terhubung. Hash yang tidak terkait tidak mengganti identitas attempt atau membuka lock; jika pengaitan belum pasti, tetap unresolved. Wallet history kosong bukan bukti batal, dan cancellation dari akun yang sama tidak membuktikan replacement ketika nonce original atau pengaitannya tidak diketahui. Recovery ini hanya membaca bukti, tanpa mengirim transaksi. Pengecualian berbasis bukti chain untuk attempt tanpa hash ada di [ADR-032](docs/adr/0032-hashless-attempt.md): revision yang sudah lewat, atau nonce yang menunjukkan transaksi tidak pernah masuk, dapat mengakhiri attempt; kegagalan pembacaan tidak membuka kunci.

**Koordinasi tab:** ruang koordinasi adalah `(site origin, browser profile, chainId, contractAddress)`, tidak dipisahkan berdasarkan akun wallet. Sebelum permintaan signing, lakukan pemeriksaan jurnal dan klaim attempt secara atomik lintas tab; dua tab yang menekan Commit bersamaan hanya boleh menghasilkan satu permintaan wallet. Notifikasi storage/tab menyinkronkan tampilan tetapi bukan pengganti klaim atomik. Penutupan tab, pergantian akun, atau habisnya lease koordinasi tidak menghapus unresolved attempt dari jurnal; tab berikutnya melanjutkan recovery sebelum commit baru. Jika koordinasi atomik tidak tersedia, commit diblok dengan penjelasan dan local play tetap tersedia. Profil, origin, atau perangkat lain tetap independen dan dilindungi terhadap stale mutation oleh kontrak, bukan oleh lock browser ini.

**Replacement:** periksa transaksi pengganti pada chain attempt. Jika sender dan nonce sama serta target, value, dan calldata tetap, perlakukan sebagai speed-up dari attempt yang sama, simpan kedua hash, dan verifikasi receipt/event pengganti seperti §C.5. Receipt canonical yang membuktikan nonce dikonsumsi cancellation atau transaksi dengan aksi berbeda mengakhiri attempt original sebagai `cancelled` atau `replaced`; receipt pengganti yang sukses tidak otomatis berarti mutation yang diminta berhasil. Setelah hasil nonmutasi tersebut terverifikasi, refetch dungeon dan buka editor dengan aturan stale/preflight tetap berlaku. Replacement yang belum terkonfirmasi masih unresolved.

**Reorg:** simpan block number dan block hash inclusion untuk receipt yang diperiksa. Jika block canonical pada nomor tersebut berbeda hash, tandai hasil sebelumnya tidak lagi terkonfirmasi, tarik success, hapus log orphaned dari history, dan baca ulang receipt serta live dungeon; bila transaksi masuk kembali, verifikasi ulang hasil inclusion baru. Bandingkan identitas dungeon, revision, walls, dan editable mask saat memvalidasi run: revisi sama dengan layout berbeda tetap stale. Block observasi yang berubah tanpa perubahan isi dungeon tidak dengan sendirinya membatalkan run, tetapi kesamaan isi dungeon tidak membuktikan sebuah transaksi masih canonical. Error RPC saja bukan bukti reorg; tampilkan keterbatasan observasi dan blok commit sampai state dapat diverifikasi kembali.

**Bukti hasil:** wallet rejection yang eksplisit sebelum broadcast mengembalikan editor; receipt revert membuktikan mutation gagal; receipt sukses dengan event dan rekonsiliasi yang sesuai mengonfirmasi mutation; cancellation/replacement memerlukan bukti seperti di atas. Setiap hasil berbasis inclusion dapat perlu diperiksa lagi bila ada reorg. Receipt timeout perlu dikonfigurasi secara eksplisit saat implementasi dan hanya membatasi observasi, bukan umur atau validitas transaksi.

**Rujukan implementasi:** [viem receipt waiting dan replacement](https://viem.sh/docs/actions/public/waitForTransactionReceipt), [wagmi receipt hook](https://wagmi.sh/react/api/hooks/useWaitForTransactionReceipt), [EIP-1193 tentang provider/wallet events](https://eips.ethereum.org/EIPS/eip-1193), [HTML Web Storage](https://html.spec.whatwg.org/multipage/webstorage.html), dan [EIP-1898 tentang block hash/canonicality](https://eips.ethereum.org/EIPS/eip-1898). Verifikasi perilaku terhadap versi dependency yang dipin.

## D. Sequence diagram: player A→player B

```mermaid
sequenceDiagram
    participant A as Player A (Browser)
    participant C as Arbitrum Sepolia: RuinRelay
    participant B as Player B (Browser)
    A->>C: getDungeon()
    C-->>A: walls rev0
    A->>A: move locally, reach EXIT
    A->>A: select tile31, local BFS preview
    A->>C: simulate completeAndMutate(0, pathA, 20, 31)
    C-->>A: valid simulation
    A->>C: wallet sends signed tx
    C->>C: verify old path; mutate; BFS; rev=1
    C-->>A: DungeonMutated(1, A, 31, true, walls1)
    A->>C: getDungeon() receipt reconciliation
    B->>C: getDungeon()
    C-->>B: walls rev1
    B->>B: solve rev1 + select tile38
    B->>C: completeAndMutate(1, pathB, 22, 38)
    C->>C: verify and mutate; rev=2
    C-->>B: DungeonMutated(2, B, 38, true, walls2)
```

## E. Kegagalan & fallback matrix

| Kasus | Risiko | Expected behavior | Test owner |
|---|---|---|---|
| Salah chain | Tx ke jaringan lain | Block commit + switch network | FE |
| Faucet kosong | Tx tidak bisa disiarkan | Insufficient funds guidance, no fake success | FE/Ops |
| User rejects wallet | Tidak jadi commit | Return edit preview state, no write | FE |
| RPC unavailable | Tidak bisa refresh | Local read-only labeled offline; never commit blindly | FE |
| tx simulation revert | Gas terselamatkan | Decode custom error, prompt retry or change tile | FE |
| tx mined stale | Gas hilang | Mark failed, fetch new rev, suggest replay | FE/Contract |
| invalid route | Fraud/path bug | Solidity revert unchanged | Contract |
| invalid edit | Puzzle buntu | Solidity revert unchanged | Contract |
| receipt success but log missing | False positive | Wait/sync, retry chain read; no immediate success claim | FE |
| receipt lookup timeout / RPC error after submission | Duplicate submission | Preserve unresolved attempt; status retry only; keep Commit locked | FE |
| page reload with unfinished attempt | Lost tracking | Restore attempt and known hashes; verify chain before unlocking or showing success | FE |
| wallet speed-up / cancellation / different-action replacement | Wrong attribution | Verify replacement identity and receipt; apply §C.7 rather than treating every successful receipt as mutation success | FE |
| wallet response lost before hash is known | Untracked broadcast | Preserve unknown attempt; offer verified hash recovery and wallet/explorer guidance; ambiguous evidence does not unlock Commit | FE |
| simultaneous commits in same-profile tabs | Duplicate wallet requests | Atomically claim one attempt per origin/profile/deployment, regardless of account; preserve journal through tab closure | FE |
| event history missing | Incomplete past log | Show current board, honest history unavailable | FE |
| previously seen chain reorg | UI state drift | Withdraw orphaned success, remove orphaned logs, recheck attempt and invalidate changed run snapshots per §C.7 | FE |
| deployment seed bad | Contract unusable | Constructor revert; redeploy only with disclosure | Ops |

## F. Testing strategy dan audit notes

### F.1 Test tiers

- **Unit contract:** constructor, bitmasks, path legality, BFS, revert conditions, event payload.
- **Fuzz:** bounded path direction/length, arbitrary mask validity, permutations of allowed tile indexes, no state mutation after revert.
- **Invariant/stateful:** sequence mutasi dari valid seed → selalu solvable, revision monotonic, state bits valid; handler hanya membuat aksi valid untuk memperluas coverage.
- **TS parity:** pack/unpack direction, `walls` bit orientation, local BFS, fixtures rev0..2.
- **Integration:** deploy Anvil, frontend connected wallet, switch to Sepolia, read/share/history, stale race.
- **Demo regression:** replay exact tx scenarios, wallet rejection, RPC unavailable, success path.

`TEST_PLAN.md` menjabarkan identitas dan expected result tiap tes. Test suite tidak menggantikan audit keamanan pihak independen jika nanti memakai dana/token bernilai.

### F.2 Manual gas instrumentation

1. `forge test --gas-report` dan `forge snapshot` pada seeded board serta versi terkini.
2. Ukur biaya `completeAndMutate` untuk jalur pendek, 96 langkah, serta BFS dengan banyak open cells.
3. Jalankan pada Arbitrum Sepolia untuk estimateGas dan receipt gasUsed + effectiveGasPrice.
4. Laporkan gas unit dan fee sesuai network saat testing; jangan membuat klaim murah absolut.

### F.3 Contract freeze checklist

- [ ] ABI dan errors dikunci.
- [ ] Tidak ada storage upgrade, payable, ownership override, atau arbitrary external call.
- [ ] Constructor seed/bit validations lengkap.
- [ ] BFS gas tested worst case.
- [ ] Reference paths diuji Solidity & TypeScript.
- [ ] Source verified on explorer.
- [ ] Metadata versi/tag, chainId/address, deploy tx tercatat di README.

## G. Security decision record — klaim yang tidak boleh dibuat

| Jangan klaim | Pernyataan yang benar |
|---|---|
| "Prevents all cheating" | "The contract verifies submitted paths and map solvability; scripts can still produce valid paths." |
| "Every editor is a unique person" | "Each edit is attributed to an onchain address, not a verified human." |
| "Completely decentralized" | "Canonical game state is onchain; website, RPC, wallets and hosting still have dependencies." |
| "Live multiplayer" | "Asynchronous collaboration through a shared evolving dungeon." |
| "Onchain game with zero fees" | "Playing locally is free, writing a mutation requires Arbitrum network gas unless subsidized later." |
| "Immutable forever playable app" | "Contract history is public; availability of site and RPC is a separate operational concern." |
| "Block confirmation means Ethereum L1 finality" | "We treat the successful Sepolia receipt as UI confirmation, subject to chain reorg/finality nuances." |

## H. Pilihan pascahackathon (tidak diimplementasikan sekarang)

| Evolusi | Pemicu yang memvalidasi | ADR baru yang diperlukan |
|---|---|---|
| Season dengan peta baru | Pemain menyelesaikan puzzle terlalu cepat / butuh variety | Factory, deploy, per-season state |
| Beberapa editor per epoch | Contention tinggi, kontribusi hilang | Arbitration, queues, merge mechanism |
| Procedural obstacles/traps | Completion rate terlalu tinggi | New path verification semantics |
| Account abstraction / sponsored gas | Wallet conversion rendah | Abuse budget, throttling, paymaster |
| Builder monetization | Creator supply/retention terbukti | Pricing, platform fees, consumer permissions |
| Verified human tournaments | Ada kebutuhan kompetisi berhadiah | Threat model anti-bot/attestation |
| Mobile game native | Distribusi mobile menjadi channel utama | Input, engine, signing integration |

## I. Sources dan design provenance

- [Official Colosseum Hackathon Rules PDF](https://colosseum.com/legal/Crypto%20World%27s%20Fair%20Hackathon%20Rules.pdf), §5, §8, §12, §14.
- [Colosseum Hackathon FAQ](https://colosseum.com/hackathon?year=fall2026), requirements & venture-style evaluation.
- [Arbitrum official chain info](https://developer.arbitrum.io/chain-info), testnet RPC and chain ID.
- [Arbitrum Solidity quickstart](https://docs.arbitrum.io/build-decentralized-apps/quickstart-solidity-remix), EVM deployment.
- [Foundry book](https://book.getfoundry.sh/), Solidity testing and fuzz/invariants.
- [Meet Your Maker](https://meetyourmakergame.com/game/), comparable build-and-raid category.

**Status reminder:** File ini adalah rancangan keputusan siap dikerjakan. Belum ada test report onchain atau assurance audit sampai code dan deployment sungguhan dibuat.
