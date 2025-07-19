import dotenv from "dotenv";
import fetch from "node-fetch";
import Quote from "../models/Quotes.js";
import mongoose from "mongoose";
import sanitizeHtml from "sanitize-html";
import Setting from "../models/Setting.js";

dotenv.config();

const MONGO_URI = process.env.MONGODB_URI;
let dbInitPromise = null;

if (!mongoose.connection.readyState && !dbInitPromise) {
      dbInitPromise = mongoose.connect(MONGO_URI, {});
}

export async function getKutipanAcak() {
      try {
            if (dbInitPromise) await dbInitPromise;

            const respon = await fetch("https://favqs.com/api/qotd");
            const data = await respon.json();
            if (data.quote && data.quote.body && data.quote.author) {
                  const rawBody = data.quote.body;
                  const rawAuthor = data.quote.author;

                  const body = sanitizeHtml(rawBody, {
                        allowedTags: [],
                        allowedAttributes: {},
                  });
                  const author = sanitizeHtml(rawAuthor, {
                        allowedTags: [],
                        allowedAttributes: {},
                  });

                  const kutipan = `"${body}" - ${author}`;

                  if (kutipan.length > 4096) {
                        return kutipan.slice(0, 4090) + ". . .";
                  }

                  //simpan ke database jika belum ada
                  await Quote.updateOne(
                        { text: kutipan },
                        {
                              $setOnInsert: {
                                    text: kutipan,
                                    source: "favqs",
                                    createdAt: new Date(),
                              },
                        },
                        { upsert: true }
                  );

                  const saved = await Quote.findOne({ text: kutipan }).select(
                        "_id"
                  );
                  if (saved) {
                        await Setting.updateOne(
                              { key: "lastQuoteId" },
                              { value: saved._id },
                              { upsert: true }
                        );
                  }

                  return { id: saved._id.toString(), text: kutipan };
            } else {
                  throw new Error("Format API tidak valid");
            }
      } catch (err) {
            console.warn("Gagal fetch dari API:", err.message);
            try {
                  const count = await Quote.countDocuments();
                  if (count === 0) throw new Error("Database Kosong");

                  //Ambil last used quote ID
                  const lastSetting = await Setting.findOne({
                        key: "lastQuoteId",
                  });
                  let lastId = lastSetting?.value?.toString();

                  let kutipanAcak = null;
                  let attempts = 0;
                  const maxAttempts = 5;

                  while (attempts < maxAttempts) {
                        const acak = Math.floor(Math.random() * count);
                        const kandidat = await Quote.findOne()
                              .skip(acak)
                              .exec();

                        if (!kandidat || kandidat._id.toString() === lastId) {
                              attempts++;
                              continue;
                        }

                        kutipanAcak = kandidat;
                        break;
                  }
                  if (!kutipanAcak)
                        throw new Error("tidak menemukan kutipan baru.");

                  await Setting.updateOne(
                        { key: "lastQuoteId" },
                        { value: kutipanAcak._id },
                        { upsert: true }
                  );

                  return {
                        id: kutipanAcak._id.toString(),
                        text: kutipanAcak.text + " (^-^)",
                  };
            } catch (dbErr) {
                  console.error("Gagal ambil dari Database:", dbErr.message);
                  return {
                        id: "error",
                        text: `Error: ${err.message} - tetap semangat!`,
                  };
            }
      }
}
