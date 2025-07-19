import TelegramBot from "node-telegram-bot-api";
import dotenv from "dotenv";
import cron from "node-cron";
import { getKutipanAcak } from "./lib/quote.js";
import Setting from "./models/Setting.js";

dotenv.config();

const jobs = new Map();
const bot = new TelegramBot(process.env.BOT_TOKEN, { polling: true });

bot.onText(/\/start/, (msg) => {
      const chatId = msg.chat.id;
      const welcomeText = `
      Hallo, selamat datang !
      kirim /kutipan untuk mendapatkan kutipan acak
      /bantuan untuk melihat bantuan yang ada
      `;
      bot.sendMessage(chatId, welcomeText);
});

bot.onText(/\/kutipan/, async (msg) => {
      const chatId = msg.chat.id;
      try {
            const data = await getKutipanAcak();

            if (!data?.text || data.text.trim() === "") {
                  console.warn("Kutipan kosong diterima:", data);
                  return bot.sendMessage(
                        chatId,
                        "Maaf tidak ada kutipan tersedia."
                  );
            }
            await bot.sendMessage(chatId, data.text, { parse_mode: "HTML" });
      } catch (error) {
            console.error("Gagal mengirim kutipan:", error);
            await bot.sendMessage(
                  chatId,
                  "Terjadi kesalahan saat mengambil kutipan"
            );
      }
});

//buat jadwal
bot.onText(/\/jadwal\s*(.*)/, async (msg, match) => {
      const chatId = msg.chat.id;
      const timeInput = match[1].trim();

      if (!timeInput) {
            return bot.sendMessage(
                  chatId,
                  "Silahkan masukan waktu dalam format 24 jam. \nContoh: /jadwal 08:00"
            );
      }

      if (!/^\d{2}:\d{2}$/.test(timeInput)) {
            return bot.sendMessage(
                  chatId,
                  "Format salah. Gunakan format 24 jam. \nContoh : /jadwal 08:00"
            );
      }

      const [hour, minute] = timeInput.split(":").map(Number);
      if (hour > 23 || minute > 59) {
            return bot.sendMessage(
                  chatId,
                  "Jam tidak valid. Gunakan format seperti: 14;00 atau 07:45"
            );
      }

      const cronExp = `${minute} ${hour} * * *`; //setiap hari jam tersebut

      //hentikan jadwal lama bila ada
      if (jobs.has(chatId)) {
            jobs.get(chatId).stop();
      }

      //Simpan jadwal ke DB
      await Setting.updateOne(
            { key: `schedule_${chatId}` },
            { value: timeInput },
            { upsert: true }
      );

      //Buat job baru
      const job = cron.schedule(cronExp, async () => {
            const data = await getKutipanAcak();
            if (data?.text) {
                  await bot.sendMessage(chatId, data.text, {
                        parse_mode: "HTML",
                  });
            }
      });

      jobs.set(chatId, job);
      bot.sendMessage(
            chatId,
            `Jadwal kutipan harian disetel ke jam ${timeInput}`
      );
});

//lihat jadwal
bot.onText(/\/lihatjadwal/, async (msg) => {
      const chatId = msg.chat.id;
      const setting = await Setting.findOne({ key: `schedule_${chatId}` });

      if (!setting) {
            return bot.sendMessage(
                  chatId,
                  "Kamu belum mengatur jadwal kutipan otomatis"
            );
      }

      bot.sendMessage(chatId, `Jadwal kamu saat ini: ${setting.value}`);
});

bot.onText(/\/hapusjadwal/, async (msg) => {
      const chatId = msg.chat.id;

      await Setting.deleteOne({ key: `schedule_${chatId}` });

      if (jobs.has(chatId)) {
            jobs.get(chatId).stop();
            jobs.delete(chatId);
      }
      bot.sendMessage(chatId, "Jadwal kutipan otomatis telah dihapus");
});

async function restoreAllSchedules() {
      const settings = await Setting.find({ key: /^schedule_/ });

      for (const setting of settings) {
            const chatId = setting.key.replace("schedule_", "");
            const waktu = setting.value;

            if (!/^\d{2}:\d{2}$/.test(waktu)) continue;

            const [hour, minute] = waktu.split(":").map(Number);
            const cronExp = `${minute} ${hour} * * *`;

            const job = cron.schedule(cronExp, async () => {
                  try {
                        const data = await getKutipanAcak();
                        if (data?.text) {
                              await bot.sendMessage(chatId, data.text, {
                                    parse_mode: "HTML",
                              });
                        }
                  } catch (e) {
                        console.error(
                              `Gagal kirim otomatis ke ${chatId}:`,
                              e.message
                        );
                  }
            });

            jobs.set(chatId, job);
            job.start();
            console.log(`Jadwal dipulihkan untuk ${chatId} @ ${waktu}`);
      }
}

bot.onText(/\/bantuan/, (msg) => {
      const helpMessage = `
<b>📚 Daftar Perintah:</b>

/kutipan - Kirim kutipan acak
/jadwal HH:MM - Jadwalkan pengiriman kutipan harian (format 24 jam)
/lihatjadwal - Lihat waktu jadwal pengiriman kutipan saat ini
/hapusjadwal - Hapus jadwal pengiriman otomatis
/bantuan - Tampilkan daftar perintah ini

Contoh penggunaan:
<code>/jadwal 08:00</code> ➜ Bot akan mengirim kutipan tiap hari pukul 08:00
  `;
      bot.sendMessage(msg.chat.id, helpMessage, { parse_mode: "HTML" });
});

restoreAllSchedules()
      .then(() => {
            console.log("Semua jadwal berhasil dipulihkan dari database");
      })
      .catch((error) => {
            console.error("Gagal memulihkan jadwal:", error);
      });
