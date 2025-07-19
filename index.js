import { getKutipanAcak } from "./lib/quote.js";
import { sendKutipan } from "./lib/telegram.js";

const MAX_MESSAGE_PER_SECOND = 1;
const TEST_DURATION_SECONDS = 60;

function delay(ms) {
      return new Promise((resolve) => setTimeout(resolve, ms));
}

async function runTest() {
      let takirim = 0;
      let success = 0;
      let failed = 0;
      let rateLimited = 0;
      let lastQuoteId = null;
      console.log("🚀 Starting Telegram quote sender...");

      const startTime = Date.now();
      let index = 1;

      while ((Date.now() - startTime) / 1000 < TEST_DURATION_SECONDS) {
            const batch = [];

            for (let i = 0; i < MAX_MESSAGE_PER_SECOND; i++) {
                  batch.push(
                        (async () => {
                              let quote;
                              let tries = 0;
                              do {
                                    quote = await getKutipanAcak();
                                    tries++;
                              } while (quote?.id === lastQuoteId && tries < 5);
                              lastQuoteId = quote?.aid;

                              const result = await sendKutipan(quote, index++);
                              takirim++;
                              success += result.success;
                              failed += result.failed;
                              rateLimited += result.rateLimited;
                        })()
                  );
            }
            await Promise.all(batch);
            await delay(1000);
      }

      console.log("\n Test Complete:");
      console.log(`Total Sent               : ${takirim}`);
      console.log(`Berhasil                  : ${success}`);
      console.log(`Gagal                     : ${failed}`);
      console.log(`Kena Limit             : ${rateLimited}`);
}

runTest();
