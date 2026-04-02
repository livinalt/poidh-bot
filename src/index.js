import "dotenv/config";
import { log } from "./logger.js";
import { loadState, addLog } from "./state.js";
import { initClients, createBounty, getClaims, acceptClaim, getBalance } from "./chain.js";
import { initAI, evaluateClaim } from "./evaluator.js";
import { initSocial, postCast } from "./social.js";

const {
  BOT_PRIVATE_KEY,
  RPC_URL,
  NETWORK = "base",
  GEMINI_API_KEY,
  NEYNAR_API_KEY,
  FARCASTER_SIGNER_UUID,
  BOUNTY_AMOUNT_ETH = "0.001",
  MIN_SCORE = "6.0",
  POLL_INTERVAL_MS = "300000",
  BOUNTY_NAME,
  BOUNTY_DESCRIPTION,
} = process.env;

function validateEnv() {
  const missing = ["BOT_PRIVATE_KEY", "GEMINI_API_KEY"].filter((k) => !process.env[k]);
  if (missing.length) {
    log.error(`Missing required env vars: ${missing.join(", ")}`);
    log.error('Run "npm run setup" to configure the bot');
    process.exit(1);
  }
}

const DEFAULT_NAME = "Random Act of Kindness - IRL Photo Bounty";

const DEFAULT_DESCRIPTION = `Take a photo of yourself or someone you witness performing a genuine random act of kindness in the real world.

Examples:
- Pay for a stranger's coffee or meal
- Help someone carry heavy bags
- Leave a kind note for a neighbour
- Feed stray animals
- Pick up litter in a public space
- Give directions to someone who looks lost

Rules:
- Must include a real photo clearly showing the action
- Must describe what you did and why
- Must be a genuine real-world physical act, no stock images
- Must be your own original submission

Judging:
This bounty is judged 100% by an autonomous AI (poidh-bot, powered by Gemini). It scores authenticity, task completion, creativity, and evidence quality. The highest-scoring submission above the threshold wins and is paid automatically on-chain. The AI is trained to detect stock photos and AI-generated images, so be genuine.`;

