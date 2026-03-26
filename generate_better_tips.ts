import { GoogleGenAI } from "@google/genai";
import * as fs from 'fs';

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY! });

async function generateTips() {
  const response = await ai.models.generateContent({
    model: "gemini-3-flash-preview",
    contents: "Buatkan 365 tips keuangan harian yang unik, inspiratif, dan praktis dalam bahasa Indonesia. Berikan dalam format array string JSON. Pastikan setiap tips berbeda dan mencakup berbagai aspek seperti menabung, investasi, gaya hidup hemat, pengelolaan hutang, dan perencanaan masa depan.",
  });

  const text = response.text || "[]";
  const tips = JSON.parse(text.substring(text.indexOf('['), text.lastIndexOf(']') + 1));
  
  const content = `export const FINANCIAL_TIPS = ${JSON.stringify(tips, null, 2)};`;
  fs.writeFileSync('src/constants/tips.ts', content);
  console.log('Tips generated successfully!');
}

generateTips();
