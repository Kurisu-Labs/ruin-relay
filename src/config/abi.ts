// Generated from Solidity 0.8.24 by npm run abi.
export const abi = [
  {
    type: 'constructor',
    inputs: [
      {
        name: 'initialWalls',
        type: 'uint64',
        internalType: 'uint64',
      },
      {
        name: 'editableMask',
        type: 'uint64',
        internalType: 'uint64',
      },
    ],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    name: 'BOARD_SIZE',
    inputs: [],
    outputs: [
      {
        name: '',
        type: 'uint8',
        internalType: 'uint8',
      },
    ],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'EXIT',
    inputs: [],
    outputs: [
      {
        name: '',
        type: 'uint8',
        internalType: 'uint8',
      },
    ],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'MAX_MOVES',
    inputs: [],
    outputs: [
      {
        name: '',
        type: 'uint8',
        internalType: 'uint8',
      },
    ],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'START',
    inputs: [],
    outputs: [
      {
        name: '',
        type: 'uint8',
        internalType: 'uint8',
      },
    ],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'completeAndMutate',
    inputs: [
      {
        name: 'expectedRevision',
        type: 'uint64',
        internalType: 'uint64',
      },
      {
        name: 'packedDirections',
        type: 'uint256',
        internalType: 'uint256',
      },
      {
        name: 'moveCount',
        type: 'uint8',
        internalType: 'uint8',
      },
      {
        name: 'tileIndex',
        type: 'uint8',
        internalType: 'uint8',
      },
    ],
    outputs: [],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    name: 'getDungeon',
    inputs: [],
    outputs: [
      {
        name: '',
        type: 'uint64',
        internalType: 'uint64',
      },
      {
        name: '',
        type: 'uint64',
        internalType: 'uint64',
      },
      {
        name: '',
        type: 'uint64',
        internalType: 'uint64',
      },
    ],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'isSolvable',
    inputs: [
      {
        name: 'candidateWalls',
        type: 'uint64',
        internalType: 'uint64',
      },
    ],
    outputs: [
      {
        name: '',
        type: 'bool',
        internalType: 'bool',
      },
    ],
    stateMutability: 'pure',
  },
  {
    type: 'event',
    name: 'DungeonMutated',
    inputs: [
      {
        name: 'revision',
        type: 'uint64',
        indexed: true,
        internalType: 'uint64',
      },
      {
        name: 'editor',
        type: 'address',
        indexed: true,
        internalType: 'address',
      },
      {
        name: 'tileIndex',
        type: 'uint8',
        indexed: true,
        internalType: 'uint8',
      },
      {
        name: 'becameWall',
        type: 'bool',
        indexed: false,
        internalType: 'bool',
      },
      {
        name: 'wallMask',
        type: 'uint64',
        indexed: false,
        internalType: 'uint64',
      },
    ],
    anonymous: false,
  },
  {
    type: 'error',
    name: 'ExitReachedEarly',
    inputs: [
      {
        name: 'stepIndex',
        type: 'uint8',
        internalType: 'uint8',
      },
    ],
  },
  {
    type: 'error',
    name: 'InvalidConfiguration',
    inputs: [],
  },
  {
    type: 'error',
    name: 'InvalidMoveCount',
    inputs: [
      {
        name: 'count',
        type: 'uint8',
        internalType: 'uint8',
      },
    ],
  },
  {
    type: 'error',
    name: 'InvalidStep',
    inputs: [
      {
        name: 'stepIndex',
        type: 'uint8',
        internalType: 'uint8',
      },
    ],
  },
  {
    type: 'error',
    name: 'NonCanonicalDirections',
    inputs: [],
  },
  {
    type: 'error',
    name: 'PathDoesNotReachExit',
    inputs: [],
  },
  {
    type: 'error',
    name: 'StaleRevision',
    inputs: [
      {
        name: 'expected',
        type: 'uint64',
        internalType: 'uint64',
      },
      {
        name: 'actual',
        type: 'uint64',
        internalType: 'uint64',
      },
    ],
  },
  {
    type: 'error',
    name: 'TileNotEditable',
    inputs: [
      {
        name: 'tileIndex',
        type: 'uint8',
        internalType: 'uint8',
      },
    ],
  },
  {
    type: 'error',
    name: 'UnsolvableMutation',
    inputs: [],
  },
] as const;
