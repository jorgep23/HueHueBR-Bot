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

  // approve withdrawal (admin) - marks as paid and notifies user & group
  bot.onText(/\/approve\s+([0-9a-fA-F-]+)/, (msg, match) => {
    if (!isAdmin(msg)) return;
    const id = match[1];
    const req = storage.completeWithdrawal(id, msg.from.id);
    if (!req) return bot.sendMessage(msg.chat.id, 'ID não encontrado.');
    bot.sendMessage(msg.chat.id, `✅ Solicitação aprovada e marcada como PAGA. ID: ${id}`);
    // notify user
    bot.sendMessage(req.telegramId, `✅ Seu saque de ${req.amount} HBR foi aprovado e marcado como pago. Obrigado!`);
    // notify group publicly
    const GROUP_ID = process.env.GROUP_ID;
    if (GROUP_ID) bot.sendMessage(GROUP_ID, `✅ Saque pago! Usuário: @${req.username}\nQuantia: ${req.amount} HBR\nCarteira: \`${req.wallet}\``,{parse_mode:'Markdown'});
  });

  // reject withdrawal
  bot.onText(/\/reject\s+([0-9a-fA-F-]+)\s*(.*)/, (msg, match) => {
    if (!isAdmin(msg)) return;
    const id = match[1];
    const reason = match[2] || 'sem motivo informado';
    const req = storage.rejectWithdrawal(id, msg.from.id, reason);
    if (!req) return bot.sendMessage(msg.chat.id, 'ID não encontrado.');
    bot.sendMessage(req.telegramId, `❌ Seu saque de ${req.amount} HBR foi rejeitado. Motivo: ${reason}`);
    bot.sendMessage(msg.chat.id, `✅ Solicitação rejeitada. ID: ${id}`);
  });

  // list admin logs
  bot.onText(/\/adminlogs/, (msg) => {
    if (!isAdmin(msg)) return;
    const db = storage.read();
    const lines = (db.logsAdmin || []).slice(0,50).map(l=>`${l.ts} ${l.type} ${l.id||''} ${l.telegramId||''}`);
    bot.sendMessage(msg.chat.id, 'Admin logs:\n' + lines.join('\n'));
  });
}

module.exports = { botAdminHandlers };
