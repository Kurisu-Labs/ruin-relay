// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import {RuinRelay} from "../src/RuinRelay.sol";
import {IRuinRelay} from "reference/IRuinRelay.sol";

interface Vm {
    function readFile(string calldata) external view returns (string memory);
    function parseJsonUint(string calldata, string calldata) external pure returns (uint256);
    function prank(address) external;
    function expectRevert(bytes calldata) external;
    function expectRevert() external;
    function expectEmit(bool, bool, bool, bool, address) external;
    function deal(address, uint256) external;
}

contract RuinRelayTest {
    Vm constant vm = Vm(address(uint160(uint256(keccak256("hevm cheat code")))));
    RuinRelay dungeon;
    uint64 seed;
    uint64 edits;
    uint256 pathA;
    uint256 pathB;
    uint64 wallsA;
    uint64 wallsB;
    event DungeonMutated(
        uint64 indexed revision, address indexed editor, uint8 indexed tileIndex, bool becameWall, uint64 wallMask
    );
    event log_named_uint(string key, uint256 val);

    function setUp() public {
        string memory fixture = vm.readFile("../reference/fixtures.json");
        seed = uint64(vm.parseJsonUint(fixture, ".initialWallsHex"));
        edits = uint64(vm.parseJsonUint(fixture, ".editableMaskHex"));
        pathA = vm.parseJsonUint(fixture, ".revisions[0].packedDirectionsHex");
        pathB = vm.parseJsonUint(fixture, ".revisions[1].packedDirectionsHex");
        wallsA = uint64(vm.parseJsonUint(fixture, ".revisions[0].afterWallsHex"));
        wallsB = uint64(vm.parseJsonUint(fixture, ".finalWallsHex"));
        dungeon = new RuinRelay(seed, edits);
    }

    function testCanonicalSeed() public view {
        (uint64 walls, uint64 revision, uint64 mask) = dungeon.getDungeon();
        require(walls == seed && revision == 0 && mask == edits, "seed");
        require(dungeon.isSolvable(walls), "reachable");
    }

    function testTwoContributorsMatchFixturesAndEvents() public {
        address alice = address(0xA11CE);
        address bob = address(0xB0B);
        vm.expectEmit(true, true, true, true, address(dungeon));
        emit DungeonMutated(1, alice, 31, true, wallsA);
        vm.prank(alice);
        dungeon.completeAndMutate(0, pathA, 20, 31);
        (uint64 walls, uint64 rev,) = dungeon.getDungeon();
        require(walls == wallsA && rev == 1, "A fixture");
        vm.expectEmit(true, true, true, true, address(dungeon));
        emit DungeonMutated(2, bob, 38, true, wallsB);
        vm.prank(bob);
        dungeon.completeAndMutate(1, pathB, 22, 38);
        (walls, rev,) = dungeon.getDungeon();
        require(walls == wallsB && rev == 2, "B fixture");
    }

    function testRejectInvalidConfigurations() public {
        uint64[5] memory badWalls = [uint64(1) << 49, uint64(1), uint64(1) << 48, uint64(0x7f) << 7, type(uint64).max];
        for (uint256 i; i < badWalls.length; i++) {
            vm.expectRevert();
            new RuinRelay(badWalls[i], edits);
        }
        uint64[4] memory badEdits = [uint64(0), uint64(1), uint64(1) << 48, uint64(1) << 49];
        for (uint256 i; i < badEdits.length; i++) {
            vm.expectRevert();
            new RuinRelay(seed, badEdits[i]);
        }
    }

    function testErrorsAndRevertPreserveState() public {
        reject(99, pathA, 20, 31, abi.encodeWithSelector(IRuinRelay.StaleRevision.selector, uint64(99), uint64(0)));
        reject(0, 0, 0, 31, abi.encodeWithSelector(IRuinRelay.InvalidMoveCount.selector, uint8(0)));
        reject(0, 0, 97, 31, abi.encodeWithSelector(IRuinRelay.InvalidMoveCount.selector, uint8(97)));
        reject(
            0, pathA | (uint256(1) << 40), 20, 31, abi.encodeWithSelector(IRuinRelay.NonCanonicalDirections.selector)
        );
        for (uint8 dir; dir < 4; dir++) {
            if (dir == 2) continue;
            reject(0, dir, 1, 31, abi.encodeWithSelector(IRuinRelay.InvalidStep.selector, uint8(0)));
        }
        reject(0, 2, 1, 31, abi.encodeWithSelector(IRuinRelay.PathDoesNotReachExit.selector));
        reject(
            0,
            pathA | (uint256(3) << 40) | (uint256(1) << 42),
            22,
            31,
            abi.encodeWithSelector(IRuinRelay.ExitReachedEarly.selector, uint8(19))
        );
        reject(0, pathA, 20, 8, abi.encodeWithSelector(IRuinRelay.UnsolvableMutation.selector));
        uint8[5] memory badTiles = [uint8(0), 48, 7, 49, 255];
        for (uint256 i; i < badTiles.length; i++) {
            reject(0, pathA, 20, badTiles[i], abi.encodeWithSelector(IRuinRelay.TileNotEditable.selector, badTiles[i]));
        }
    }

    function reject(uint64 rev, uint256 path, uint8 count, uint8 tile, bytes memory err) private {
        vm.expectRevert(err);
        dungeon.completeAndMutate(rev, path, count, tile);
        (uint64 walls, uint64 revision,) = dungeon.getDungeon();
        require(walls == seed && revision == 0, "revert state");
    }

    function testRevisitsAnd96MoveBoundary() public {
        // D,U loops at the entrance followed by the canonical escape.
        uint256 path;
        for (uint256 i; i < 38; i++) {
            path |= uint256(2) << (4 * i);
        }
        path |= pathA << 152;
        dungeon.completeAndMutate(0, path, 96, 15);
        (uint64 walls, uint64 rev,) = dungeon.getDungeon();
        require(walls == (seed ^ (uint64(1) << 15)) && rev == 1, "96 steps");
    }

    function testStaleRaceAndNonpayability() public {
        dungeon.completeAndMutate(0, pathA, 20, 31);
        vm.expectRevert(abi.encodeWithSelector(IRuinRelay.StaleRevision.selector, uint64(0), uint64(1)));
        vm.prank(address(0xB0B));
        dungeon.completeAndMutate(0, pathA, 20, 31);
        vm.deal(address(this), 1 ether);
        (bool ok,) = address(dungeon).call{value: 1}(abi.encodeCall(dungeon.completeAndMutate, (1, pathB, 22, 38)));
        require(!ok && address(dungeon).balance == 0, "nonpayable");
        (uint64 walls, uint64 rev,) = dungeon.getDungeon();
        require(walls == wallsA && rev == 1, "race");
    }

    function testSolvabilityQueryMalformedMasks() public view {
        require(dungeon.isSolvable(0), "all floor");
        require(!dungeon.isSolvable(1) && !dungeon.isSolvable(uint64(1) << 48), "endpoints");
        require(!dungeon.isSolvable(uint64(0x7f) << 7), "disconnected");
        for (uint8 i = 49; i < 64; i++) {
            require(!dungeon.isSolvable(uint64(1) << i), "high bits");
        }
    }

    function testGasOpenBoard96Steps() public {
        RuinRelay openDungeon = new RuinRelay(0, edits);
        uint256 path;
        for (uint256 i; i < 42; i++) {
            path |= uint256(2) << (4 * i);
        }
        for (uint256 i = 84; i < 90; i++) {
            path |= uint256(2) << (2 * i);
        }
        for (uint256 i = 90; i < 96; i++) {
            path |= uint256(1) << (2 * i);
        }
        uint256 beforeGas = gasleft();
        openDungeon.completeAndMutate(0, path, 96, 15);
        uint256 used = beforeGas - gasleft();
        emit log_named_uint("open-board 96-step mutation gas (local EVM)", used);
        require(used < 1_500_000, "gas budget");
    }

    function testFuzzSolvabilityAgainstIndependentOracle(uint64 walls) public view {
        (bool found,,) = oracle(walls);
        require(dungeon.isSolvable(walls) == found, "oracle parity");
    }

    function testFuzzInvalidCallsPreserveOrAdvanceExactlyOnce(uint64 rev, uint256 path, uint8 count, uint8 tile)
        public
    {
        (bool ok,) = address(dungeon).call(abi.encodeCall(dungeon.completeAndMutate, (rev, path, count, tile)));
        (uint64 walls, uint64 actualRev,) = dungeon.getDungeon();
        if (!ok) {
            require(walls == seed && actualRev == 0, "reverted write");
        } else {
            require(actualRev == 1 && tile < 49 && walls == (seed ^ (uint64(1) << tile)), "one mutation");
            (bool found,,) = oracle(walls);
            require(found, "solvable accepted state");
        }
    }

    function testFuzzMutationSequences(uint256 choices) public {
        for (uint8 i; i < 12; i++) {
            (uint64 oldWalls, uint64 rev, uint64 mask) = dungeon.getDungeon();
            (bool found, uint256 path, uint8 count) = oracle(oldWalls);
            require(found, "reachable before");
            uint8 tile = uint8((choices >> (i * 5)) % 49);
            (bool ok,) = address(dungeon).call(abi.encodeCall(dungeon.completeAndMutate, (rev, path, count, tile)));
            (uint64 walls, uint64 newRev,) = dungeon.getDungeon();
            if (ok) {
                require(newRev == rev + 1 && walls == (oldWalls ^ (uint64(1) << tile)), "atomic toggle");
                require(mask & (uint64(1) << tile) != 0, "allowed");
                (found,,) = oracle(walls);
                require(found && walls >> 49 == 0 && walls & ((uint64(1) << 48) | 1) == 0, "invariants");
            } else {
                require(walls == oldWalls && newRev == rev, "unchanged");
            }
        }
    }

    // Independent grid relaxation oracle, not the production bitmask/queue BFS.
    function oracle(uint64 walls) private pure returns (bool, uint256, uint8) {
        if (walls >> 49 != 0 || walls & ((uint64(1) << 48) | 1) != 0) return (false, 0, 0);
        bool[49] memory seen;
        uint8[49] memory parent;
        seen[0] = true;
        for (uint8 pass; pass < 49; pass++) {
            for (uint8 p; p < 49; p++) {
                if (!seen[p]) continue;
                for (uint8 q; q < 49; q++) {
                    bool adjacent = (p / 7 == q / 7 && (uint256(p) + 1 == q || uint256(q) + 1 == p))
                        || uint256(p) + 7 == q || uint256(q) + 7 == p;
                    if (!seen[q] && adjacent && walls & (uint64(1) << q) == 0) {
                        seen[q] = true;
                        parent[q] = p;
                    }
                }
            }
            if (seen[48]) break;
        }
        if (!seen[48]) return (false, 0, 0);
        uint8[49] memory reversed;
        uint8 count;
        uint8 pos = 48;
        while (pos != 0) {
            uint8 from = parent[pos];
            reversed[count++] = pos == from + 7 ? 2 : from == pos + 7 ? 0 : pos > from ? 1 : 3;
            pos = from;
        }
        uint256 packed;
        for (uint8 i; i < count; i++) {
            packed |= uint256(reversed[count - i - 1]) << (2 * uint256(i));
        }
        return (true, packed, count);
    }
}
