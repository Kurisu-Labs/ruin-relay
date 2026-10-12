---
status: accepted
---

# ADR-037 — Satu Bridge antara Relay dan Scene

Host React memasok frame ke satu GameBridge dan DungeonScene, dengan callback intent yang spesifik. Scene tidak mengakses singleton Relay, RPC, wallet atau journal. Boundary kecil ini menggantikan inline scene pada Board dengan menerima ekstraksi terbatas agar callback, loading, resize dan cleanup dapat dikendalikan tanpa dua pemilik run.

Board memiliki focused keyboard listener dan preferensi; bridge memiliki engine/canvas/ResizeObserver; scene memiliki sprite, camera, pointer picking dan tween transient. Frame terbaru disimpan saat import/atlas belum selesai. Ready berarti atlas kritis dan scene siap. Unmount membatalkan import lanjutan, listeners, timeout, observer, audio dan game instance. Retry hanya membangun ulang view dari frame terkini. Kegagalan renderer tidak mereset attempt. Keputusan memperinci adapter ADR-014 dan tidak mengganti domain ownership.
