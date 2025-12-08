// commands/admin.js

const storage = require("../services/storage.js");
const { performDrop } = require("../services/dropper.js");

function isAdmin(msg) {
  return String(msg?.from?.id || "") === String(process.env.ADMIN_ID || "");
}

function botAdminHandlers(bot) {

  /* ===================== PRICE ===================== */

  bot.onText(/\/setprice\s+([0-9]*\.?[0-9]+)/, async (msg, match) => {
    if (!isAdmin(msg)) return;

    const p = Number(match[1]);
    if (isNaN(p)) return bot.sendMessage(msg.chat.id, "Valor inválido.");

    await storage.updateConfig(cfg => { cfg.priceUsd = p; });
    bot.sendMessage(msg.chat.id, `✅ Preço manual configurado: $${p}`);
  });


  /* ===================== INTERVAL ===================== */

  bot.onText(/\/setinterval\s+(\d+)/, async (msg, match) => {
    if (!isAdmin(msg)) return;

    const m = Number(match[1]);
    if (isNaN(m)) return;

    await storage.updateConfig(cfg => { cfg.intervalMin = m; });
    bot.sendMessage(msg.chat.id, `⏱ Intervalo de drop definido para ${m} minutos.`);
  });


  /* ===================== FORCE DROP ===================== */

  bot.onText(/\/forcedrop(?:\s+(\d+))?/, async (msg, match) => {
    if (!isAdmin(msg)) return;

    const times = Number(match?.[1] || 1);

    for (let i = 0; i < times; i++) {
      await performDrop(bot);
    }

    bot.sendMessage(msg.chat.id, `💥 Executado ${times} drop(s).`);
  });


  /* ===================== WITHDRAW LIST ===================== */

  bot.onText(/\/listwithdraws/, async (msg) => {
    if (!isAdmin(msg)) return;

    const list = await storage.listWithdrawals();

    if (!list.length)
      return bot.sendMessage(msg.chat.id, "Nenhuma solicitação pendente.");

    const lines = list
      .slice(0, 20)
      .map(w =>
        `ID: ${w.id}\nUser: @${w.username ?? w.telegramId}\nAmount: ${w.amount} HBR\nWallet: ${w.wallet}\n---`
      );

    bot.sendMessage(
      msg.chat.id,
      `📥 *Solicitações pendentes*\n\n${lines.join("\n")}`,
      { parse_mode: "Markdown" }
    );
  });


  /* ===================== APPROVE ===================== */

  bot.onText(/\/approve\s+([0-9a-fA-F-]+)/, async (msg, match) => {
    if (!isAdmin(msg)) return;

    const id = match[1];
    const req = await storage.completeWithdrawal(id, msg.from.id);

    if (!req)
      return bot.sendMessage(msg.chat.id, "ID não encontrado.");

    // Atualiza saldo real
    const u = await storage.getUser(req.telegramId);
    await storage.setUser(req.telegramId, {
      balance: Math.max((u.balance || 0) - req.amount, 0)
    });

    bot.sendMessage(msg.chat.id, `💸 Saque pago: ${id}`);

    try {
      await bot.sendMessage(
        req.telegramId,
        `💸 Seu saque de ${req.amount} HBR foi pago!`
      );
    } catch {}

    const GROUP_ID = process.env.GROUP_ID;
    if (GROUP_ID) {
      await bot.sendMessage(
        GROUP_ID,
        `💸 *Saque Pago!*\n👤 @${req.username}\n💰 ${req.amount} HBR\n🏦 \`${req.wallet}\``,
        { parse_mode: "Markdown" }
      );
    }
  });


  /* ===================== REJECT ===================== */

  bot.onText(/\/reject\s+([0-9a-fA-F-]+)\s*(.*)/, async (msg, match) => {
    if (!isAdmin(msg)) return;

    const id = match[1];
    const reason = match[2] || "sem motivo";

    // popWithdrawal NÃO EXISTE NO STORAGE ATUAL — vamos usar delete manual:
    const pending = await storage.listWithdrawals();
    const req = pending.find(r => r.id === id);

    if (!req)
      return bot.sendMessage(msg.chat.id, "ID não encontrado.");

    // deletamos da tabela
    await storage.pool.query(
      `DELETE FROM withdrawals WHERE id=$1`,
      [id]
    );

    try {
      await bot.sendMessage(req.telegramId, `❌ Saque rejeitado. Motivo: ${reason}`);
    } catch {}

    bot.sendMessage(msg.chat.id, `❌ Rejeitado: ${id}`);
  });


  /* ===================== BLOCKED LIST ===================== */

  bot.onText(/\/blocked/, async (msg) => {
    if (!isAdmin(msg)) return;

    const db = await storage.read();

    const lines = Object.entries(db.users)
      .filter(([_, u]) => u.blocked)
      .map(([id, u]) => `@${u.username ?? id} (${id})`);

    bot.sendMessage(
      msg.chat.id,
      lines.length ? `🚫 Bloqueados:\n${lines.join("\n")}` : "Nenhum usuário bloqueado."
    );
  });


  /* ===================== UNBLOCK ===================== */

  bot.onText(/\/unblock\s+(\d+)/, async (msg, match) => {
    if (!isAdmin(msg)) return;

    const id = match[1];
    const u = await storage.unblockUser(id);

    if (!u)
      return bot.sendMessage(msg.chat.id, "Usuário não encontrado.");

    bot.sendMessage(msg.chat.id, `🔓 Desbloqueado @${u.username ?? id}`);
  });


  /* ===================== DAILY LIMIT ===================== */

  bot.onText(/\/setmaxdailyusd\s+([0-9]*\.?[0-9]+)/, async (msg, match) => {
    if (!isAdmin(msg)) return;

    const v = Number(match[1]);
    if (isNaN(v))
      return bot.sendMessage(msg.chat.id, "Valor inválido.");

    await storage.updateConfig(cfg => { cfg.maxDailyRewardUsd = v; });

    bot.sendMessage(msg.chat.id, `⚙️ Limite diário configurado: $${v}`);
  });

}

module.exports = { botAdminHandlers };
