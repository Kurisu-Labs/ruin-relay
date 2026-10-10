# Ruin Relay

Ruin Relay adalah dungeon bersama yang berubah satu tile setiap kali seorang pemain mengajukan solusi dan perubahan yang sah. Istilah berikut membedakan dunia bersama dari percobaan bermain seseorang.

## Language

**Dungeon revision**:
Versi dungeon bersama pada satu titik dalam urutan perubahan yang diterima; seed adalah revisi awal.
_Avoid_: Level, season

**Live dungeon**:
Keadaan dungeon bersama yang sedang berlaku bagi pemain yang memulai run baru.
_Avoid_: Run snapshot, current board tanpa konteks

**Run**:
Satu percobaan pemain untuk mencapai EXIT dari START pada satu run snapshot.
_Avoid_: Transaction, mutation

**Run snapshot**:
Keadaan dungeon yang menjadi dasar sebuah run dan tetap sama selama percobaan tersebut.
_Avoid_: Live dungeon, live board

**Stale run**:
Run yang snapshot-nya sudah tidak sesuai dengan live dungeon; penyelesaiannya masih bermakna sebagai latihan, tetapi tidak memberi kesempatan melakukan edit pada dungeon aktif.
_Avoid_: Failed run, invalid escape

**Local escape**:
Keberhasilan mencapai EXIT pada run snapshot, yang membuka pilihan edit dalam sesi bermain tersebut.
_Avoid_: Confirmed mutation, onchain success

**Edit draft**:
Usulan pemain untuk membalik keadaan tepat satu tile yang dapat diedit setelah local escape.
_Avoid_: Mutation, committed edit

**Commit attempt**:
Satu pengajuan edit dengan run, pilihan tile, identitas kontributor, dan dungeon tujuan yang tetap selama pengajuan tersebut.
_Avoid_: Edit draft, confirmed mutation

**Unresolved commit attempt**:
Commit attempt yang hasil pengajuannya belum dapat dipastikan; pengajuan tersebut belum dapat dianggap berhasil, gagal, atau dibatalkan.
_Avoid_: Failed edit, cancelled edit

**Mutation**:
Perubahan satu tile yang diterima untuk dungeon bersama dan menghasilkan satu revisi berikutnya.
_Avoid_: Edit draft, local escape

**Confirmed mutation**:
Mutation yang penerimaannya telah dikonfirmasi dalam riwayat dungeon yang sedang berlaku; revisi hasil kontribusi tersebut dapat sudah diikuti oleh mutation lain.
_Avoid_: Live dungeon, pending edit

**Restart**:
Pengulangan run dari START pada snapshot yang sama.
_Avoid_: Play latest, reload dungeon

**Play latest**:
Permulaan run baru dari START pada live dungeon.
_Avoid_: Restart, resume run
