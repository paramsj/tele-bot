require('dotenv').config();
const express = require('express');
const TelegramBot = require('node-telegram-bot-api');
const mongoose = require('mongoose');
const Transaction = require('./models/Transactions');

const app = express();

const TOKEN = process.env.BOT_TOKEN;
const MONGODB_URI = process.env.MONGODB_URI;
const PORT = process.env.PORT || 3000;

const bot = new TelegramBot(TOKEN, { polling: true });

mongoose.connect(MONGODB_URI, {
  useNewUrlParser: true,
  useUnifiedTopology: true
}).then(() => {
  console.log("✅ MongoDB connected");
}).catch((err) => {
  console.error("MongoDB connection error:", err);
});

app.get('/', (req, res) => {
  res.send('Telegram Finance Bot is running');
});

app.listen(PORT, () => {
  console.log(`🚀 Express server on http://localhost:${PORT}`);
});

function formatDate(date = new Date()) {
  return date.toISOString().slice(0, 10);
}

// /start
bot.onText(/\/start/, (msg) => {
  const userId = msg.from.id;
  const name = msg.from.first_name || 'there';
  bot.sendMessage(userId, `👋 Hi ${name}! Use /add <amount> [note] to track your spending. Use /summary to view today's summary.`);
});

// /add -50 groceries
bot.onText(/\/add ([-+]?\d+)(?:\s+(.*))?/, async (msg, match) => {
  try {
    const userId = msg.from.id.toString();
    const amount = parseInt(match[1]);
    const note = match[2]?.trim() || '';

    const txn = new Transaction({ userId, amount, note });
    await txn.save();

    bot.sendMessage(userId, `Added ${amount > 0 ? '+' : ''}${amount} (${note || 'no note'})`);
  } catch (err) {
    console.error("Error in /add:", err);
    bot.sendMessage(msg.chat.id, "Failed to save transaction.");
  }
});

// /summary
bot.onText(/\/summary/, async (msg) => {
  try {
    const userId = msg.from.id.toString();
    const today = formatDate();
    const start = new Date(today);
    const end = new Date(start);
    end.setDate(end.getDate() + 1);

    const txns = await Transaction.find({
      userId,
      date: { $gte: start, $lt: end }
    }).sort({ date: 1 });

    if (txns.length === 0) {
      return bot.sendMessage(userId, "No transactions for today.");
    }

    let total = 0;
    let response = `Summary for ${today}\n\n`;

    txns.forEach((txn, i) => {
      total += txn.amount;
      const sign = txn.amount > 0 ? '+' : '';
      response += `${i + 1}. ${sign}${txn.amount} (${txn.note || 'no note'})\n`;
    });

    response += `\n💰 Total: ${total >= 0 ? '+' : ''}${total}`;
    bot.sendMessage(userId, response);
  } catch (err) {
    console.error("Error in /summary:", err);
    bot.sendMessage(msg.chat.id, "Failed to fetch summary.");
  }
});
