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
[3] Claude vision AI         scores each new claim 0–10
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
- Anthropic API key
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

Useful PM2 commands:
```bash
pm2 logs poidh-bot     # live logs
pm2 status             # process list
pm2 stop poidh-bot     # stop
pm2 restart poidh-bot  # restart
```

You can run this on any machine — your laptop, a $5/month VPS (DigitalOcean, Hetzner, etc.), or a Mac Mini.

---

## Configuration

Run `npm run setup` for the guided wizard, or edit `.env` manually:

| Variable | Required | Default | Description |
|---|---|---|---|
| `BOT_PRIVATE_KEY` | ✅ | — | Bot wallet private key (hex) |
| `ANTHROPIC_API_KEY` | ✅ | — | Claude API key |
| `NETWORK` | ✅ | `base` | `base` or `arbitrum` |
| `BOUNTY_AMOUNT_ETH` | ✅ | `0.001` | Prize in ETH |
| `MIN_SCORE` | ✅ | `6.0` | Minimum AI score to accept (0–10) |
| `POLL_INTERVAL_MS` | ✅ | `300000` | Poll frequency in ms |
| `NEYNAR_API_KEY` | ⬜ | — | For Farcaster posting |
| `FARCASTER_SIGNER_UUID` | ⬜ | — | Farcaster signer |
| `RPC_URL` | ⬜ | public | Custom RPC endpoint |
| `BOUNTY_NAME` | ⬜ | built-in | Override bounty name |
| `BOUNTY_DESCRIPTION` | ⬜ | built-in | Override bounty description |

### Generate a wallet

```bash
# Option A — Node.js
node -e "import('viem/accounts').then(m => console.log(m.generatePrivateKey()))"

# Option B — Foundry
cast wallet new
```

Fund the address with ETH on Base before running.

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

Each claim is scored by **Claude claude-opus-4-5 with vision** across four dimensions:

| Dimension | What it checks |
|---|---|
| Authenticity (25%) | Real photo vs. AI-generated or stock image |
| Task Completion (35%) | Does it actually show the required action? |
| Creativity (20%) | Originality and spirit of the bounty |
| Evidence Quality (20%) | Clarity, context, credibility |

Score ≥ `MIN_SCORE` to be eligible. Highest score wins. Full reasoning is stored in `bot-state.json` and posted to Farcaster.

---

## Contract Addresses

| Network | Address |
|---|---|
| Base | `0xb502c5856f7244dccdd0264a541cc25675353d39` |
| Arbitrum | `0x0aa50ce0d724cc28f8f7af4630c32377b4d5c27d` |

---

## Limitations

| Issue | Notes |
|---|---|
| IPFS speed | Slow IPFS nodes may fail image fetch → lower score. Use Pinata for submissions. |
| Single bounty | One bounty per `bot-state.json`. Delete it and restart for a fresh cycle. |
| Hot wallet | Private key lives in `.env`. Use a dedicated wallet with minimal funds. |

---

## License

MIT
