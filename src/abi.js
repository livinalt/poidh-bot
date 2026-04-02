export const POIDH_ABI = [
  // Write
  {
    name: "createSoloBounty",
    type: "function",
    stateMutability: "payable",
    inputs: [
      { name: "name", type: "string" },
      { name: "description", type: "string" },
    ],
    outputs: [],
  },
  {
    name: "acceptClaim",
    type: "function",
    stateMutability: "nonpayable",
    inputs: [
      { name: "bountyId", type: "uint256" },
      { name: "claimId", type: "uint256" },
    ],
    outputs: [],
  },

  // Read - FIXED to match live contract
  {
    name: "getBountiesLength",
    type: "function",
    stateMutability: "view",
    inputs: [],
    outputs: [{ type: "uint256" }],
  },
  {
    name: "bounties",
    type: "function",
    stateMutability: "view",
    inputs: [{ name: "id", type: "uint256" }],
    outputs: [{ 
      type: "tuple", 
      components: [
        { name: "id", type: "uint256" },
        { name: "issuer", type: "address" },
        { name: "name", type: "string" },
        { name: "description", type: "string" },
        { name: "amount", type: "uint256" },
        { name: "claimer", type: "address" },
        { name: "createdAt", type: "uint256" },
        { name: "claimId", type: "uint256" },
      ]
    }],
  },
  {
    name: "getClaimsByBountyId",
    type: "function",
    stateMutability: "view",
    inputs: [
      { name: "bountyId", type: "uint256" },
      { name: "offset", type: "uint256" }
    ],
    outputs: [{ 
      type: "tuple[]", 
      components: [
        { name: "id", type: "uint256" },
        { name: "issuer", type: "address" },
        { name: "bountyId", type: "uint256" },
        { name: "bountyIssuer", type: "address" },
        { name: "name", type: "string" },
        { name: "description", type: "string" },
        { name: "createdAt", type: "uint256" },
        { name: "accepted", type: "bool" },
      ]
    }],
  },

  // Events
  {
    name: "BountyCreated",
    type: "event",
    inputs: [
      { name: "bountyId", type: "uint256", indexed: true },
      { name: "issuer", type: "address", indexed: true },
      { name: "name", type: "string", indexed: false },
      { name: "description", type: "string", indexed: false },
      { name: "amount", type: "uint256", indexed: false },
    ],
  },
  {
    name: "ClaimCreated",
    type: "event",
    inputs: [
      { name: "claimId", type: "uint256", indexed: true },
      { name: "claimant", type: "address", indexed: true },
      { name: "bountyId", type: "uint256", indexed: true },
      { name: "name", type: "string", indexed: false },
      { name: "description", type: "string", indexed: false },
      { name: "uri", type: "string", indexed: false },
    ],
  },
  {
    name: "ClaimAccepted",
    type: "event",
    inputs: [
      { name: "bountyId", type: "uint256", indexed: true },
      { name: "claimId", type: "uint256", indexed: true },
      { name: "claimIssuer", type: "address", indexed: true },
    ],
  },
];