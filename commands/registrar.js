// commands/registrar.js
const storage = require('../services/storage');

function botRegisterHandlers(bot) {
  bot.onText(/\/start/, async (msg) => {
    const chatId = msg.chat.id;
    const help = [
      '🤖 HueHueBR Drop Bot',
      '',
      'Comandos:',
      '/registrar 0xSuaCarteira - registrar carteira (faça em privado)',
      '/price - ver preço atual configurado',
      '/mypoints - ver seus ganhos',
      '/withdraw <HBR> - solicitar saque (admin confirma)',
    ].join('\n');
    await bot.sendMessage(chatId, help);
  });

  bot.onText(/\/registrar\s+(0x[0-9a-fA-F]{40})/, async (msg, match) => {
    const chatId = msg.chat.id;
    const wallet = match[1];
    if (msg.chat.type !== 'private'){
      return bot.sendMessage(chatId, '🔐 Use este comando em PRIVADO com o bot: /registrar 0xSuaCarteira');
    }

    // save user
    const user = await storage.setUser(msg.from.id, { wallet: wallet, username: msg.from.username || msg.from.first_name, registeredAt: new Date().toISOString(), weight: 1 });
    await bot.sendMessage(chatId, '✅ Registrado! Sua carteira foi salva. Você passará a concorrer nos drops automáticos.');

    // detect duplicates
    const dup = await storage.findUsersByWallet(wallet);
    if (dup.length > 1) {
      await storage.addAdminLog({ type:'duplicate_wallet', wallet, found: dup.map(d=>d.telegramId) });
    }

    // public log
    const GROUP_ID = process.env.GROUP_ID;
    if (GROUP_ID) {
      await storage.addPublicLog({ text: `📥 @${msg.from.username || msg.from.first_name} entrou nos drops.` });
      try { await bot.sendMessage(GROUP_ID, `📥 @${msg.from.username || msg.from.first_name} registrou a carteira e está participando dos drops!`); } catch(e){}
    }
  });

  bot.on('new_chat_members', async (msg) => {
    for (const member of msg.new_chat_members) {
      const txt = `👋 *Bem-vindo, ${member.first_name || member.username}!* 🎉\n\nPara participar dos drops, abra o privado com o bot e envie:\n/registrar 0xSuaCarteira\n\nBoa sorte! 🇧🇷`;
      await bot.sendMessage(msg.chat.id, txt, { parse_mode:'Markdown' });
    }
  });
}

module.exports = { botRegisterHandlers };
