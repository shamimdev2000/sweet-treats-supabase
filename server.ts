import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI } from "@google/genai";

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json());

  // API routes FIRST
  app.post("/api/gemini", async (req, res) => {
    const { products, sales, expenses } = req.body;
    
    if (!process.env.GEMINI_API_KEY) {
      return res.status(500).json({ error: "GEMINI_API_KEY not configured" });
    }

    const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
    
    const totalSales = sales.reduce((acc: any, s: any) => acc + s.totalPrice, 0);
    const totalExpenses = expenses.reduce((acc: any, e: any) => acc + e.amount, 0);
    const profit = totalSales - totalExpenses;
    
    const prompt = `
      As a professional bakery business consultant, analyze the following data for my bakery called "Sweet Treats Corporation".
      
      Data Summary:
      - Total Products: ${products.length}
      - Total Sales Revenue: ৳${totalSales}
      - Total Expenses: ৳${totalExpenses}
      - Net Profit/Loss: ৳${profit}
      
      Products: ${JSON.stringify(products)}
      Recent Sales History: ${JSON.stringify(sales.slice(-10))}
      Recent Expenses: ${JSON.stringify(expenses.slice(-10))}
      
      Please provide:
      1. A summary of current performance.
      2. Top 3 recommendations to increase profit.
      3. Warning if expenses are too high or stock is low.
      4. A prediction for the next month.
      
      Answer in a clear, friendly, and professional tone in English.
    `;

    try {
      const response = await ai.models.generateContent({
        model: 'gemini-1.5-flash',
        contents: prompt,
        config: {
          temperature: 0.7,
        }
      });
      res.json({ text: response.text });
    } catch (error) {
      console.error("Gemini Insight Error:", error);
      res.status(500).json({ error: "Could not generate insights at this time." });
    }
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on port ${PORT}`);
  });
}

startServer();
