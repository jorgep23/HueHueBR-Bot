const { bot } = require("../index");

module.exports = (bot) => {
  bot.onText(/\/start/, async (msg) => {
    const chatId = msg.chat.id;

    const text = `
🤖 *Bem-vindo ao Bot HueHueBR!*

Aqui estão todos os comandos disponíveis:

🔥 *Informações do Token*
• /price – Mostra o preço atual do HBR
• /tokenInfo – Informações do token (supply, holders, liquidity, etc.)

🎁 *Drops*
• /registrar – Registra sua carteira para participar dos drops
• /drop – (Admin) Envia drop para um usuário registrado

📡 *Watchers / Monitoramentos*
• /watch – Ativa monitoramento automático
• /unwatch – Desativa monitoramento
• /status – Mostra o status do watcher

🛠 *Admin*
• /broadcast <msg> – Envia mensagem para todos usuários registrados
• /painel – Mostra o painel de administração
• /forcarPreco – Atualiza o preço manualmente

💬 *Utilidades*
• /help – Mostra novamente todos os comandos

Escolha um comando para continuar. 🚀
`;

    await bot.sendMessage(chatId, text, { parse_mode: "Markdown" });
  });
};

