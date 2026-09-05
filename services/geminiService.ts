import { Product, Sale, Expense } from "../types";

export const getBusinessInsights = async (
  products: Product[],
  sales: Sale[],
  expenses: Expense[]
) => {
  try {
    const response = await fetch('/api/gemini', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ products, sales, expenses }),
    });

    if (!response.ok) {
      throw new Error('Failed to fetch insights');
    }

    const data = await response.json();
    return data.text;
  } catch (error) {
    console.error("Gemini Insight Error:", error);
    return "Could not generate insights at this time. Please check your data or try again later.";
  }
};