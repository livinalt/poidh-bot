import {
  createWalletClient,
  createPublicClient,
  http,
  parseEther,
  parseAbiItem,
  decodeEventLog,
} from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { POIDH_ABI } from "./abi.js";
import { getChainConfig } from "./chains.js";

let _wallet = null;
let _public = null;
let _account = null;
let _cfg = null;

export function initClients(privateKey, network, rpcUrl) {
  _cfg = getChainConfig(network);
  const rpc = rpcUrl || _cfg.defaultRpc;
  const key = privateKey.startsWith("0x") ? privateKey : `0x${privateKey}`;

  _account = privateKeyToAccount(key);
  _wallet = createWalletClient({ account: _account, chain: _cfg.chain, transport: http(rpc) });
  _public = createPublicClient({ chain: _cfg.chain, transport: http(rpc) });

  return { address: _account.address, cfg: _cfg };
}

export function getAddress() {
  return _account?.address;
}

export async function getBalance(address) {
  const bal = await _public.getBalance({ address });
  return (Number(bal) / 1e18).toFixed(6);
}

const BOUNTY_CREATED_ABI = parseAbiItem(
  "event BountyCreated(uint256 id, address indexed issuer, string name, string description, uint256 amount, uint256 createdAt)"
);

/** Create a solo bounty. Returns { bountyId, hash }. */
export async function createBounty(name, description, amountEth) {
  console.log(`[createBounty] Sending createSoloBounty tx with ${amountEth} ETH...`);

  const hash = await _wallet.writeContract({
    address: _cfg.contract,
    abi: POIDH_ABI,
    functionName: "createSoloBounty",
    args: [name, description],
    value: parseEther(amountEth),
  });

  console.log(`[createBounty] Tx sent: ${hash}. Waiting for receipt...`);
  const receipt = await _public.waitForTransactionReceipt({ hash });
  console.log(`[createBounty] Tx confirmed. Block: ${receipt.blockNumber}`);

  // 1. Try parsing BountyCreated event
  for (const log of receipt.logs) {
    if (log.address.toLowerCase() !== _cfg.contract.toLowerCase()) continue;

    try {
      const decoded = decodeEventLog({
        abi: POIDH_ABI,
        data: log.data,
        topics: log.topics,
      });

      if (decoded.eventName === "BountyCreated" && decoded.args?.bountyId) {
        const bountyId = decoded.args.bountyId;
        console.log(`[createBounty] Found bountyId from event: ${bountyId}`);
        return { bountyId, hash };
      }
    } catch (e) {

    }
  }


  console.log(`[createBounty] Event parsing failed. Using fallback scan with bounties(id)...`);
  try {
    const length = await _public.readContract({
      address: _cfg.contract,
      abi: POIDH_ABI,
      functionName: "getBountiesLength",
    });

    console.log(`[createBounty] Total bounties: ${length}`);

    // Check the last 10 bounties (newest first)
    for (let i = length - 1n; i >= (length > 10n ? length - 10n : 0n); i--) {
      try {
        const b = await _public.readContract({
          address: _cfg.contract,
          abi: POIDH_ABI,
          functionName: "bounties",
          args: [i],
        });

        if (
          b.issuer.toLowerCase() === _account.address.toLowerCase() &&
          b.name === name
        ) {
          console.log(`[createBounty] Found matching bounty: #${b.id}`);
          return { bountyId: b.id, hash };
        }
      } catch (e) {
        
      }
    }
  } catch (e) {
    console.warn(`[createBounty] Fallback scan error: ${e.message}`);
  }

  throw new Error(
    `Bounty tx succeeded (${hash}) but could not determine bountyId.\n` +
    `Tx: ${_cfg.explorer}/tx/${hash}\n` +
    `Please check https://poidh.xyz/base and paste the bounty URL here.`
  );
}

/** Get all claims for a bounty. Returns array of claim objects. */
export async function getClaims(bountyId) {
  const bountyIdBig = BigInt(bountyId);
  const maxRetries = 3;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const claimsData = await _public.readContract({
        address: _cfg.contract,
        abi: POIDH_ABI,
        functionName: "getClaimsByBountyId",
        args: [bountyIdBig, 0n],
      });

      if (!claimsData || claimsData.length === 0) return [];

      // Filter real claims only (ignore padding entries)
      return claimsData
        .map((c) => ({
          id:          c.id ?? c[0] ?? 0,
          issuer:      c.issuer ?? c.claimant ?? c[1] ?? "0x0000000000000000000000000000000000000000",
          name:        c.name ?? c[4] ?? "",
          description: c.description ?? c[5] ?? "",
          createdAt:   c.createdAt ?? c[6] ?? 0n,
          accepted:    c.accepted ?? c[7] ?? false,
          uri:         c.uri ?? "",
        }))
        .filter((claim) => 
          claim.id > 0 && 
          claim.issuer !== "0x0000000000000000000000000000000000000000" &&
          (claim.name || claim.description || claim.uri)
        );

    } catch (err) {
      console.warn(`[getClaims] Attempt ${attempt}/${maxRetries} failed for bounty ${bountyId}: ${err.message}`);
      
      if (attempt === maxRetries) {
        console.warn(`[getClaims] All retries failed. Returning 0 claims.`);
        return [];
      }
      
      await new Promise(r => setTimeout(r, 2000 * attempt));
    }
  }
}

/** Accept a winning claim — triggers on-chain payout. */
export async function acceptClaim(bountyId, claimId) {
  const hash = await _wallet.writeContract({
    address: _cfg.contract,
    abi: POIDH_ABI,
    functionName: "acceptClaim",
    args: [BigInt(bountyId), BigInt(claimId)],
  });
  await _public.waitForTransactionReceipt({ hash });
  return hash;
}