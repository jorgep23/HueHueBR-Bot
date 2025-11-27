# HueHueBR Bot (Telegram)

Bot for HueHueBR token & HueHueBR Founders NFT.

Features:
- Token price (HBR/WBNB pair)
- Alerts for HBR buys (listens to PancakeSwap pair Swap events)
- Alerts for NFT mints (listens to Transfer events from zero)
- Mint helper instructions (public/whitelist)
- Ready for Railway deploy (Procfile)

## Quick start (local)
1. Copy `.env.example` to `.env` and fill values.
2. `npm install`
3. `node index.js`
4. Interact on Telegram with your bot.

## Deploy on Railway
1. Push repo to GitHub
2. New Project → Deploy from GitHub
3. Add environment variables from `.env.example`
4. Start project (Railway will run `node index.js`)

## Notes
- Use a dedicated RPC provider (Ankr, Blast, Nodereal) if you get `limit exceeded`.
- Do not commit `.env` or private keys.
- If you use Railway, set `WEBHOOK_URL` to your project URL; otherwise bot uses polling.
