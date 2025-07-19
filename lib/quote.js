import dotenv from "dotenv";
import fetch from "node-fetch";
import Quote from "../models/Quotes.js";
import mongoose from "mongoose";

dotenv.config();

const MONGO_URI = process.env.MONGODB_URI;

if (!mongoose.connection.readyState) {
      mongoose.connect(MONGO_URI, {});
}

export async function getKutipanAcak() {
      try {
            const respon = await fetch("https://favqs.com/api/qotd");
            const data = await respon.json();
            if (data.quote && data.quote.body && data.quote.author) {
                  const kutipanBersih = data.quote.body.replace(
                        /<br\s*\/?>/gi,
                        "\n"
                  );
                  const kutipan = `"${kutipanBersih}" - ${data.quote.author}`;

                  //simpan ke database jika belum ada
                  await Quote.updateOne(
                        { text: kutipan },
                        { $setOnInsert: { text: kutipan } },
                        { upsert: true }
                  );

                  return kutipan;
            } else {
                  throw new Error("Format API tidak valid");
            }
      } catch (err) {
            console.warn("Gagal fetch dari API:", err.message);
            try {
                  const count = await Quote.countDocuments();
                  if (count === 0) throw new Error("Database Kosong");

                  const acak = Math.floor(Math.random() * count);
                  const kutipanAcak = await Quote.findOne().skip(acak).exec();

                  return kutipanAcak.text + " (^-^)";
            } catch (dbErr) {
                  console.error("Gagal ambil dari Database:", dbErr.message);
                  return `Error: ${err.message} - tetap semangat!`;
            }
      }
}
