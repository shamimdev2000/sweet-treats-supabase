
import React, { useState } from 'react';
import { Product, Sale, Expense } from '../types';
import { getBusinessInsights } from '../services/geminiService';
import { Sparkles, BrainCircuit, RefreshCw, X, Bot, MessageSquareText, TrendingUp, AlertCircle } from 'lucide-react';

interface Props {
  products: Product[];
  sales: Sale[];
  expenses: Expense[];
}

const FloatingAI: React.FC<Props> = ({ products, sales, expenses }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [insight, setInsight] = useState<string>('');
  const [loading, setLoading] = useState(false);

  const handleGetInsight = async () => {
    setLoading(true);
    try {
      const result = await getBusinessInsights(products, sales, expenses);
      setInsight(result || "Could not get insights.");
    } catch (err) {
      setInsight("Sorry, unable to fetch insights at this moment.");
    }
    setLoading(false);
  };

  return (
    <>
      {/* Floating Glossy Button */}
      <button 
        onClick={() => {
          setIsOpen(true);
          if (!insight) handleGetInsight();
        }}
        className="fixed bottom-8 right-8 z-[100] group flex items-center justify-center transition-all active:scale-90"
        aria-label="Ask AI Assistant"
      >
        <div className="absolute inset-0 bg-cyan-400 rounded-full blur-xl opacity-20 group-hover:opacity-40 animate-pulse transition-opacity"></div>
        <div className="relative h-14 w-40 sm:w-48 bg-gradient-to-b from-cyan-400 via-cyan-500 to-cyan-600 rounded-full p-[2px] shadow-[0_10px_25px_-5px_rgba(6,182,212,0.5)] overflow-hidden">
          {/* Glossy Overlay */}
          <div className="absolute top-0 left-0 w-full h-1/2 bg-white/20 rounded-full -translate-y-1/2 scale-x-90"></div>
          
          <div className="h-full w-full bg-transparent rounded-full flex items-center justify-center gap-3 px-6 border border-white/30">
            <Sparkles className="text-white animate-bounce" size={20} />
            <span className="text-white font-black text-sm tracking-widest drop-shadow-sm uppercase">AI Advisor</span>
          </div>
        </div>
      </button>

      {/* AI Assistant Panel */}
      {isOpen && (
        <div className="fixed inset-0 z-[110] flex items-center justify-center p-4 sm:p-6 bg-slate-900/60 backdrop-blur-md animate-in fade-in duration-300">
          <div className="bg-white dark:bg-[#161d31] w-full max-w-2xl h-[80vh] rounded-[2.5rem] border border-slate-200 dark:border-slate-800 shadow-2xl flex flex-col overflow-hidden animate-in zoom-in duration-300">
            
            {/* Header */}
            <div className="bg-gradient-to-r from-cyan-600 to-[#0F4359] p-6 sm:p-8 flex justify-between items-center text-white">
              <div className="flex items-center gap-4">
                <div className="p-3 bg-white/10 rounded-2xl backdrop-blur-sm border border-white/10">
                  <Bot size={28} />
                </div>
                <div>
                  <h3 className="text-xl font-black tracking-tight">Gemini AI Assistant</h3>
                  <p className="text-cyan-100/70 text-[10px] font-bold uppercase tracking-widest">Business Intelligence Pro</p>
                </div>
              </div>
              <button 
                onClick={() => setIsOpen(false)}
                className="p-2 hover:bg-white/10 rounded-xl transition-colors"
              >
                <X size={24} />
              </button>
            </div>

            {/* Content Area */}
            <div className="flex-1 overflow-y-auto p-6 sm:p-10 custom-scrollbar bg-slate-50/50 dark:bg-transparent">
              {loading ? (
                <div className="h-full flex flex-col items-center justify-center text-slate-500">
                  <div className="w-16 h-16 border-4 border-cyan-500/20 border-t-cyan-500 rounded-full animate-spin mb-6"></div>
                  <p className="font-black text-xs uppercase tracking-[0.2em] animate-pulse">Analyzing Bakery Metrics...</p>
                  <p className="text-[10px] mt-2 opacity-60">Gemini is analyzing your business data</p>
                </div>
              ) : (
                <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
                  <div className="flex items-center gap-3 mb-8">
                    <div className="h-[2px] flex-1 bg-slate-200 dark:bg-slate-800"></div>
                    <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Analysis Results</span>
                    <div className="h-[2px] flex-1 bg-slate-200 dark:bg-slate-800"></div>
                  </div>
                  
                  <div className="prose prose-slate dark:prose-invert max-w-none">
                    <div className="whitespace-pre-wrap leading-relaxed text-slate-700 dark:text-slate-300 text-base sm:text-lg">
                      {insight}
                    </div>
                  </div>

                  {/* Summary Quick Stats in AI Panel */}
                  <div className="grid grid-cols-2 gap-4 mt-12">
                     <div className="p-4 bg-emerald-500/5 rounded-2xl border border-emerald-500/10">
                        <TrendingUp className="text-emerald-500 mb-2" size={18} />
                        <p className="text-[9px] font-black text-slate-400 uppercase">Growth Potential</p>
                        <p className="text-xs font-bold text-slate-600 dark:text-slate-300">High: Optimized Stock</p>
                     </div>
                     <div className="p-4 bg-orange-500/5 rounded-2xl border border-orange-500/10">
                        <AlertCircle className="text-orange-500 mb-2" size={18} />
                        <p className="text-[9px] font-black text-slate-400 uppercase">Risk Level</p>
                        <p className="text-xs font-bold text-slate-600 dark:text-slate-300">Low: Minimal Wastage</p>
                     </div>
                  </div>
                </div>
              )}
            </div>

            {/* Footer / Action */}
            <div className="p-6 bg-slate-50 dark:bg-[#070d19] border-t border-slate-200 dark:border-[#162744]">
              <button 
                onClick={handleGetInsight}
                disabled={loading}
                className="w-full smart-cyan-pill py-4 text-xs uppercase tracking-widest flex items-center justify-center gap-3 disabled:opacity-50 cursor-pointer"
              >
                {loading ? <RefreshCw className="animate-spin" size={18} /> : <BrainCircuit size={18} />}
                Refresh Analysis
              </button>
              <p className="text-[9px] text-center text-slate-400 mt-4 font-bold uppercase">Powered by Gemini AI - Sweet Live Bakery Solutions</p>
            </div>

          </div>
        </div>
      )}
    </>
  );
};

export default FloatingAI;
