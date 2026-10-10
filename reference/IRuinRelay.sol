// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/// @notice Ruin Relay hackathon MVP interface specification ONLY.
/// @dev This file is an ABI contract; not an implementation or audited deployment.
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

    /// @return walls 49-bit wall mask, where set bit represents an impassable tile
    /// @return revision monotonically increasing board revision
    /// @return editableMask allowed tile indexes for a single toggle
    function getDungeon()
        external view
        returns (uint64 walls, uint64 revision, uint64 editableMask);

    /// @notice Validate a solution against the current dungeon revision,
    /// then toggle exactly one editable tile if the resulting dungeon remains solvable.
    /// @param expectedRevision snapshot revision solved by the player
    /// @param packedDirections 2-bit directions per step (0=U,1=R,2=D,3=L)
    /// @param moveCount number of valid steps; must be within 1..96
    /// @param tileIndex 0..48 editable tile to toggle after the solved run
    function completeAndMutate(
        uint64 expectedRevision,
        uint256 packedDirections,
        uint8 moveCount,
        uint8 tileIndex
    ) external;

    /// @notice Evaluate reachability on a candidate 49-bit wall mask.
    /// @return False if any bit above 48 is set, START/EXIT is a wall,
    /// or no route exists; true otherwise. Malformed candidate masks do not revert.
    function isSolvable(uint64 candidateWalls) external pure returns (bool);
}
