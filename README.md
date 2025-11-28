HueHueBR Telegram Bot
=====================

Funcionalidades:
- Registrar carteira BNB (/registrar 0x...)
- Mostrar painel do token (/hbr, /preco)
- Enviar drops manuais (admin) /drop <amount>
- Drops por convite automático
- Limite diário por usuário
- Watcher básico (pump/queda) que envia notificações ao grupo

Instalação:
1. git clone ...
2. npm install
3. Copie `.env.example` para `.env` e preencha
4. Cole a ABI do token em utils/abi.json
5. npm start

Segurança:
- NÃO comprometa a BOT_PRIVATE_KEY. Use uma wallet específica e limite fundos.
- Teste em testnet antes de mainnet.

