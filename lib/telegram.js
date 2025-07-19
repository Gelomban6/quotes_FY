import dotenv from "dotenv";
dotenv.config();

const BOT_TOKEN = process.env.BOT_TOKEN;
const CHAT_IDS = process.env.CHAT_IDS?.split(",") || [];

export async function sendKutipan(message, index = 0) {
      let success = 0;
      let failed = 0;
      let rateLimited = 0;

      for (const chatId of CHAT_IDS) {
            try {
                  const respon = await fetch(
                        `https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`,
                        {
                              method: "POST",
                              headers: { "Content-Type": "application/json" },
                              body: JSON.stringify({
                                    chat_id: chatId,
                                    text: message,
                                    parse_mode: "HTML",
                              }),
                        }
                  );
                  if (respon.status === 200) {
                        success++;
                        console.log(`${index}: takirim ka ${chatId}`);
                  } else {
                        const errorData = await respon.json();
                        failed++;
                        if (respon.status === 429) {
                              rateLimited++;
                              console.warn(
                                    `${index}: So talebe da kirim ka ${chatId}`
                              );
                        } else {
                              console.error(
                                    `${index}:${errorData.description}`
                              );
                        }
                  }
            } catch (error) {
                  failed++;
                  console.error(`${index}: Network error >`, error.message);
            }
      }

      return { success, failed, rateLimited };
}
