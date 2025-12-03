HueHueBR Drop Bot (no smart contract)
====================================

This project is a Telegram bot that runs automatic HBR drops (no smart contract).
It registers user wallets, performs random drops, logs to a JSON database and
allows users to request withdrawals which are manually processed by admins.

Designed for deployment on Railway (or other Node.js hosts).

Setup:
1. Copy .env.example -> .env and fill values (BOT_TOKEN_DROP, ADMIN_ID, GROUP_ID)
2. npm install
3. npm start

Files of interest:
- index.js         : entrypoint (starts bot + HTTP health)
- services/dropper.js : automatic dropper service
- services/storage.js : JSON DB helper
- commands/registrar.js : /registrar command and welcome handling
- commands/admin.js : admin commands (/setprice, /setinterval, /forceDrop, /listWithdraws)
- commands/user.js : user commands (/price, /mypoints, /withdraw)

Database:
- database.json (created automatically) keeps users, config and withdrawals.

Security notes:
- Keep BOT_TOKEN_DROP and ADMIN_ID secret.
- Use a dedicated wallet to send HBR manually for withdrawals.
- Monitor spending and logs.
