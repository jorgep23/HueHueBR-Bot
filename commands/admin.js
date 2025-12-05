// commands/admin.js
const storage = require('../services/storage');

function isAdmin(msg) {
  const admin = String(process.env.ADMIN_ID || '');
  return msg && msg.from && String(msg.from.id) === admin;
}

function botAdminHandlers(bot) {
  // set price
  bot.onText(/\/setprice\s+([0-9]*\.?[0-9]+)/, async (msg, match) => {
    if (!isAdmin(msg)) return;
    const p = Number(match[1]);
    await storage.updateConfig(cfg => { cfg.priceUsd = p; });
    await bot.sendMessage(msg.chat.id, `✅ Preço atualizado para $${p}`);
  });

  // set interval
  bot.onText(/\/setinterval\s+(\d+)/, async (msg, match) => {
    if (!isAdmin(msg)) return;
    const m = Number(match[1]);
    await storage.updateConfig(cfg => { cfg.intervalMin = m; });
    await bot.sendMessage(msg.chat.id, `✅ Intervalo configurado para ${m} minutos.`);
  });

  // forcedrops
  bot.onText(/\/forcedrop(?:\s+(\d+))?/, async (msg, match) => {
    if (!isAdmin(msg)) return;
    const n = match && match[1] ? Number(match[1]) : 1;
    for (let i=0;i<n;i++){
      await require('../services/dropper').performDrop(bot);
    }
    bot.sendMessage(msg.chat.id, `✅ Executado ${n} drops.`);
  });

  // list withdrawals
  bot.onText(/\/listwithdraws/, async (msg) => {
    if (!isAdmin(msg)) return;
    const list = await storage.listWithdrawals();
    if (!list.length) return bot.sendMessage(msg.chat.id, 'Nenhuma solicitação.');
    const lines = list.map(w=>`ID:${w.id} User:@${w.username} Amount:${w.amount} Wallet:${w.wallet}`).slice(0,20);
    bot.sendMessage(msg.chat.id, 'Pending:\n' + lines.join('\n'));
  });

  // approve withdrawal
  bot.onText(/\/approve\s+([0-9a-fA-F-]+)/, async (msg, match) => {
    if (!isAdmin(msg)) return;
    const id = match[1];
    const req = await storage.completeWithdrawal(id, msg.from.id);
    if (!req) return bot.sendMessage(msg.chat.id, 'ID não encontrado.');
    bot.sendMessage(msg.chat.id, `✅ Solicitação aprovada e marcada como PAGA. ID: ${id}`);
    // notify
    try { await bot.sendMessage(req.telegramId, `✅ Seu saque de ${req.amount} HBR foi aprovado e marcado como pago. Obrigado!`); } catch(e){}
    const GROUP_ID = process.env.GROUP_ID;
    if (GROUP_ID) await bot.sendMessage(GROUP_ID, `✅ Saque pago! Usuário: @${req.username}\nQuantia: ${req.amount} HBR\nCarteira: \`${req.wallet}\``,{parse_mode:'Markdown'});
  });

  // reject withdrawal
  bot.onText(/\/reject\s+([0-9a-fA-F-]+)\s*(.*)/, async (msg, match) => {
    if (!isAdmin(msg)) return;
    const id = match[1];
    const reason = match[2] || 'sem motivo informado';
    const req = await storage.rejectWithdrawal(id, msg.from.id, reason);
    if (!req) return bot.sendMessage(msg.chat.id, 'ID não encontrado.');
    try { await bot.sendMessage(req.telegramId, `❌ Seu saque de ${req.amount} HBR foi rejeitado. Motivo: ${reason}`); } catch(e){}
    bot.sendMessage(msg.chat.id, `✅ Solicitação rejeitada. ID: ${id}`);
  });

  // admin logs
  bot.onText(/\/adminlogs/, async (msg) => {
    if (!isAdmin(msg)) return;
    const db = await storage.read();
    const lines = (db.logsAdmin || []).slice(0,50).map(l=>`${l.ts} ${l.type} ${l.id||''} ${l.telegramId||''}`);
    bot.sendMessage(msg.chat.id, 'Admin logs:\n' + lines.join('\n'));
  });

  // blocked list
  bot.onText(/\/blocked/, async (msg) => {
    if (!isAdmin(msg)) return;
    const db = await storage.read();
    const blocked = Object.entries(db.users).filter(([id,u]) => u.blocked).map(([id,u]) => `@${u.username||id} (${id})`);
    if (!blocked.length) return bot.sendMessage(msg.chat.id, 'Nenhum usuário bloqueado.');
    bot.sendMessage(msg.chat.id, 'Usuários bloqueados:\n' + blocked.join('\n'));
  });

  // unblock
  bot.onText(/\/unblock\s+(\d+)/, async (msg, match) => {
    if (!isAdmin(msg)) return;
    const id = match[1];
    const user = await storage.unblockUser(id);
    if (user) {
      await bot.sendMessage(msg.chat.id, `✅ Usuário @${user.username || id} desbloqueado.`);
    } else {
      bot.sendMessage(msg.chat.id, 'Usuário não encontrado.');
    }
  });

  // resetday single user
  bot.onText(/\/resetday\s+(\d+)/, async (msg, match) => {
    if (!isAdmin(msg)) return;
    const id = match[1];
    const user = await storage.getUser(id);
    if (!user) return bot.sendMessage(msg.chat.id, 'Usuário não encontrado.');
    user.totalToday = 0;
    await storage.setUser(id, user);
    await storage.addAdminLog({ type:'admin_resetday', telegramId:id, by: msg.from.id, ts: new Date().toISOString() });
    bot.sendMessage(msg.chat.id, `🔁 Recompensa diária de @${user.username || id} resetada.`);
  });

  // set max daily USD
  bot.onText(/\/setmaxdailyusd\s+([0-9]*\.?[0-9]+)/, async (msg, match) => {
    if (!isAdmin(msg)) return;
    const v = parseFloat(match[1]);
    if (isNaN(v)) return bot.sendMessage(msg.chat.id, 'Valor inválido.');
    await storage.updateConfig(cfg => { cfg.maxDailyRewardUsd = v; });
    bot.sendMessage(msg.chat.id, `✅ Limite diário global atualizado para $${v.toFixed(2)}.`);
  });

}

module.exports = { botAdminHandlers };
