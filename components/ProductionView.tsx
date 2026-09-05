import React, { useMemo } from 'react';
import { Production, Product, Sale, Wastage } from '../types';
import { 
  History, 
  TrendingUp, 
  Calendar, 
  Package, 
  Trash2,
  ArrowUpRight,
  Target,
  BarChart3,
  Scan,
  AlertTriangle
} from 'lucide-react';
import { motion } from 'motion/react';

interface Props {
  production: Production[];
  products: Product[];
  sales: Sale[];
  wastage: Wastage[];
  onDelete: (id: string) => void;
}

const ProductionView: React.FC<Props> = ({ production, products, sales, wastage, onDelete }) => {
  const [activeTab, setActiveTab] = React.useState<'history' | 'reconciliation'>('reconciliation');

  const stats = useMemo(() => {
    const now = new Date();
    const today = now.toLocaleDateString();
    const thisMonth = now.toLocaleString('default', { month: 'long', year: 'numeric' });

    const todayTotal = production
      .filter(p => new Date(p.date).toLocaleDateString() === today)
      .reduce((sum, p) => sum + p.totalValue, 0);

    const monthTotal = production
      .filter(p => {
        const d = new Date(p.date);
        return d.toLocaleString('default', { month: 'long', year: 'numeric' }) === thisMonth;
      })
      .reduce((sum, p) => sum + p.totalValue, 0);

    return { todayTotal, monthTotal };
  }, [production]);

  const sortedProduction = useMemo(() => {
    return [...production].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }, [production]);

  const reconciliationData = useMemo(() => {
    const todayStr = new Date().toLocaleDateString();
    
    return products.map(product => {
      const todayProduction = production
        .filter(p => new Date(p.date).toLocaleDateString() === todayStr && p.productId === product.id)
        .reduce((sum, p) => sum + p.quantity, 0);

      const todaySales = sales
        .filter(s => new Date(s.date).toLocaleDateString() === todayStr)
        .reduce((sum, s) => {
          const item = s.items.find(i => i.productId === product.id);
          return sum + (item ? item.quantity : 0);
        }, 0);

      const todayWastage = wastage
        .filter(w => new Date(w.date).toLocaleDateString() === todayStr && w.productId === product.id)
        .reduce((sum, w) => sum + w.quantity, 0);

      return {
        ...product,
        todayProduction,
        todaySales,
        todayWastage
      };
    }).filter(p => p.todayProduction > 0 || p.todaySales > 0 || p.todayWastage > 0 || p.stock > 0);
  }, [products, production, sales, wastage]);

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-white dark:bg-[#070e1b] p-8 rounded-3xl border border-slate-200 dark:border-[#162744] shadow-sm relative overflow-hidden group"
        >
          <div className="absolute top-0 right-0 p-8 opacity-10 group-hover:scale-110 transition-transform duration-500 text-[#00e5ff]">
            <Target size={80} />
          </div>
          <div className="relative z-10">
            <div className="w-12 h-12 bg-[#0a1527] border border-[#00d2ff]/30 rounded-2xl flex items-center justify-center mb-5 text-[#00e5ff] shadow-[0_0_15px_rgba(0,210,255,0.2)]">
              <TrendingUp size={24} />
            </div>
            <p className="text-[#00e5ff] font-bold uppercase tracking-[0.2em] text-[10px] mb-1">Today's Production</p>
            <h3 className="text-4xl font-black text-slate-900 dark:text-white tracking-tight drop-shadow-[0_0_10px_rgba(0,229,255,0.2)]">
              ৳{stats.todayTotal.toLocaleString()}
            </h3>
          </div>
        </motion.div>

        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="bg-white dark:bg-[#070e1b] p-8 rounded-3xl border border-slate-200 dark:border-[#162744] shadow-sm relative overflow-hidden group"
        >
          <div className="absolute top-0 right-0 p-8 opacity-10 group-hover:scale-110 transition-transform duration-500 text-[#00e5ff]">
            <Calendar size={80} />
          </div>
          <div className="relative z-10">
            <div className="w-12 h-12 bg-[#0a1527] border border-[#00d2ff]/30 rounded-2xl flex items-center justify-center mb-5 text-[#00e5ff] shadow-[0_0_15px_rgba(0,210,255,0.2)]">
              <ArrowUpRight size={24} />
            </div>
            <p className="text-[#00e5ff] font-bold uppercase tracking-[0.2em] text-[10px] mb-1">Monthly Production</p>
            <h3 className="text-4xl font-black text-slate-900 dark:text-white tracking-tight">
              ৳{stats.monthTotal.toLocaleString()}
            </h3>
          </div>
        </motion.div>
      </div>

      <div className="flex bg-slate-100 dark:bg-[#050b14] p-1.5 rounded-2xl border border-slate-200 dark:border-[#162744] w-fit">
        <button onClick={() => setActiveTab('reconciliation')} className={`px-6 py-2.5 rounded-xl text-xs font-black uppercase tracking-widest transition-all flex items-center gap-2 cursor-pointer ${activeTab === 'reconciliation' ? 'smart-cyan-pill' : 'text-slate-400 hover:text-white'}`}><BarChart3 size={16} /> Match Report</button>
        <button onClick={() => setActiveTab('history')} className={`px-6 py-2.5 rounded-xl text-xs font-black uppercase tracking-widest transition-all flex items-center gap-2 cursor-pointer ${activeTab === 'history' ? 'smart-cyan-pill' : 'text-slate-400 hover:text-white'}`}><History size={16} /> Full History</button>
      </div>

      {activeTab === 'reconciliation' ? (
        <div className="bg-white dark:bg-[#070e1b] rounded-3xl border border-slate-200 dark:border-[#162744] shadow-sm overflow-hidden">
          <div className="p-7 border-b border-slate-100 dark:border-[#162744] flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="p-3 bg-[#0a1527] border border-[#00d2ff]/30 rounded-2xl text-[#00e5ff]"><Scan size={22} /></div>
              <div>
                <h3 className="text-lg font-black text-slate-900 dark:text-white uppercase tracking-tight">Live Reconciliation</h3>
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Today's Sales vs Production vs Stock</p>
              </div>
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="bg-slate-50/50 dark:bg-[#0a1527]/50 border-b border-slate-100 dark:border-[#162744]">
                  <th className="px-8 py-4 text-[10px] font-black uppercase tracking-widest text-slate-400">Product</th>
                  <th className="px-8 py-4 text-[10px] font-black uppercase tracking-widest text-slate-400">Produced Today</th>
                  <th className="px-8 py-4 text-[10px] font-black uppercase tracking-widest text-slate-400">Sold Today</th>
                  <th className="px-8 py-4 text-[10px] font-black uppercase tracking-widest text-slate-400">Wastage</th>
                  <th className="px-8 py-4 text-[10px] font-black uppercase tracking-widest text-slate-400">Current Stock</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-[#162744]">
                {reconciliationData.map(p => (
                  <tr key={p.id} className="hover:bg-slate-50/50 dark:hover:bg-[#0a1527]/50 transition-colors">
                    <td className="px-8 py-4.5 font-black text-slate-900 dark:text-white">{p.name}</td>
                    <td className="px-8 py-4.5 font-bold text-slate-600 dark:text-[#00e5ff]">{p.todayProduction} {p.unit}</td>
                    <td className="px-8 py-4.5 font-black text-emerald-400">{p.todaySales} {p.unit}</td>
                    <td className="px-8 py-4.5 font-bold text-rose-400">{p.todayWastage > 0 ? `${p.todayWastage} ${p.unit}` : '-'}</td>
                    <td className="px-8 py-4.5">
                      <span className={`px-3.5 py-1.5 rounded-xl text-xs font-black ${p.stock <= 10 ? 'bg-rose-500/10 text-rose-400 border border-rose-500/20' : 'bg-slate-100 dark:bg-[#0a1527] text-slate-900 dark:text-white border border-slate-200 dark:border-[#162744]'}`}>
                        {p.stock} {p.unit}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        <div className="bg-white dark:bg-[#070e1b] rounded-3xl border border-slate-200 dark:border-[#162744] shadow-sm overflow-hidden">
          <div className="p-7 border-b border-slate-100 dark:border-[#162744] flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="p-3 bg-[#0a1527] border border-[#00d2ff]/30 rounded-2xl text-[#00e5ff]">
                <History size={22} />
              </div>
              <div>
                <h3 className="text-lg font-black text-slate-900 dark:text-white uppercase tracking-tight">Production History</h3>
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">History of all production entries</p>
              </div>
            </div>
            <div className="px-4 py-2 bg-slate-50 dark:bg-[#0a1527] rounded-xl border border-slate-200 dark:border-[#162744]">
              <span className="text-xs font-black text-slate-500 dark:text-[#00e5ff] uppercase tracking-widest">Total Records: {production.length}</span>
            </div>
          </div>

        <div className="hidden md:block overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50/50 dark:bg-[#0a1527]/50 border-b border-slate-100 dark:border-[#162744]">
                <th className="px-8 py-4 text-[10px] font-black uppercase tracking-widest text-slate-400">Date & Time</th>
                <th className="px-8 py-4 text-[10px] font-black uppercase tracking-widest text-slate-400">Product Name</th>
                <th className="px-8 py-4 text-[10px] font-black uppercase tracking-widest text-slate-400">Quantity</th>
                <th className="px-8 py-4 text-[10px] font-black uppercase tracking-widest text-slate-400">Unit Price</th>
                <th className="px-8 py-4 text-[10px] font-black uppercase tracking-widest text-slate-400">Total Value</th>
                <th className="px-8 py-4 text-[10px] font-black uppercase tracking-widest text-slate-400 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-[#162744]">
              {sortedProduction.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-8 py-16 text-center">
                    <div className="flex flex-col items-center gap-4 opacity-20 text-[#00e5ff]">
                      <Package size={56} />
                      <p className="font-black uppercase tracking-widest text-xs">No production records found</p>
                    </div>
                  </td>
                </tr>
              ) : (
                sortedProduction.map((p) => (
                  <tr key={p.id} className="hover:bg-slate-50/50 dark:hover:bg-[#0a1527]/50 transition-colors group">
                    <td className="px-8 py-4.5">
                      <div className="flex flex-col">
                        <span className="text-sm font-bold text-slate-700 dark:text-slate-200">
                          {new Date(p.date).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}
                        </span>
                        <span className="text-[10px] font-medium text-slate-400">
                          {new Date(p.date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </span>
                      </div>
                    </td>
                    <td className="px-8 py-4.5">
                      <span className="text-sm font-black text-slate-900 dark:text-white">{p.productName}</span>
                    </td>
                    <td className="px-8 py-4.5">
                      <span className="px-3 py-1 bg-slate-100 dark:bg-[#0a1527] border border-slate-200 dark:border-[#162744] rounded-lg text-xs font-black text-slate-600 dark:text-slate-300">
                        {p.quantity} {p.unit}
                      </span>
                    </td>
                    <td className="px-8 py-4.5">
                      <span className="text-sm font-bold text-slate-600 dark:text-slate-400">৳{p.unitPrice}</span>
                    </td>
                    <td className="px-8 py-4.5">
                      <span className="text-sm font-black text-[#00e5ff]">৳{p.totalValue.toLocaleString()}</span>
                    </td>
                    <td className="px-8 py-4.5 text-right">
                      <button 
                        onClick={() => onDelete(p.id)}
                        className="p-2 text-slate-400 hover:text-red-500 hover:bg-red-500/10 rounded-xl transition-all cursor-pointer active:scale-90"
                      >
                        <Trash2 size={18} />
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        <div className="md:hidden divide-y divide-slate-100 dark:divide-[#162744]">
           {sortedProduction.length === 0 ? (
              <div className="p-12 text-center text-slate-400 font-bold uppercase tracking-widest text-[10px]">No records found</div>
           ) : (
              sortedProduction.map(p => (
                 <div key={p.id} className="p-6 space-y-4">
                    <div className="flex justify-between items-start">
                       <div>
                          <div className="text-[10px] font-black text-[#00e5ff] uppercase tracking-widest">
                            {new Date(p.date).toLocaleDateString()} {new Date(p.date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          </div>
                          <div className="text-base font-black text-slate-900 dark:text-white">{p.productName}</div>
                       </div>
                       <button onClick={() => onDelete(p.id)} className="p-2 text-rose-400 bg-rose-500/10 rounded-lg cursor-pointer">
                          <Trash2 size={16} />
                       </button>
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                       <div className="p-3 bg-slate-50 dark:bg-[#0a1527] rounded-xl border border-slate-100 dark:border-[#162744]">
                          <div className="text-[8px] text-slate-400 font-black uppercase mb-1">Production</div>
                          <div className="text-sm font-black text-slate-900 dark:text-white">{p.quantity} {p.unit}</div>
                       </div>
                       <div className="p-3 bg-[#0a1527] rounded-xl border border-[#00d2ff]/20">
                          <div className="text-[8px] text-[#00e5ff] font-black uppercase mb-1">Total Value</div>
                          <div className="text-sm font-black text-[#00e5ff]">৳{p.totalValue.toLocaleString()}</div>
                       </div>
                    </div>
                 </div>
              ))
           )}
        </div>
      </div>
    )}
  </div>
);
};

export default ProductionView;
