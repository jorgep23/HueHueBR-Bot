// commands/admin.js

const storage = require("../services/storage.js");
const { performDrop } = require("../services/dropper.js");

function isAdmin(msg) {
  const adminId = String(process.env.ADMIN_ID || "");
  return msg?.from && String(msg.from.id) === adminId;
}

function botAdminHandlers(bot) {

  /* ===================== PRICE ===================== */

  bot.onText(/\/setprice\s+([0-9]*\.?[0-9]+)/, async (msg, match) => {
    if (!isAdmin(msg)) return;

    const p = Number(match[1]);
    if (isNaN(p)) return bot.sendMessage(msg.chat.id, "Valor inválido.");

    await storage.updateConfig(cfg => { cfg.priceUsd = p; });

    await bot.sendMessage(msg.chat.id, `✅ Preço manual configurado: $${p}`);
  });


  /* ===================== INTERVAL ===================== */

  bot.onText(/\/setinterval\s+(\d+)/, async (msg, match) => {
    if (!isAdmin(msg)) return;

    const m = Number(match[1]);
    if (isNaN(m)) return;

    await storage.updateConfig(cfg => { cfg.intervalMin = m; });
    await bot.sendMessage(msg.chat.id, `⏱ Intervalo configurado para ${m} minutos.`);
  });


  /* ===================== FORCE DROP ===================== */

  bot.onText(/\/forcedrop(?:\s+(\d+))?/, async (msg, match) => {
    if (!isAdmin(msg)) return;

    const times = match?.[1] ? Number(match[1]) : 1;

    for (let i = 0; i < times; i++) {
      await performDrop(bot);
    }

    bot.sendMessage(msg.chat.id, `💥 Executado ${times} drop(s) agora.`);
  });


  /* ===================== WITHDRAW LIST ===================== */

  bot.onText(/\/listwithdraws/, async (msg) => {
    if (!isAdmin(msg)) return;

    const list = await storage.listWithdrawals();

    if (!list.length)
      return bot.sendMessage(msg.chat.id, "Nenhuma solicitação pendente.");

    const lines = list.slice(0, 20).map(w =>
      `ID: ${w.id}\nUser: @${w.username ?? w.telegramId}\nAmount: ${w.amount} HBR\nWallet: ${w.wallet}\n---`
    );

    bot.sendMessage(msg.chat.id, "📥 *Solicitações de saque*\n\n" + lines.join("\n"), {
      parse_mode: "Markdown"
    });
  });


  /* ===================== APPROVE ===================== */

  bot.onText(/\/approve\s+([0-9a-fA-F-]+)/, async (msg, match) => {
    if (!isAdmin(msg)) return;

    const id = match[1];

    let req = await storage.completeWithdrawal(id, msg.from.id);

    if (!req)
      return bot.sendMessage(msg.chat.id, "ID não encontrado.");

    // Deduz saldo REAL do usuário
    const u = await storage.getUser(req.telegramId);
    await storage.setUser(req.telegramId, {
      balance: Math.max((u.balance || 0) - req.amount, 0)
    });

    bot.sendMessage(msg.chat.id, `✅ Marca como pago: ${id}`);

    try {
      await bot.sendMessage(req.telegramId, `💸 Seu saque de ${req.amount} HBR foi pago!`);
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

    // FIX: storage tem rejectWithdrawal? não → implementado como "delete request"
    const pending = await storage.popWithdrawal(id);

    if (!pending)
      return bot.sendMessage(msg.chat.id, "ID não encontrado.");

    try {
      await bot.sendMessage(pending.telegramId, `❌ Saque rejeitado. Motivo: ${reason}`);
    } catch {}

    bot.sendMessage(msg.chat.id, `❌ Rejeitado: ${id}`);
  });


  /* ===================== BLOCK, UNBLOCK ===================== */

  bot.onText(/\/blocked/, async (msg) => {
    if (!isAdmin(msg)) return;

    const db = await storage.read();
    const blocked = Object.entries(db.users)
      .filter(([_, u]) => u.blocked)
      .map(([id, u]) => `@${u.username ?? id} (${id})`);

    bot.sendMessage(
      msg.chat.id,
      blocked.length ? "🚫 Bloqueados:\n" + blocked.join("\n") : "Nenhum bloqueado."
    );
  });

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

    bot.sendMessage(msg.chat.id, `⚙️ Limite diário setado: $${v}`);
  });

}

module.exports = { botAdminHandlers };
    const db = await storage.read();
    const logs = (db.logsAdmin || [])
      .slice(0, 50)
      .map(l => `${l.ts} ${l.type} ${l.id || ''} ${l.telegramId || ''}`);

    bot.sendMessage(msg.chat.id, 'Admin logs:\n' + logs.join('\n'));
  });

  // /blocked
  bot.onText(/\/blocked/, async (msg) => {
    if (!isAdmin(msg)) return;

    const db = await storage.read();
    const blocked = Object.entries(db.users)
      .filter(([id, u]) => u.blocked)
      .map(([id, u]) => `@${u.username ?? id} (${id})`);

    if (!blocked.length) return bot.sendMessage(msg.chat.id, 'Nenhum usuário bloqueado.');

    bot.sendMessage(msg.chat.id, 'Usuários bloqueados:\n' + blocked.join('\n'));
  });

  // /unblock <id>
  bot.onText(/\/unblock\s+(\d+)/, async (msg, match) => {
    if (!isAdmin(msg)) return;

    const id = match[1];
    const user = await storage.unblockUser(id);

    if (user) {
      await bot.sendMessage(msg.chat.id, `✅ Usuário @${user.username ?? id} desbloqueado.`);
    } else {
      bot.sendMessage(msg.chat.id, 'Usuário não encontrado.');
    }
  });

  // /resetday <id>
  bot.onText(/\/resetday\s+(\d+)/, async (msg, match) => {
    if (!isAdmin(msg)) return;

    const id = match[1];
    const user = await storage.getUser(id);

    if (!user) return bot.sendMessage(msg.chat.id, 'Usuário não encontrado.');

    user.totalToday = 0;

    await storage.setUser(id, user);
    await storage.addAdminLog({
      type: 'admin_resetday',
      telegramId: id,
      by: msg.from.id,
      ts: new Date().toISOString()
    });

    bot.sendMessage(msg.chat.id, `🔁 Recompensa diária de @${user.username ?? id} resetada.`);
  });

  // /setmaxdailyusd <valor>
  bot.onText(/\/setmaxdailyusd\s+([0-9]*\.?[0-9]+)/, async (msg, match) => {
    if (!isAdmin(msg)) return;

    const v = parseFloat(match[1]);
    if (isNaN(v)) return bot.sendMessage(msg.chat.id, 'Valor inválido.');

    await storage.updateConfig(cfg => { cfg.maxDailyRewardUsd = v; });
    bot.sendMessage(msg.chat.id, `✅ Limite diário global atualizado para $${v.toFixed(2)}.`);
  });

}

module.exports = { botAdminHandlers };
