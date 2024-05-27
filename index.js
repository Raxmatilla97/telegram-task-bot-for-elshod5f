
const express = require('express');
const TelegramBot = require('node-telegram-bot-api');
const mongoose = require('mongoose');

const app = express();
const port = process.env.PORT || 3000;

// Telegram bot tokenini kiriting
const token = '6905575163:AAEC0Ej9UL7F_U_hizhJP9caI29a2DSohpw';
const bot = new TelegramBot(token, { polling: true });

// Mongoose yordamida MongoDB bilan ulanish
mongoose.connect('mongodb://localhost:27017/telegram-bot');

const db = mongoose.connection;
db.on('error', console.error.bind(console, 'MongoDB connection error:'));
db.once('open', function() {
    console.log('Connected to MongoDB');
});

// Vazifalar modeli
const taskSchema = new mongoose.Schema({
    userId: String,
    title: String,
    description: String,
    deadline: Date,
    priority: String,
    completed: { type: Boolean, default: false },
    category: String
});

const Task = mongoose.model('Task', taskSchema);

app.get('/', (req, res) => {
    res.send('Telegram Bot is running');
});

app.listen(port, () => {
    console.log(`Server is running on port ${port}`);
});

// Bot komandalarini sozlash
bot.onText(/\/start/, (msg) => {
    bot.sendMessage(msg.chat.id, 'Welcome! Use /newtask to create a new task.');
});

bot.onText(/\/newtask/, (msg) => {
    const chatId = msg.chat.id;

    bot.sendMessage(chatId, 'Please enter the task title:');

    bot.once('message', (msg) => {
        const title = msg.text;
        bot.sendMessage(chatId, 'Enter the task description:');

        bot.once('message', (msg) => {
            const description = msg.text;
            bot.sendMessage(chatId, 'Enter the deadline (YYYY-MM-DD):');

            bot.once('message', (msg) => {
                const deadline = msg.text;
                bot.sendMessage(chatId, 'Enter the priority (High, Medium, Low):');

                bot.once('message', (msg) => {
                    const priority = msg.text;

                    const task = new Task({
                        userId: chatId,
                        title: title,
                        description: description,
                        deadline: new Date(deadline),
                        priority: priority,
                        category: 'General'
                    });

                    task.save((err) => {
                        if (err) {
                            bot.sendMessage(chatId, 'Failed to save task');
                        } else {
                            bot.sendMessage(chatId, 'Task saved successfully!');
                        }
                    });
                });
            });
        });
    });
});

bot.onText(/\/tasks/, (msg) => {
    const chatId = msg.chat.id;

    Task.find({ userId: chatId, completed: false }, (err, tasks) => {
        if (err) {
            bot.sendMessage(chatId, 'Failed to retrieve tasks');
        } else {
            let response = 'Your tasks:\n\n';
            tasks.forEach((task, index) => {
                response += `${index + 1}. ${task.title} - ${task.description} (Deadline: ${task.deadline.toDateString()}, Priority: ${task.priority})\n`;
            });
            bot.sendMessage(chatId, response);
        }
    });
});

bot.onText(/\/complete (.+)/, (msg, match) => {
    const chatId = msg.chat.id;
    const taskId = match[1];

    Task.findByIdAndUpdate(taskId, { completed: true }, (err, task) => {
        if (err || !task) {
            bot.sendMessage(chatId, 'Failed to mark task as completed');
        } else {
            bot.sendMessage(chatId, `Task "${task.title}" marked as completed`);
        }
    });
});

bot.onText(/\/delete (.+)/, (msg, match) => {
    const chatId = msg.chat.id;
    const taskId = match[1];

    Task.findByIdAndDelete(taskId, (err) => {
        if (err) {
            bot.sendMessage(chatId, 'Failed to delete task');
        } else {
            bot.sendMessage(chatId, 'Task deleted successfully');
        }
    });
});

// Eslatma funksiyasi
const checkDeadlines = () => {
    const now = new Date();
    Task.find({ deadline: { $lte: now }, completed: false }, (err, tasks) => {
        if (!err) {
            tasks.forEach(task => {
                bot.sendMessage(task.userId, `Reminder: Task "${task.title}" is due!`);
            });
        }
    });
};

setInterval(checkDeadlines, 60 * 60 * 1000); // Har soatda tekshiriladi
