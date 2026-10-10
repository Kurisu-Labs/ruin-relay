# Ruin Relay — Individual ADRs

These are extracts from `../ADR.md`; the master governs if an extract and later amendment differ.

- [ADR-001 — Satu dungeon persisten bersama](ADR-001.md)
- [ADR-002 — Arbitrum Sepolia sebagai target deploy](ADR-002.md)
- [ADR-003 — Solidity + Foundry, tanpa Stylus atau proxy upgrade](ADR-003.md)
- [ADR-004 — Representasi board `uint64` untuk 49 tile](ADR-004.md)
- [ADR-005 — Seed dan playable editable mask adalah konfigurasi immutable](ADR-005.md)
- [ADR-006 — Aktivitas gameplay lokal; chain tidak digunakan per langkah](ADR-006.md)
- [ADR-007 — Encoding path 2 bit little-endian dalam `uint256`](ADR-007.md)
- [ADR-008 — Definisi valid escape path](ADR-008.md)
- [ADR-009 — Solusi dan edit digabung dalam satu transaksi atomik](ADR-009.md)
- [ADR-010 — Verifikasi solvability dengan BFS bounded onchain](ADR-010.md)
- [ADR-011 — Optimistic concurrency melalui `expectedRevision`](ADR-011.md)
- [ADR-012 — Event log adalah history; storage hanya current state](ADR-012.md)
- [ADR-013 — UI tidak mempunyai backend game authoritative](ADR-013.md)
- [ADR-014 — Phaser untuk render 2D, React untuk shell UI](ADR-014.md)
- [ADR-015 — viem/wagmi untuk EVM RPC & wallet](ADR-015.md)
- [ADR-016 — Wallet opsional sampai edit permanen](ADR-016.md)
- [ADR-017 — TX lifecycle: simulate, sign, wait, reconcile](ADR-017.md)
- [ADR-018 — Tidak ada tokenomics atau NFT pada MVP](ADR-018.md)
- [ADR-019 — Anti-cheat dimaknai sebagai validity, bukan human authenticity](ADR-019.md)
- [ADR-020 — Anti-grief minimal berupa edit mask + solvability](ADR-020.md)
- [ADR-021 — Source of truth dan parity lintas bahasa](ADR-021.md)
- [ADR-022 — No privileged owner, no backend editorial override](ADR-022.md)
- [ADR-023 — History via bounded event queries dengan reorg resilience](ADR-023.md)
- [ADR-024 — Game UI sebagai visualisasi state, bukan trusted verifier](ADR-024.md)
- [ADR-025 — Security posture: minimal external attack surface](ADR-025.md)
- [ADR-026 — Pengukuran dan data minimal](ADR-026.md)
- [ADR-027 — Mobile friendly read-only, desktop-first controls](ADR-027.md)
- [ADR-028 — Perubahan aturan gameplay harus versioned](ADR-028.md)

## Amendment presentasi game

ADR-014 kini diamendemen oleh [ADR-033](../docs/adr/0033-phaser4-renderer.md), [ADR-034](../docs/adr/0034-isometric-presentation.md), [ADR-035](../docs/adr/0035-authoritative-run-and-animation.md), [ADR-036](../docs/adr/0036-modular-asset-pipeline.md), dan [ADR-037](../docs/adr/0037-scene-bridge-and-lifecycle.md).

[ADR-038](../docs/adr/0038-close-top-down-camera.md) mengganti ADR-034 dengan kamera dekat lurus berdasarkan feedback pengguna, serta memperbarui aset aktif menjadi v2.

[ADR-039](../docs/adr/0039-escape-only-overview.md) menggantikan overview manual dan ukuran view ADR-038: overview hanya untuk editor setelah local escape, kamera bermain lebih dekat, dan panel edit menjelaskan syarat Commit.
