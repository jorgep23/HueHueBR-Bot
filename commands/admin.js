const storage = require('../services/storage');

function isAdmin(msg){
  const admin = String(process.env.ADMIN_ID || '');
  return String(msg.from.id) === admin;
}

function botAdminHandlers(bot){
  // set price (admin)
  bot.onText(/\/setprice\s+([0-9]*\.?[0-9]+)/, (msg, match) => {
    if (!isAdmin(msg)) return;
    const p = Number(match[1]);
    storage.updateConfig(cfg => { cfg.priceUsd = p; });
    bot.sendMessage(msg.chat.id, `✅ Preço atualizado para $${p}`);
  });

  // set interval in minutes
  bot.onText(/\/setinterval\s+(\d+)/, (msg, match) => {
    if (!isAdmin(msg)) return;
    const m = Number(match[1]);
    storage.updateConfig(cfg => { cfg.intervalMin = m; });
    bot.sendMessage(msg.chat.id, `✅ Intervalo configurado para ${m} minutos.`);
  });

  // force drop now (admin)
  bot.onText(/\/forcedrop(?:\s+(\d+))?/, async (msg, match) => {
    if (!isAdmin(msg)) return;
    const n = match && match[1] ? Number(match[1]) : 1;
    for (let i=0;i<n;i++){
      await require('../services/dropper').performDrop(bot);
    }
    bot.sendMessage(msg.chat.id, `✅ Executado ${n} drops.`);
  });

  // list withdrawals
  bot.onText(/\/listwithdraws/, (msg) => {
    if (!isAdmin(msg)) return;
    const list = storage.listWithdrawals();
    if (!list.length) return bot.sendMessage(msg.chat.id, 'Nenhuma solicitação.');
    const lines = list.map(w=>`ID:${w.id} User:@${w.username} Amount:${w.amount} Wallet:${w.wallet}`).slice(0,20);
    bot.sendMessage(msg.chat.id, 'Pending:\n' + lines.join('\n'));
  });

  // approve withdrawal (admin) - removes and notifies admin to send tokens manually
  bot.onText(/\/approve\s+([0-9a-fA-F-]+)/, (msg, match) => {
    if (!isAdmin(msg)) return;
    const id = match[1];
    const req = storage.popWithdrawal(id);
    if (!req) return bot.sendMessage(msg.chat.id, 'ID não encontrado.');
    bot.sendMessage(msg.chat.id, `✅ Solicitação aprovada. Envie manualmente ${req.amount} HBR para ${req.wallet} e confirme.`);
    // notify user
    bot.sendMessage(req.telegramId, `✅ Seu saque de ${req.amount} HBR foi aprovado. Aguarde o envio.`);
  });
}

module.exports = { botAdminHandlers };
