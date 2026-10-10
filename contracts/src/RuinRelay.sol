// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import {IRuinRelay} from "reference/IRuinRelay.sol";

/// @notice One shared dungeon; every accepted path permits one solvable edit.
contract RuinRelay is IRuinRelay {
    uint8 public constant START = 0;
    uint8 public constant EXIT = 48;
    uint8 public constant BOARD_SIZE = 7;
    uint8 public constant MAX_MOVES = 96;
    uint64 private walls;
    uint64 private revision;
    uint64 private immutable editMask;
    error InvalidConfiguration();

    constructor(uint64 initialWalls, uint64 editableMask) {
        uint64 endpoints = (uint64(1) << EXIT) | 1;
        if (editableMask == 0 || editableMask >> 49 != 0 || editableMask & endpoints != 0 || !isSolvable(initialWalls)) revert InvalidConfiguration();
        walls = initialWalls;
        editMask = editableMask;
    }

    function getDungeon() external view returns (uint64, uint64, uint64) {
        return (walls, revision, editMask);
    }

    function completeAndMutate(uint64 expectedRevision, uint256 packedDirections, uint8 moveCount, uint8 tileIndex)
        external
    {
        if (expectedRevision != revision) revert StaleRevision(expectedRevision, revision);
        if (moveCount == 0 || moveCount > MAX_MOVES) revert InvalidMoveCount(moveCount);
        if (packedDirections >> (2 * uint256(moveCount)) != 0) revert NonCanonicalDirections();
        uint8 pos;
        for (uint8 i = 0; i < moveCount; i++) {
            (bool valid, uint8 next) = neighbor(pos, uint8((packedDirections >> (2 * uint256(i))) & 3));
            if (!valid || walls & (uint64(1) << next) != 0) revert InvalidStep(i);
            if (next == EXIT && i != moveCount - 1) revert ExitReachedEarly(i);
            pos = next;
        }
        if (pos != EXIT) revert PathDoesNotReachExit();
        if (tileIndex >= 49 || editMask & (uint64(1) << tileIndex) == 0) revert TileNotEditable(tileIndex);
        uint64 nextWalls = walls ^ (uint64(1) << tileIndex);
        if (!isSolvable(nextWalls)) revert UnsolvableMutation();
        walls = nextWalls;
        revision += 1;
        emit DungeonMutated(revision, msg.sender, tileIndex, nextWalls & (uint64(1) << tileIndex) != 0, nextWalls);
    }

    function isSolvable(uint64 candidateWalls) public pure returns (bool) {
        if (candidateWalls >> 49 != 0 || candidateWalls & ((uint64(1) << EXIT) | 1) != 0) return false;
        uint8[49] memory queue;
        uint8 head;
        uint8 tail = 1;
        uint64 visited = 1;
        while (head < tail) {
            uint8 pos = queue[head++];
            if (pos == EXIT) return true;
            for (uint8 dir = 0; dir < 4; dir++) {
                (bool valid, uint8 next) = neighbor(pos, dir);
                if (!valid) continue;
                uint64 bit = uint64(1) << next;
                if ((candidateWalls | visited) & bit != 0) continue;
                visited |= bit;
                queue[tail++] = next;
            }
        }
        return false;
    }

    function neighbor(uint8 pos, uint8 dir) private pure returns (bool, uint8) {
        if (dir == 0) return pos >= 7 ? (true, pos - 7) : (false, 0);
        if (dir == 1) return pos % 7 < 6 ? (true, pos + 1) : (false, 0);
        if (dir == 2) return pos < 42 ? (true, pos + 7) : (false, 0);
        return pos % 7 > 0 ? (true, pos - 1) : (false, 0);
    }
}
