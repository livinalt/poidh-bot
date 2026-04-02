import "dotenv/config";
import readline from "readline";
import fs from "fs/promises";
import chalk from "chalk";
import { createPublicClient, http, parseEther } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { base, arbitrum } from "viem/chains";

const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
const ask = (q) => new Promise((r) => rl.question(q, r));

const ok   = (t) => console.log(chalk.green(`  ok   ${t}`));
const warn = (t) => console.log(chalk.yellow(`  warn ${t}`));
const info = (t) => console.log(chalk.gray(`       ${t}`));
const err  = (t) => console.log(chalk.red(`  err  ${t}`));
const hdr  = (t) => console.log(chalk.bold.cyan(`\n-- ${t} ----------------------------------------`));

async function main() {
  console.log(chalk.bold.magenta(`
+-----------------------------------------------+
|         poidh-bot  Setup Wizard               |
+-----------------------------------------------+
`));
  console.log("This creates your .env configuration file.\n");
  console.log(chalk.yellow("  WARNING: Use a FRESH wallet with only what you need."));
  console.log(chalk.yellow("  Never reuse a wallet holding other assets.\n"));

  const cfg = {};

  // 1. Network
  hdr("1. Network");
  info("base (recommended, cheaper gas) or arbitrum");
  const network = (await ask(chalk.white("  Network [base]: "))).trim() || "base";
  if (!["base", "arbitrum"].includes(network)) { err("Use 'base' or 'arbitrum'"); process.exit(1); }
  cfg.NETWORK = network;
  ok(`Network: ${network}`);

  // 2. Wallet
  hdr("2. Bot Wallet");
  info("Generate a new key with:  node -e \"import('viem/accounts').then(m=>console.log(m.generatePrivateKey()))\"");
  info(`Then fund the address with ETH on ${network}`);

  const rawKey = (await ask(chalk.white("  Private key (hex): "))).trim();
  if (!rawKey) { err("Private key required"); process.exit(1); }

  try {
    const key = rawKey.startsWith("0x") ? rawKey : `0x${rawKey}`;
    const account = privateKeyToAccount(key);
    cfg.BOT_PRIVATE_KEY = key;
    ok(`Address: ${account.address}`);

    const chainObj = network === "base" ? base : arbitrum;
    const rpc = network === "base" ? "https://mainnet.base.org" : "https://arb1.arbitrum.io/rpc";
    try {
      const client = createPublicClient({ chain: chainObj, transport: http(rpc) });
      const bal = await client.getBalance({ address: account.address });
      const balEth = (Number(bal) / 1e18).toFixed(6);
      if (parseFloat(balEth) < 0.002) {
        warn(`Balance: ${balEth} ETH - fund this wallet before running the bot`);
      } else {
        ok(`Balance: ${balEth} ETH`);
      }
    } catch {
      warn("Could not check balance - ensure wallet is funded before starting");
    }
  } catch (e) { err(`Invalid private key: ${e.message}`); process.exit(1); }

  // 3. RPC URL
  hdr("3. RPC URL  (optional)");
  info("Blank = free public RPC (fine for testing)");
  info("For 24/7 uptime use Alchemy: https://alchemy.com  (free tier works)");
  const rpcUrl = (await ask(chalk.white("  RPC URL [public]: "))).trim();
  if (rpcUrl) cfg.RPC_URL = rpcUrl;

  // 4. Bounty amount
  hdr("4. Bounty Prize Amount");
  info("How much ETH to offer as the prize?");
  info("Start small: 0.001 ETH is good for testing");
  const amount = (await ask(chalk.white("  Amount in ETH [0.001]: "))).trim() || "0.001";
  try { parseEther(amount); } catch { err("Invalid amount"); process.exit(1); }
  cfg.BOUNTY_AMOUNT_ETH = amount;
  ok(`Prize: ${amount} ETH`);

  // 5. Min score
  hdr("5. Minimum Acceptance Score");
  info("AI scores each claim 0-10. Only claims above this are accepted.");
  info("6.0 = balanced  |  7.0 = strict  |  5.0 = lenient");
  const minScore = (await ask(chalk.white("  Min score [6.0]: "))).trim() || "6.0";
  cfg.MIN_SCORE = minScore;
  ok(`Min score: ${minScore}/10`);

  // 6. Poll interval
  hdr("6. Poll Interval");
  info("How often to check the chain for new claims (milliseconds)");
  info("300000 = 5 minutes  |  60000 = 1 minute");
  const poll = (await ask(chalk.white("  Interval ms [300000]: "))).trim() || "300000";
  cfg.POLL_INTERVAL_MS = poll;
  ok(`Polling every ${parseInt(poll) / 1000}s`);

  // 7. Gemini API key
  hdr("7. Gemini API Key");
  info("Required - powers the AI claim evaluation (free tier available)");
  info("Get yours at: https://aistudio.google.com/app/apikey");
  const geminiKey = (await ask(chalk.white("  API key: "))).trim();
  if (!geminiKey) { err("Gemini API key is required"); process.exit(1); }
  cfg.GEMINI_API_KEY = geminiKey;
  ok("Gemini key set");

  // 8. Farcaster
  hdr("8. Farcaster  (optional but strongly recommended)");
  info("Posts bounty announcements + winner decisions publicly");
  info("1. Create a bot account at https://warpcast.com");
  info("2. Get a Neynar API key at https://neynar.com");
  info("3. Create a signer in the Neynar dashboard");
  const neynarKey = (await ask(chalk.white("  Neynar API key [skip]: "))).trim();
  if (neynarKey) {
    cfg.NEYNAR_API_KEY = neynarKey;
    const signer = (await ask(chalk.white("  Farcaster signer UUID: "))).trim();
    if (signer) { cfg.FARCASTER_SIGNER_UUID = signer; ok("Farcaster configured"); }
  } else {
    warn("Skipped - decisions will be logged to console only");
  }

  // 9. Custom bounty
  hdr("9. Custom Bounty  (optional)");
  info("Leave blank to use the built-in 'Random Act of Kindness' bounty");
  const customName = (await ask(chalk.white("  Custom bounty name [use default]: "))).trim();
  if (customName) {
    cfg.BOUNTY_NAME = customName;
    console.log(chalk.gray("  Description (press Enter twice when done):"));
    const lines = [];
    while (true) {
      const line = await ask("");
      if (!line.trim()) break;
      lines.push(line);
    }
    if (lines.length) cfg.BOUNTY_DESCRIPTION = lines.join("\n");
  }

  rl.close();

  const envContent = [
    `# poidh-bot configuration - generated ${new Date().toISOString()}`,
    `# KEEP THIS FILE PRIVATE - never commit to git`,
    ``,
    ...Object.entries(cfg).map(([k, v]) => `${k}="${v.replace(/"/g, '\\"')}"`),
  ].join("\n") + "\n";

  await fs.writeFile(".env", envContent);

  console.log(chalk.bold.green(`
+-----------------------------------------------+
|              Setup Complete                   |
+-----------------------------------------------+

  npm start        - launch the bot
  npm run status   - check current state anytime

The bot will autonomously:
  1. Create a poidh bounty (${cfg.BOUNTY_AMOUNT_ETH} ETH on ${cfg.NETWORK})
  2. Poll every ${parseInt(cfg.POLL_INTERVAL_MS) / 1000}s for new submissions
  3. Score each with Gemini AI vision
  4. Accept the best claim and pay on-chain
  5. Post the full decision to Farcaster
`));
}

main().catch((e) => { err(e.message); process.exit(1); });