# poidh-bot 🤖

Fully autonomous AI bounty agent for [poidh.xyz](https://poidh.xyz).

Creates real-world bounties, monitors submissions, evaluates them with Claude AI vision, selects the best claim, pays the winner on-chain, and publicly explains its reasoning — with **zero human intervention** after deployment.

---

## How it works

```
npm start
    │
    ▼
[1] createSoloBounty()       deposits ETH + posts bounty on-chain
    │
    ▼
[2] Poll getBountyClaims()   checks chain every N minutes
    │
    ▼
[3] Gemini vision AI         scores each new claim 0–10
    │                        across: authenticity / task completion /
    │                                creativity / evidence quality
    ▼
[4] Select winner            highest score above threshold
    │
    ▼
[5] acceptClaim()            on-chain tx — pays winner automatically
    │
    ▼
[6] postCast()               announces winner + full AI reasoning on Farcaster
```

Every step is logged to `bot-state.json` — fully auditable.

---

## Requirements

- Node.js ≥ 20
- A wallet with enough ETH on Base or Arbitrum (bounty amount + ~0.001 ETH for gas)
- Gemini 2.5 flash API key
- Neynar API key + Farcaster signer UUID (for social transparency)

---

## Setup

```bash
# 1. Clone and install
git clone https://github.com/YOUR_ORG/poidh-bot
cd poidh-bot
npm install

# 2. Run the setup wizard — it validates your wallet live and writes .env
npm run setup

# 3. Start the bot — fully autonomous from here
npm start
```

To check on it at any time:
```bash
npm run status
```

---

## Keeping it running 24/7

The bot is just a Node.js process. To keep it alive on a server or your machine, use PM2:

```bash
npm install -g pm2
pm2 start src/index.js --name poidh-bot
pm2 save        # remember it across reboots
pm2 startup     # auto-start on system boot
```

---

## Configuration

Run `npm run setup` for the guided wizard, or edit `.env` manually:

### Environment Variables

| Variable                  | Required | Default          | Description |
|---------------------------|----------|------------------|-----------|
| `BOT_PRIVATE_KEY`         | ✅ Yes   | —                | Private key of the bot's EOA wallet (must start with `0x` or without). **Never commit this.** |
| `GEMINI_API_KEY`          | ✅ Yes   | —                | Google Gemini API key (for AI evaluation + vision). Get it from [Google AI Studio](https://aistudio.google.com/app/apikey) |
| `NETWORK`                 | No       | `base`           | Blockchain network: `base` (recommended) or `arbitrum` |
| `BOUNTY_AMOUNT_ETH`       | No       | `0.001`          | Bounty prize amount in ETH |
| `MIN_SCORE`               | No       | `6.0`            | Minimum AI score (0–10) required to auto-accept a submission |
| `POLL_INTERVAL_MS`        | No       | `300000`         | How often to check for new claims (in milliseconds). Default = 5 minutes |
| `RPC_URL`                 | No       | Public RPC       | Custom RPC endpoint (recommended for stability: Alchemy or Base public RPC) |
| `NEYNAR_API_KEY`          | No       | —                | Neynar API key for posting to Farcaster (optional but recommended) |
| `FARCASTER_SIGNER_UUID`   | No       | —                | Farcaster signer UUID (required if using Neynar) |
| `BOUNTY_NAME`             | No       | Built-in         | Custom bounty name (leave empty to use default) |
| `BOUNTY_DESCRIPTION`      | No       | Built-in         | Custom bounty description (leave empty to use default) |

---

## Architecture

```
poidh-bot/
├── src/
│   ├── index.js      Main loop — all 6 phases
│   ├── chain.js      On-chain: createSoloBounty, getBountyClaims, acceptClaim
│   ├── abi.js        poidh v2 contract ABI
│   ├── chains.js     Network config (Base, Arbitrum)
│   ├── evaluator.js  Claude vision AI scoring
│   ├── social.js     Farcaster posting via Neynar
│   ├── state.js      Crash-safe persistence to bot-state.json
│   ├── logger.js     Colored terminal output
│   ├── setup.js      Interactive setup wizard
│   └── status.js     Live status dashboard
├── .env.example
├── .gitignore
└── package.json
```

---

## How autonomy is enforced

No MetaMask. No manual signing. No human in the loop.

The bot uses [viem](https://viem.sh) with `privateKeyToAccount` to sign all transactions directly from the private key in `.env`. Once `npm start` runs, it enters a `while(true)` polling loop and executes `acceptClaim` automatically when a winner is found. No prompts, no confirmations.

The only human action: `npm start`. Everything after is autonomous.

---

## AI Evaluation

Each submission is automatically evaluated by **Google Gemini 2.5 Flash (with vision)** using a structured prompt.

The AI scores the claim across five dimensions:

| Dimension          | Weight | What it evaluates |
|--------------------|--------|-------------------|
| **Authenticity**   | 25%    | Real photo vs AI-generated, stock image, or edited |
| **Task Completion**| 35%    | Does it clearly show the required real-world action? |
| **Creativity**     | 20%    | Originality and how well it captures the spirit of the bounty |
| **Evidence Quality**| 20%   | Photo clarity, context, timestamps, and supporting details |

- Only submissions with a score **≥ `MIN_SCORE`** (default: 6.0/10) are eligible.
- The highest-scoring valid submission wins and is paid automatically.
- Full reasoning, scores, and verdict are logged locally and posted publicly on Farcaster.

---

## Contract Addresses

| Network   | Contract Address                          |
|-----------|-------------------------------------------|
| **Base** (Recommended) | `0x5555Fa783936C260f77385b4E153B9725feF1719` |
| Arbitrum  | `0x0aa50ce0d724cc28f8f7af4630c32377b4d5c27d` |

---

## Limitations & Known Issues

| Issue                    | Description |
|--------------------------|-----------|
| **RPC Reliability**      | Free/public RPCs may occasionally fail. Consider using Alchemy or a paid RPC for 24/7 uptime. |
| **Image Fetching**       | IPFS/arweave links can be slow or unreachable. The bot retries alternative gateways. |
| **Single Bounty Mode**   | Currently supports monitoring **one active bounty** at a time. Delete `bot-state.json` to start a new one. |
| **Hot Wallet**           | The bot uses a hot wallet (private key in `.env`). Only fund it with what you're willing to lose. |
| **No Manual Override**   | Once started, the bot runs fully autonomously. No human intervention is allowed after launch. |

---

## License

MIT