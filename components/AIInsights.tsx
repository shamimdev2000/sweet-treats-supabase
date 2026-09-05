
import React, { useState } from 'react';
import { Product, Sale, Expense } from '../types';
import { getBusinessInsights } from '../services/geminiService';
import { Sparkles, BrainCircuit, RefreshCw, Bot } from 'lucide-react';

interface Props {
  products: Product[];
  sales: Sale[];
  expenses: Expense[];
}

const AIInsights: React.FC<Props> = ({ products, sales, expenses }) => {
  const [insight, setInsight] = useState<string>('');
  const [loading, setLoading] = useState(false);

  const handleGetInsight = async () => {
    setLoading(true);
    const result = await getBusinessInsights(products, sales, expenses);
    setInsight(result || "Could not get insights.");
    setLoading(false);
  };

  return (
    <div className="max-w-4xl mx-auto">
      <div className="bg-[#161d31] border border-slate-800 p-10 rounded-[2.5rem] shadow-2xl relative overflow-hidden mb-10">
        <div className="absolute top-0 right-0 p-8 opacity-10">
           <Bot size={180} className="text-orange-500" />
        </div>
        
        <div className="relative z-10">
          <div className="flex items-center gap-3 mb-6">
            <div className="p-3 bg-orange-500/10 rounded-2xl">
              <Sparkles className="text-orange-500" size={32} />
            </div>
            <h3 className="text-3xl font-bold">AI Business Consultant</h3>
          </div>
          
          <p className="text-slate-400 text-lg mb-8 max-w-xl leading-relaxed">
            Get personalized advice for Sweet Live Bakery. Our AI analyzes your sales and inventory to provide actionable growth recommendations.
          </p>
          
          <button 
            onClick={handleGetInsight}
            disabled={loading}
            className="bg-orange-500 hover:bg-orange-600 text-white px-10 py-4 rounded-2xl font-bold transition-all flex items-center gap-3 shadow-[0_10px_30px_rgba(249,115,22,0.3)] disabled:opacity-50 text-lg active:scale-95"
          >
            {loading ? <RefreshCw className="animate-spin" /> : <BrainCircuit />}
            {loading ? 'Analyzing...' : 'Generate Insights'}
          </button>
        </div>
      </div>

      {insight ? (
        <div className="bg-[#161d31] p-10 rounded-[2.5rem] border border-slate-800 shadow-xl animate-in fade-in slide-in-from-bottom-8 duration-700">
          <div className="prose prose-invert prose-orange max-w-none whitespace-pre-wrap leading-loose text-slate-300 text-lg">
            {insight}
          </div>
        </div>
      ) : (
        !loading && (
          <div className="text-center p-20 text-slate-500 bg-[#161d31]/50 rounded-[2.5rem] border-2 border-dashed border-slate-800">
             <Bot size={48} className="mx-auto mb-4 opacity-20" />
             <p className="text-xl">Click the button above to start your business analysis.</p>
          </div>
        )
      )}
    </div>
  );
};

export default AIInsights;
