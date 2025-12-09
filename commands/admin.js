// commands/admin.js

const storage = require("../services/storage.js");
const { performDrop } = require("../services/dropper.js");

function isAdmin(msg) {
  return String(msg?.from?.id || "") === String(process.env.ADMIN_ID || "");
}

function botAdminHandlers(bot) {

  /* ==========================================================
     SET PRICE MANUAL
  ========================================================== */
  bot.onText(/\/setprice\s+([0-9]*\.?[0-9]+)/, async (msg, match) => {
    if (!isAdmin(msg)) return;

    const p = Number(match[1]);
    if (isNaN(p))
      return bot.sendMessage(msg.chat.id, "❌ Valor inválido.");

    await storage.updateConfig(cfg => { cfg.priceUsd = p; });

    bot.sendMessage(
      msg.chat.id,
      `💲 *Preço manual configurado!*\nNovo valor: *$${p}*`,
      { parse_mode: "Markdown" }
    );
  });


  /* ==========================================================
     SET INTERVAL
  ========================================================== */
  bot.onText(/\/setinterval\s+(\d+)/, async (msg, match) => {
    if (!isAdmin(msg)) return;

    const m = Number(match[1]);

    if (isNaN(m))
      return bot.sendMessage(msg.chat.id, "❌ Valor inválido.");

    await storage.updateConfig(cfg => { cfg.intervalMin = m; });

    bot.sendMessage(
      msg.chat.id,
      `⏱ *Intervalo atualizado!*\nDrops agora ocorrerão a cada *${m} minutos*.`,
      { parse_mode: "Markdown" }
    );
  });


  /* ==========================================================
     FORCE DROP
  ========================================================== */
  bot.onText(/\/forcedrop(?:\s+(\d+))?/, async (msg, match) => {
    if (!isAdmin(msg)) return;

    const times = Number(match?.[1] || 1);

    bot.sendMessage(msg.chat.id, `⚡ Executando *${times} drop(s)*...`, {
      parse_mode: "Markdown"
    });

    for (let i = 0; i < times; i++) {
      await performDrop(bot);
    }

    bot.sendMessage(
      msg.chat.id,
      `🚀 *Drop(s) concluídos!* (${times})`,
      { parse_mode: "Markdown" }
    );
  });


  /* ==========================================================
     LIST WITHDRAWS
  ========================================================== */
  bot.onText(/\/listwithdraws/, async (msg) => {
    if (!isAdmin(msg)) return;

    const list = await storage.listWithdrawals();

    if (!list.length)
      return bot.sendMessage(
        msg.chat.id,
        "📭 *Nenhuma solicitação pendente*.",
        { parse_mode: "Markdown" }
      );

    const lines = list.slice(0, 20).map(w =>
      `🆔 *ID:* ${w.id}\n` +
      `👤 *User:* @${w.username ?? w.telegramId}\n` +
      `💰 *Valor:* ${w.amount} HBR\n` +
      `💼 *Wallet:* \`${w.wallet}\`\n` +
      `━━━━━━━━━━━━━━━`
    );

    bot.sendMessage(
      msg.chat.id,
      `📥 *Solicitações pendentes*\n\n${lines.join("\n")}`,
      { parse_mode: "Markdown" }
    );
  });


  /* ==========================================================
     APPROVE WITHDRAW
  ========================================================== */
  bot.onText(/\/approve\s+([0-9a-fA-F-]+)/, async (msg, match) => {
    if (!isAdmin(msg)) return;

    const id = match[1];
    const req = await storage.completeWithdrawal(id, msg.from.id);

    if (!req)
      return bot.sendMessage(msg.chat.id, "❌ ID não encontrado.");

    const u = await storage.getUser(req.telegramId);

    await storage.setUser(req.telegramId, {
      balance: Math.max((u.balance || 0) - req.amount, 0)
    });

    bot.sendMessage(
      msg.chat.id,
      `💸 *Saque aprovado e pago!*\nID: \`${id}\``,
      { parse_mode: "Markdown" }
    );

    // avisar o usuário
    try {
      await bot.sendMessage(
        req.telegramId,
        `💸 Seu saque de *${req.amount} HBR* foi pago!`,
        { parse_mode: "Markdown" }
      );
    } catch {}

    // log público
    const GROUP_ID = process.env.GROUP_ID;
    if (GROUP_ID) {
      await bot.sendMessage(
        GROUP_ID,
        `💸 *Saque Pago!*\n` +
        `👤 @${req.username}\n` +
        `💰 ${req.amount} HBR\n` +
        `💼 \`${req.wallet}\``,
        { parse_mode: "Markdown" }
      );
    }
  });


  /* ==========================================================
     REJECT WITHDRAW
  ========================================================== */
  bot.onText(/\/reject\s+([0-9a-fA-F-]+)\s*(.*)/, async (msg, match) => {
    if (!isAdmin(msg)) return;

    const id = match[1];
    const reason = match[2] || "Não especificado";

    const pending = await storage.listWithdrawals();
    const req = pending.find(r => r.id === id);

    if (!req)
      return bot.sendMessage(msg.chat.id, "❌ ID não encontrado.");

    await storage.pool.query(
      `DELETE FROM withdrawals WHERE id=$1`,
      [id]
    );

    try {
      await bot.sendMessage(
        req.telegramId,
        `❌ Seu saque foi rejeitado.\n*Motivo:* ${reason}`,
        { parse_mode: "Markdown" }
      );
    } catch {}

    bot.sendMessage(
      msg.chat.id,
      `❌ *Rejeitado:* ${id}`,
      { parse_mode: "Markdown" }
    );
  });


  /* ==========================================================
     USERS BLOCKED LIST
  ========================================================== */
  bot.onText(/\/blocked/, async (msg) => {
    if (!isAdmin(msg)) return;

    const db = await storage.read();

    const lines = Object.entries(db.users)
      .filter(([_, u]) => u.blocked)
      .map(([id, u]) => `🚫 @${u.username ?? id} (${id})`);

    bot.sendMessage(
      msg.chat.id,
      lines.length
        ? `🚫 *Usuários bloqueados:*\n${lines.join("\n")}`
        : "📗 Nenhum usuário bloqueado.",
      { parse_mode: "Markdown" }
    );
  });


  /* ==========================================================
     UNBLOCK USER
  ========================================================== */
  bot.onText(/\/unblock\s+(\d+)/, async (msg, match) => {
    if (!isAdmin(msg)) return;

    const id = match[1];
    const u = await storage.unblockUser(id);

    if (!u)
      return bot.sendMessage(msg.chat.id, "❌ Usuário não encontrado.");

    bot.sendMessage(
      msg.chat.id,
      `🔓 *Desbloqueado:* @${u.username ?? id}`,
      { parse_mode: "Markdown" }
    );
  });


  /* ==========================================================
     SET DAILY LIMIT
  ========================================================== */
  bot.onText(/\/setmaxdailyusd\s+([0-9]*\.?[0-9]+)/, async (msg, match) => {
    if (!isAdmin(msg)) return;

    const v = Number(match[1]);

    if (isNaN(v))
      return bot.sendMessage(msg.chat.id, "❌ Valor inválido.");

    await storage.updateConfig(cfg => { cfg.maxDailyRewardUsd = v; });

    bot.sendMessage(
      msg.chat.id,
      `⚙️ *Limite diário configurado:* $${v}`,
      { parse_mode: "Markdown" }
    );
  });

}

module.exports = { botAdminHandlers };
