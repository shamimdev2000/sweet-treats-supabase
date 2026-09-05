
import React, { useState, useMemo } from 'react';
import { Expense, DailyClosing } from '../types';
import { generateId } from '../services/idGenerator';
import { Receipt } from 'lucide-react';

interface Props {
  expenses: Expense[];
  onAdd: (expense: Expense) => void;
  closings?: DailyClosing[];
}

const ExpensesView: React.FC<Props> = ({ expenses, onAdd, closings = [] }) => {
  const [formData, setFormData] = useState({
    description: '',
    amount: '' as number | '',
    category: 'Raw Material' as Expense['category'],
    date: new Date().toISOString().split('T')[0]
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    // Ensure the expense date includes current time if it's today's entry
    // to correctly work with the daily closing timestamp.
    const now = new Date();
    const selectedDate = new Date(formData.date || '');
    
    let finalDateString = selectedDate.toISOString();
    if (selectedDate.toDateString() === now.toDateString()) {
      finalDateString = now.toISOString();
    }

    onAdd({
      ...formData,
      amount: Number(formData.amount) || 0,
      id: generateId('exp'),
      date: finalDateString
    } as Expense);

    setFormData({
      description: '',
      amount: '',
      category: 'Raw Material',
      date: new Date().toISOString().split('T')[0]
    });
  };

  const lastClosingTimestamp = useMemo(() => {
    if (closings.length === 0) return 0;
    return Math.max(...closings.map(c => new Date(c.timestamp).getTime()));
  }, [closings]);

  const activeExpenses = useMemo(() => {
    return [...expenses]
      .filter(e => new Date(e.date).getTime() > lastClosingTimestamp)
      .reverse()
      .slice(0, 10);
  }, [expenses, lastClosingTimestamp]);

  const categorySummary = useMemo(() => {
    const summary = new Map<string, number>();
    expenses.filter(e => new Date(e.date).getTime() > lastClosingTimestamp).forEach(e => {
      const current = summary.get(e.category) || 0;
      summary.set(e.category, current + e.amount);
    });
    return Array.from(summary.entries()).sort((a, b) => b[1] - a[1]);
  }, [expenses, lastClosingTimestamp]);

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        <div className="lg:col-span-4 space-y-6">
          <div className="bg-white dark:bg-[#070e1b] p-8 rounded-3xl shadow-sm border border-slate-200 dark:border-[#162744]">
            <div className="flex items-center gap-3 mb-6">
              <div className="w-10 h-10 bg-[#0a1527] border border-[#00d2ff]/30 rounded-xl flex items-center justify-center text-[#00e5ff] shadow-[0_0_15px_rgba(0,210,255,0.2)]">
                <Receipt size={20} />
              </div>
              <div>
                <h3 className="text-lg font-black text-slate-900 dark:text-white">Record Expense</h3>
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Daily Expenses Entry</p>
              </div>
            </div>
            <form onSubmit={handleSubmit} className="space-y-5">
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-400 uppercase block px-1">Description</label>
                <input required type="text" className="w-full p-3.5 rounded-xl bg-slate-50 dark:bg-[#0a1527] border border-slate-200 dark:border-[#162744] text-slate-900 dark:text-white outline-none focus:border-[#00e5ff] text-sm" value={formData.description} onChange={e => setFormData({...formData, description: e.target.value})} placeholder="Expense description..." />
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-400 uppercase block px-1">Amount (৳)</label>
                <input required type="number" className="w-full p-3.5 rounded-xl bg-slate-50 dark:bg-[#0a1527] border border-slate-200 dark:border-[#162744] text-slate-900 dark:text-white outline-none focus:border-[#00e5ff] text-sm font-bold" value={formData.amount} onChange={e => setFormData({...formData, amount: e.target.value === '' ? '' : Number(e.target.value)})} placeholder="0.00" />
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-400 uppercase block px-1">Category</label>
                <select className="w-full p-3.5 rounded-xl bg-slate-50 dark:bg-[#0a1527] border border-slate-200 dark:border-[#162744] text-slate-900 dark:text-white outline-none focus:border-[#00e5ff] text-sm" value={formData.category} onChange={e => setFormData({...formData, category: e.target.value as any})}>
                  <option value="Raw Material">Raw Material</option>
                  <option value="Utilities">Utilities</option>
                  <option value="Rent">Rent</option>
                  <option value="Staff">Staff</option>
                  <option value="Salary">Salary</option>
                  <option value="Other">Other</option>
                </select>
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-400 uppercase block px-1">Date</label>
                <input required type="date" className="w-full p-3.5 rounded-xl bg-slate-50 dark:bg-[#0a1527] border border-slate-200 dark:border-[#162744] text-slate-900 dark:text-white outline-none focus:border-[#00e5ff] text-sm" value={formData.date} onChange={e => setFormData({...formData, date: e.target.value})} />
              </div>
              <button type="submit" className="w-full smart-cyan-pill py-3.5 text-xs font-black uppercase tracking-wider mt-4 cursor-pointer">
                Record Expense
              </button>
            </form>
          </div>

          {categorySummary.length > 0 && (
            <div className="bg-white dark:bg-[#070e1b] p-7 rounded-3xl shadow-sm border border-slate-200 dark:border-[#162744]">
              <h3 className="text-sm font-black mb-5 text-slate-900 dark:text-[#00e5ff] uppercase tracking-wider">Category Summary</h3>
              <div className="space-y-3">
                {categorySummary.map(([cat, total]) => (
                  <div key={cat} className="flex justify-between items-center p-3 bg-slate-50 dark:bg-[#0a1527] rounded-xl border border-slate-100 dark:border-[#162744]">
                    <span className="text-xs font-bold text-slate-500 dark:text-slate-400">{cat}</span>
                    <span className="text-sm font-black text-rose-400">৳{total.toLocaleString()}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        <div className="lg:col-span-8">
          <div className="bg-white dark:bg-[#070e1b] rounded-3xl shadow-sm border border-slate-200 dark:border-[#162744] overflow-hidden">
            <div className="px-8 py-6 border-b border-slate-100 dark:border-[#162744] flex justify-between items-center">
              <h3 className="text-lg font-bold text-slate-900 dark:text-white">Expense History (Active Session)</h3>
              <span className="text-[10px] text-[#00e5ff] font-bold uppercase tracking-widest px-3 py-1 bg-[#0a1527] rounded-full border border-[#00d2ff]/30">Since last closing</span>
            </div>
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full text-left">
                <thead>
                  <tr className="text-[10px] uppercase text-slate-400 font-bold tracking-widest bg-slate-50/50 dark:bg-[#0a1527]/50 border-b border-slate-100 dark:border-[#162744]">
                    <th className="px-8 py-4">Date</th>
                    <th className="px-8 py-4">Description</th>
                    <th className="px-8 py-4">Category</th>
                    <th className="px-8 py-4 text-right">Amount</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-[#162744]">
                  {activeExpenses.map(e => (
                    <tr key={e.id} className="hover:bg-slate-50 dark:hover:bg-[#0a1527]/50 transition-colors">
                      <td className="px-8 py-4 text-sm text-slate-500 dark:text-slate-400">{new Date(e.date).toLocaleDateString()}</td>
                      <td className="px-8 py-4 font-bold text-slate-900 dark:text-slate-200">{e.description}</td>
                      <td className="px-8 py-4">
                        <span className="px-3 py-1 bg-slate-100 dark:bg-[#0a1527] border border-slate-200 dark:border-[#162744] rounded-lg text-xs font-bold text-slate-400">
                          {e.category}
                        </span>
                      </td>
                      <td className="px-8 py-4 text-right font-black text-rose-500 text-base">৳{e.amount.toLocaleString()}</td>
                    </tr>
                  ))}
                  {activeExpenses.length === 0 && (
                    <tr>
                      <td colSpan={4} className="px-8 py-16 text-center text-slate-400 font-medium">
                         No expenses recorded in the active session.
                       </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            {/* Mobile View */}
            <div className="md:hidden divide-y divide-slate-100 dark:divide-[#162744]">
               {activeExpenses.length === 0 ? (
                  <div className="p-12 text-center text-slate-400 font-bold uppercase tracking-widest text-[10px]">No records found</div>
               ) : (
                  activeExpenses.map(e => (
                     <div key={e.id} className="p-6 flex justify-between items-center group">
                        <div>
                           <div className="text-[10px] font-black text-rose-400 uppercase tracking-widest mb-1">{new Date(e.date).toLocaleDateString()}</div>
                           <div className="text-sm font-black text-slate-900 dark:text-white">{e.description}</div>
                           <div className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">{e.category}</div>
                        </div>
                        <div className="text-right">
                           <div className="text-lg font-black text-rose-500">৳{e.amount.toLocaleString()}</div>
                        </div>
                     </div>
                  ))
               )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ExpensesView;
