const storage = require('../services/storage');

function botRegisterHandlers(bot){
  // /start and /help
  bot.onText(/\/start/, (msg) => {
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
    bot.sendMessage(chatId, help);
  });

  // registrar in private
  bot.onText(/\/registrar\s+(0x[0-9a-fA-F]{40})/, async (msg, match) => {
    const chatId = msg.chat.id;
    const wallet = match[1];
    if (msg.chat.type !== 'private'){
      return bot.sendMessage(chatId, '🔐 Use este comando em PRIVADO com o bot: /registrar 0xSuaCarteira');
    }
    const user = storage.setUser(msg.from.id, { wallet: wallet, username: msg.from.username || msg.from.first_name, registeredAt: new Date() });
    bot.sendMessage(chatId, '✅ Registrado! Sua carteira foi salva. Você passará a concorrer nos drops automáticos.');
    // notify group if GROUP_ID
    const GROUP_ID = process.env.GROUP_ID;
    if (GROUP_ID){
      bot.sendMessage(GROUP_ID, `📥 @${msg.from.username || msg.from.first_name} registrou a carteira e está participando dos drops!`);
    }
  });

  // welcome in group
  bot.on('new_chat_members', (msg) => {
    msg.new_chat_members.forEach(member => {
      const txt = `👋 Bem-vindo, ${member.first_name || member.username}! Para participar dos drops envie no privado:\n/registrar 0xSuaCarteira`;
      bot.sendMessage(msg.chat.id, txt);
    });
  });
}

module.exports = { botRegisterHandlers };
