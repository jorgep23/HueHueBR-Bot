// commands/registrar.js
const storage = require('../services/storage.js');

function botRegisterHandlers(bot) {

  // /start
  bot.onText(/\/start/, async (msg) => {
    const chatId = msg.chat.id;
    const help = [
      '🤖 HueHueBR Drop Bot',
      '',
      'Comandos:',
      '/registrar 0xSuaCarteira  — registrar (privado)',
      '/price  — ver preço atual',
      '/mypoints  — ver seus ganhos',
      '/withdraw <HBR>  — solicitar saque',
    ].join('\n');

    await bot.sendMessage(chatId, help);
  });


  // /registrar (apenas privado)
  bot.onText(/\/registrar\s+(0x[0-9a-fA-F]{40})/, async (msg, match) => {
    const chatId = msg.chat.id;
    const wallet = match[1].toLowerCase();

    // impedir registro em grupo
    if (msg.chat.type !== 'private') {
      return bot.sendMessage(
        chatId,
        '🔐 Use este comando em PRIVADO: /registrar 0xSuaCarteira'
      );
    }

    // salva usuário
    const user = await storage.setUser(
      msg.from.id,
      {
        wallet,
        username: msg.from.username || msg.from.first_name,
        registeredAt: new Date().toISOString()
      }
    );

    await bot.sendMessage(chatId, '✅ Carteira registrada com sucesso! Você agora participa dos drops automáticos.');

    // detectar duplicatas
    const dup = await storage.findUsersByWallet(wallet);
    if (dup.length > 1) {
      await storage.addAdminLog({
        type: 'duplicate_wallet',
        wallet,
        found: dup.map(d => d.telegramId)
      });
    }

    // log público REAL com string
    const GROUP_ID = process.env.GROUP_ID;
    if (GROUP_ID) {
      await storage.addPublicLog(`📥 @${msg.from.username || msg.from.first_name} entrou nos drops!`);
      try {
        await bot.sendMessage(
          GROUP_ID,
          `📥 @${msg.from.username || msg.from.first_name} registrou a carteira e está participando dos drops!`
        );
      } catch (e) {}
    }
  });


  // mensagem automática para novos membros no GRUPO
  bot.on('new_chat_members', async (msg) => {
    for (const member of msg.new_chat_members) {
      const txt =
        `👋 *Bem-vindo, ${member.first_name || member.username}!* 🎉\n\n` +
        `Para participar dos drops, abra o privado com o bot e envie:\n` +
        `/registrar 0xSuaCarteira\n\n` +
        `Boa sorte! 🇧🇷`;

      await bot.sendMessage(msg.chat.id, txt, { parse_mode: 'Markdown' });
    }
  });

}

module.exports = { botRegisterHandlers };
