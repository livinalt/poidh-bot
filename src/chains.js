import { base, arbitrum } from "viem/chains";

export const CHAINS = {
  base: {
    chain: base,
    contract: "0x5555Fa783936C260f77385b4E153B9725feF1719",  // contract: "0xb502c5856f7244dccdd0264a541cc25675353d39",
    currency: "ETH",
    explorer: "https://basescan.org",
    bountyUrl: (id) => `https://poidh.xyz/base/bounty/${id}`,
    defaultRpc: "https://mainnet.base.org",
  },
  arbitrum: {
    chain: arbitrum,
    contract: "0x0aa50ce0d724cc28f8f7af4630c32377b4d5c27d",
    currency: "ETH",
    explorer: "https://arbiscan.io",
    bountyUrl: (id) => `https://poidh.xyz/arbitrum/bounty/${id}`,
    defaultRpc: "https://arb1.arbitrum.io/rpc",
  },
};

export function getChainConfig(network) {
  const cfg = CHAINS[network];
  if (!cfg) throw new Error(`Unknown network "${network}". Use: base or arbitrum`);
  return cfg;
}
