# MEXC Spot Grid Trading Bot

Production-grade **MEXC spot grid trading bot** written in TypeScript. Automates buy-low / sell-high cycles across a configurable price grid using **arithmetic** or **geometric** spacing, with risk limits, stop-loss / take-profit triggers, dry-run mode, and a full CLI toolkit.

---

## Features

| Feature | Description |
|---------|-------------|
| **Grid modes** | Arithmetic (equal price steps) or geometric (equal % steps) |
| **Auto-rebalance** | On fill: buy → place sell one level up; sell → place buy one level down |
| **Risk controls** | Max quote exposure, order size validation |
| **Stop-loss / take-profit** | Optional price triggers that cancel orders and shut down the bot |
| **Dry run** | Simulate full order flow without sending orders |
| **CLI tools** | `simulate`, `status`, `ping`, `start` commands |
| **Type-safe** | Zod config validation, strict TypeScript |

---

## Project structure

```
MEXC-spot-grid-trading-bot/
├── src/
│   ├── api/mexc/           # MEXC REST client, HMAC auth, types
│   ├── config/             # Environment & Zod validation
│   ├── strategies/grid/    # Grid engine, levels, order manager
│   ├── services/           # Logger, risk manager, market data
│   ├── utils/              # Decimal math, retry helper
│   ├── index.ts            # Main entry (long-running bot)
│   └── cli.ts              # CLI commands
├── tests/                  # Unit & integration tests
├── .env.example
├── package.json
└── README.md
```

---

## Requirements

- **Node.js** 20 or later
- **MEXC API key** with spot trade permissions
- Sufficient balance on the trading pair

---

## Quick start

```bash
cd MEXC-spot-grid-trading-bot
npm install
cp .env.example .env
```

Edit `.env` with your MEXC credentials and grid parameters.

### Test API connectivity

```bash
npm run cli -- ping
```

### Preview grid (no live orders)

```bash
npm run cli -- simulate
```

### Dry run (simulated orders, no exchange writes)

```bash
npm run cli -- start --dry-run
```

### Start bot (live trading)

```bash
npm run build
npm start
```

Or for development:

```bash
npm run dev
```

---

## Configuration

Copy `.env.example` to `.env` and set:

| Variable | Description |
|----------|-------------|
| `MEXC_API_KEY` | API key from MEXC |
| `MEXC_SECRET_KEY` | Secret key |
| `MEXC_SYMBOL` | Pair, e.g. `BTCUSDT` or `BTC-USDT` |
| `GRID_MODE` | `arithmetic` or `geometric` |
| `GRID_LOWER_PRICE` | Grid floor price |
| `GRID_UPPER_PRICE` | Grid ceiling price |
| `GRID_LEVELS` | Number of price levels (2–200) |
| `GRID_ORDER_SIZE` | Size per order (base currency) |
| `MAX_QUOTE_EXPOSURE` | Optional max USDT exposure |
| `STOP_LOSS_PRICE` | Optional stop-loss trigger price |
| `TAKE_PROFIT_PRICE` | Optional take-profit trigger price |
| `POLL_INTERVAL_MS` | Order sync interval (default 5000) |

---

## How grid trading works

1. **Deploy**: Place **buy** limit orders below the current price and **sell** limits above it, on each grid level.
2. **Buy fills**: Automatically place a **sell** at the next higher grid level (profit on the spread).
3. **Sell fills**: Place a **buy** at the next lower level to re-enter.
4. **Poll**: The bot syncs open orders with MEXC and rebalances on each fill.

```
Price →
  SELL @ 66k ─────────────
  SELL @ 65.5k ──────────
  ─── current ~ 65k ───
  BUY  @ 64.5k ──────────
  BUY  @ 64k ────────────
```

---

## Scripts

| Command | Description |
|---------|-------------|
| `npm run build` | Compile TypeScript to `dist/` |
| `npm start` | Run compiled bot |
| `npm run dev` | Run with `tsx` (hot reload friendly) |
| `npm run cli -- simulate` | Preview grid levels |
| `npm run cli -- status` | Show live ticker |
| `npm run cli -- ping` | Test MEXC API connectivity |
| `npm run cli -- start --dry-run` | Start in dry-run mode |
| `npm test` | Run test suite |
| `npm run lint` | Typecheck without emit |

---

## Safety

- Always test with `--dry-run` first before live trading.
- Grid bots lose money in strong trends; range-bound markets suit grids best.
- Set `MAX_QUOTE_EXPOSURE` to cap downside.
- Use `STOP_LOSS_PRICE` and `TAKE_PROFIT_PRICE` for automated exit rules.
- Never commit `.env` or share API keys.

---

## License

MIT

---

## Technical support

> ### Need help?
>
> For setup, configuration, bugs, or trading-bot support, contact us on Telegram:
>
> # [@tradingtermin](https://t.me/tradingtermin)
>
> **Telegram:** [@tradingtermin](https://t.me/tradingtermin)

**Support contact (Telegram):** [**@tradingtermin**](https://t.me/tradingtermin)