async function main() {
  console.log(`
+-----------------------------------------------+
|           poidh-bot  v1.0.0                   |
|   Autonomous AI Bounty Agent for poidh.xyz    |
+-----------------------------------------------+
`);

  validateEnv();

  const { address, cfg } = initClients(BOT_PRIVATE_KEY, NETWORK, RPC_URL);
  initAI(GEMINI_API_KEY);
  initSocial(NEYNAR_API_KEY, FARCASTER_SIGNER_UUID);

  const balance = await getBalance(address);
  log.info(`Wallet:  ${address}`);
  log.info(`Balance: ${balance} ${cfg.currency} on ${NETWORK}`);

  const minScore = parseFloat(MIN_SCORE);
  const pollMs = parseInt(POLL_INTERVAL_MS);
  const bountyName = BOUNTY_NAME || DEFAULT_NAME;
  const bountyDesc = BOUNTY_DESCRIPTION || DEFAULT_DESCRIPTION;

  let state = await loadState();

  // Phase 1: Create bounty (only if no bountyId exists)
  if (state.phase === "idle" && !state.bountyId) {
    log.step("Phase 1 - Creating bounty on-chain");

    const ethBal = parseFloat(balance);
    const needed = parseFloat(BOUNTY_AMOUNT_ETH) + 0.00001;
    if (ethBal < needed) {
      log.error(`Insufficient balance. Have ${balance} ETH, need ~${needed} ETH (bounty + gas)`);
      process.exit(1);
    }

    log.info(`Name:   ${bountyName}`);
    log.info(`Amount: ${BOUNTY_AMOUNT_ETH} ${cfg.currency}`);

    const { bountyId, hash } = await createBounty(bountyName, bountyDesc, BOUNTY_AMOUNT_ETH);
    const bountyUrl = cfg.bountyUrl(bountyId.toString());

    state = {
      ...state,
      phase: "monitoring",
      network: NETWORK,
      bountyId: bountyId.toString(),
      bountyName,
      bountyDescription: bountyDesc,
      bountyUrl,
      createdAt: new Date().toISOString(),
      evaluations: {},
      winner: null,
    };
    await addLog(state, `Bounty #${bountyId} created. TX: ${hash}`);

    log.success(`Bounty live! ID: ${bountyId}`);
    log.success(`View: ${bountyUrl}`);
    log.success(`TX:   ${cfg.explorer}/tx/${hash}`);

    await postCast([
      `poidh-bot just launched a live IRL bounty.`,
      ``,
      `"${bountyName}"`,
      ``,
      `Prize: ${BOUNTY_AMOUNT_ETH} ETH paid on-chain`,
      `Network: ${NETWORK}`,
      ``,
      `Fully autonomous AI judging - submissions evaluated and paid with zero human input.`,
      ``,
      `Submit here: ${bountyUrl}`,
      ``,
      `#poidh #bounty`,
    ].join("\n"));
  } 
  // Safety: If we already have a bountyId, force monitoring mode
  else if (state.bountyId) {
    log.success(`Resuming monitoring on existing bounty #${state.bountyId}`);
    state.phase = "monitoring";
  }

  // Phase 2-6: Monitor -> Evaluate -> Pay -> Announce
  if (state.phase === "monitoring") {
    log.step(`Phase 2 - Monitoring bounty #${state.bountyId}`);
    log.info(`Polling every ${pollMs / 1000}s  |  Min score: ${minScore}/10`);
    log.info(`Bounty: ${state.bountyUrl}`);

    while (true) {
      try {
        const claims = await getClaims(state.bountyId);

        const realClaimsCount = claims.length;
        log.info(`${realClaimsCount} real claim(s) on-chain`);

        for (const claim of claims) {
          const id = claim.id?.toString() || "0";

          // Skip obviously invalid/empty claims
          if (id === "0" || claim.issuer === "0x0000000000000000000000000000000000000000") {
            continue;
          }

          if (state.evaluations[id]) {
            log.dim(`Claim ${id} already scored: ${state.evaluations[id].score}/10`);
            continue;
          }

          log.step(`Evaluating claim ${id} from ${claim.issuer}`);
          log.dim(`Title: ${claim.name || "(no title)"}`);
          log.dim(`URI:   ${claim.uri || "(no media)"}`);

          const result = await evaluateClaim(claim, state.bountyDescription);
          state.evaluations[id] = result;
          await addLog(state, `Claim ${id} scored ${result.score}/10 - ${result.summary}`);

          log.success(`Score: ${result.score}/10`);
          log.dim(`Summary: ${result.summary}`);
        }

        const eligible = Object.values(state.evaluations)
          .filter((e) => !e.error && e.score >= minScore)
          .sort((a, b) => b.score - a.score);

        if (eligible.length > 0) {
          const winner = eligible[0];

          log.step(`Phase 5 - Accepting claim #${winner.claimId} (score ${winner.score}/10)`);

          const txHash = await acceptClaim(state.bountyId, winner.claimId);
          log.success(`Payout executed!`);
          log.success(`TX: ${cfg.explorer}/tx/${txHash}`);

          state.phase = "complete";
          state.winner = { ...winner, txHash };
          await addLog(state, `Winner: claim ${winner.claimId} | TX: ${txHash}`);

          log.step("Phase 6 - Announcing winner on Farcaster");

          await postCast([
            `poidh-bot has selected a winner.`,
            ``,
            `Bounty: "${state.bountyName}"`,
            `Prize: ${BOUNTY_AMOUNT_ETH} ETH paid on-chain`,
            ``,
            `Winner: ${winner.issuer}`,
            `Submission: "${winner.name}"`,
            ``,
            `AI Score: ${winner.score}/10`,
            `  Authenticity: ${winner.authenticity}/10`,
            `  Task completion: ${winner.taskCompletion}/10`,
            `  Creativity: ${winner.creativity}/10`,
            `  Evidence quality: ${winner.evidenceQuality}/10`,
            ``,
            `Reasoning: ${winner.reasoning}`,
            ``,
            `Payout TX: ${cfg.explorer}/tx/${txHash}`,
            `Bounty: ${state.bountyUrl}`,
            ``,
            `No human touched this decision.`,
            `Source: github.com/YOUR_ORG/poidh-bot`,
            `#poidh #ai #autonomous`,
          ].join("\n"));

          log.success("Winner announced!");

          console.log(`
+-----------------------------------------------+
|              BOUNTY COMPLETE                  |
+-----------------------------------------------+
Winner:  ${winner.issuer}
Score:   ${winner.score}/10
TX:      ${cfg.explorer}/tx/${txHash}
Bounty:  ${state.bountyUrl}

Reasoning:
${winner.reasoning}
          `);
          return;
        }

        // Clean logging
        const totalEvaluated = Object.keys(state.evaluations).length;
        log.info(`No eligible claims yet (${totalEvaluated} evaluated total, ${realClaimsCount} this poll)`);
        log.info(`Next check in ${pollMs / 1000}s...`);

      } catch (err) {
        log.error(`Loop error: ${err.message}`);
        await addLog(state, `Error: ${err.message}`);
      }

      await new Promise((r) => setTimeout(r, pollMs));
    }
  }

  if (state.phase === "complete") {
    log.success("Bounty already complete.");
    console.log(JSON.stringify(state.winner, null, 2));
  }
}

main().catch((err) => {
  log.error(`Fatal: ${err.message}`);
  console.error(err);
  process.exit(1);
});