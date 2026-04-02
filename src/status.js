import "dotenv/config";
import chalk from "chalk";
import { loadState } from "./state.js";
import { initClients, getBalance } from "./chain.js";

const PHASE_LABELS = {
  idle:       chalk.gray(" Idle — not started yet"),
  monitoring: chalk.yellow(" Monitoring — waiting for submissions"),
  complete:   chalk.green(" Complete — winner selected and paid"),
};

async function main() {
  const state = await loadState();

  console.log(chalk.bold.cyan("\n═══ poidh-bot Status ═══\n"));
  console.log(`Phase:   ${PHASE_LABELS[state.phase] ?? state.phase}`);

  if (state.bountyId) {
    console.log(`Bounty:  #${state.bountyId} on ${state.network}`);
    console.log(`URL:     ${state.bountyUrl}`);
    console.log(`Created: ${state.createdAt}`);
  }

  const evals = Object.values(state.evaluations ?? {});
  if (evals.length > 0) {
    console.log(chalk.bold(`\nEvaluations (${evals.length} claim${evals.length > 1 ? "s" : ""}):`));
    evals.sort((a, b) => b.score - a.score).forEach((e) => {
      const filled = Math.round(e.score);
      const bar = "█".repeat(filled) + "░".repeat(10 - filled);
      console.log(`  ${e.score.toFixed(1)}/10 [${bar}] #${e.claimId} — ${e.summary}`);
    });
  }

  if (state.winner) {
    console.log(chalk.bold.green("\n🏆 Winner:"));
    console.log(`  Claim:   #${state.winner.claimId}`);
    console.log(`  Address: ${state.winner.issuer}`);
    console.log(`  Score:   ${state.winner.score}/10`);
    console.log(`  TX:      ${state.winner.txHash}`);
    console.log(chalk.gray(`\n  Reasoning: ${state.winner.reasoning}`));
  }

  if (state.logs?.length) {
    console.log(chalk.bold("\nRecent activity:"));
    state.logs.slice(-8).forEach((l) =>
      console.log(chalk.gray(`  ${l.ts.slice(11, 19)}  ${l.message}`))
    );
  }

  if (process.env.BOT_PRIVATE_KEY && process.env.NETWORK) {
    try {
      const { address, cfg } = initClients(
        process.env.BOT_PRIVATE_KEY,
        process.env.NETWORK,
        process.env.RPC_URL
      );
      const bal = await getBalance(address);
      console.log(`\nWallet:  ${address}`);
      console.log(`Balance: ${bal} ${cfg.currency}`);
    } catch {}
  }

  console.log();
}

main().catch(console.error);
