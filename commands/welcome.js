const bot = require("node-telegram-bot-api").default;

bot.on("new_chat_members", (msg) => {
  msg.new_chat_members.forEach(member => {
    bot.sendMessage(
      msg.chat.id,
      `👋 Bem-vindo, ${member.first_name}!\nUse /registrar SUA_CARTEIRA para participar dos drops!`
    );
  });
});
