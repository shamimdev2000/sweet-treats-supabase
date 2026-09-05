import React, { useState, useMemo } from 'react';
import { Product, Wastage, DailyClosing } from '../types';
import { Trash, History, Trash2, Calendar, Banknote, AlertCircle, Plus, FileDown, RotateCcw, X } from 'lucide-react';

interface Props {
  wastage: Wastage[];
  products: Product[];
  onAdd: (w: Wastage) => void;
  onDelete: (id: string) => void;
  closings?: DailyClosing[];
}

const WastageView: React.FC<Props> = ({ wastage, products, onAdd, onDelete, closings = [] }) => {
  const [isAdding, setIsAdding] = useState(false);
  const [selectedProductId, setSelectedProductId] = useState('');
  const [productSearchTerm, setProductSearchTerm] = useState('');
  const [isProductDropdownOpen, setIsProductDropdownOpen] = useState(false);
  const [qty, setQty] = useState<number | ''>('');
  const [reason, setReason] = useState('Expired');
  const [error, setError] = useState<string | null>(null);

  const filteredProducts = useMemo(() => {
    if (!productSearchTerm) return products;
    const lower = productSearchTerm.toLowerCase();
    return products
      .filter(p => 
        p.name.toLowerCase().includes(lower) || 
        (p.barcode && p.barcode.includes(lower))
      )
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [products, productSearchTerm]);

  const selectedProduct = products.find(p => p.id === selectedProductId);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedProduct || qty === '') return;

    if (selectedProduct.stock < Number(qty)) {
      setError("Cannot record more than available stock!");
      setTimeout(() => setError(null), 3000);
      return;
    }

    const newWastage: Wastage = {
      id: Date.now().toString(),
      productId: selectedProduct.id,
      productName: selectedProduct.name,
      quantity: Number(qty),
      unit: selectedProduct.unit,
      lossValue: selectedProduct.price * Number(qty),
      reason,
      date: new Date().toISOString()
    };

    onAdd(newWastage);
    setSelectedProductId('');
    setProductSearchTerm('');
    setQty('');
    setReason('Expired');
    setIsAdding(false);
  };

  const lastClosingTimestamp = useMemo(() => {
    if (closings.length === 0) return 0;
    return Math.max(...closings.map(c => new Date(c.timestamp).getTime()));
  }, [closings]);

  const activeWastage = useMemo(() => {
    return [...wastage]
      .filter(w => new Date(w.date).getTime() > lastClosingTimestamp)
      .reverse();
  }, [wastage, lastClosingTimestamp]);

  const totalLoss = activeWastage.reduce((sum, w) => sum + w.lossValue, 0);

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-[#050b14] dark:bg-[#070e1b] p-8 rounded-3xl shadow-xl text-white md:col-span-1 border border-[#00d2ff]/40 relative overflow-hidden group">
          <div className="absolute -right-4 -bottom-4 opacity-10 group-hover:scale-110 transition-transform duration-500 text-[#00e5ff]">
             <Trash size={180} />
          </div>
          <div className="relative z-10">
            <div className="flex items-center gap-2 mb-2">
              <span className="w-2 h-2 rounded-full bg-rose-500 shadow-[0_0_8px_#f43f5e]"></span>
              <h4 className="text-rose-400 font-bold text-xs uppercase tracking-widest">Active Wastage Loss</h4>
            </div>
            <div className="flex items-baseline gap-1 text-white">
              <span className="text-2xl font-bold text-rose-400">৳</span>
              <span className="text-5xl font-black tracking-tight text-rose-500 drop-shadow-[0_0_15px_rgba(244,63,94,0.3)]">{totalLoss.toLocaleString()}</span>
            </div>
            <p className="mt-4 text-slate-400 text-[10px] font-bold uppercase tracking-widest">Wastage Loss (Active Session)</p>
          </div>
        </div>

        <div className="md:col-span-2 bg-white dark:bg-[#070e1b] p-8 rounded-3xl border border-slate-200 dark:border-[#162744] flex items-center justify-between shadow-sm">
           <div>
              <h2 className="text-2xl font-black text-slate-900 dark:text-white mb-2">Wastage Tracking</h2>
              <p className="text-slate-500 dark:text-slate-400 text-sm max-w-md">Track expired or damaged goods. Recorded wastage is automatically deducted from stock.</p>
           </div>
           <button 
             onClick={() => setIsAdding(true)}
             className="smart-cyan-pill px-8 py-3.5 flex items-center gap-2 text-xs uppercase tracking-wider cursor-pointer"
           >
             <Plus size={18} /> Record Wastage
           </button>
        </div>
      </div>

      {isAdding && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-md z-[110] flex items-center justify-center p-6 animate-in fade-in duration-300">
           <div className="bg-white dark:bg-[#070e1b] p-8 rounded-3xl border border-slate-200 dark:border-[#162744] shadow-2xl w-full max-w-md animate-in zoom-in duration-300">
              <div className="flex justify-between items-center mb-6">
                <h3 className="text-xl font-bold flex items-center gap-3 text-slate-900 dark:text-white">
                  <div className="w-10 h-10 bg-[#0a1527] border border-[#00d2ff]/30 rounded-xl flex items-center justify-center text-[#00e5ff]">
                    <Trash size={18} />
                  </div>
                  Record New Wastage
                </h3>
                <button onClick={() => setIsAdding(false)} className="text-slate-400 hover:text-red-500 transition-colors cursor-pointer"><X size={24}/></button>
              </div>
              <form onSubmit={handleSubmit} className="space-y-5">
                 {error && (
                   <div className="p-4 bg-red-500/10 border border-red-500/20 rounded-xl text-red-500 text-xs font-bold flex items-center gap-2 animate-in slide-in-from-top-2">
                     <AlertCircle size={16} /> {error}
                   </div>
                 )}
                 <div className="space-y-2 relative">
                    <label className="text-xs font-bold text-slate-400 uppercase px-1">Product</label>
                    <input 
                      type="text" 
                      placeholder="Search product..."
                      className="w-full p-3.5 rounded-xl bg-slate-50 dark:bg-[#0a1527] border border-slate-200 dark:border-[#162744] text-slate-900 dark:text-white outline-none focus:border-[#00e5ff] text-sm"
                      value={productSearchTerm}
                      onChange={(e) => {
                        setProductSearchTerm(e.target.value);
                        setIsProductDropdownOpen(true);
                      }}
                      onFocus={() => setIsProductDropdownOpen(true)}
                      onBlur={() => setTimeout(() => setIsProductDropdownOpen(false), 200)}
                    />
                    {isProductDropdownOpen && productSearchTerm && (
                      <div className="absolute z-10 w-full mt-1 bg-white dark:bg-[#070e1b] border border-slate-200 dark:border-[#162744] rounded-xl shadow-xl max-h-40 overflow-y-auto">
                        {filteredProducts.map(p => (
                          <button
                            key={p.id}
                            onMouseDown={(e) => {
                              e.preventDefault();
                              setSelectedProductId(p.id);
                              setProductSearchTerm(p.name);
                              setIsProductDropdownOpen(false);
                            }}
                            className="w-full text-left px-4 py-3 hover:bg-slate-50 dark:hover:bg-[#0a1527] text-slate-900 dark:text-white border-b border-slate-200 dark:border-[#162744] last:border-0 transition-colors text-sm"
                          >
                            {p.name} (Stock: {p.stock} {p.unit})
                          </button>
                        ))}
                      </div>
                    )}
                 </div>
                 <div className="space-y-2">
                    <label className="text-xs font-bold text-slate-400 uppercase px-1">Quantity</label>
                    <input required type="number" step="any" className="w-full p-3.5 rounded-xl bg-slate-50 dark:bg-[#0a1527] border border-slate-200 dark:border-[#162744] text-slate-900 dark:text-white outline-none focus:border-[#00e5ff] text-sm font-bold" value={qty} onChange={e => setQty(e.target.value === '' ? '' : Number(e.target.value))} />
                 </div>
                 <div className="space-y-2">
                    <label className="text-xs font-bold text-slate-400 uppercase px-1">Reason</label>
                    <select className="w-full p-3.5 rounded-xl bg-slate-50 dark:bg-[#0a1527] border border-slate-200 dark:border-[#162744] text-slate-900 dark:text-white outline-none focus:border-[#00e5ff] text-sm" value={reason} onChange={e => setReason(e.target.value)}>
                      <option value="Expired">Expired</option>
                      <option value="Damaged">Damaged</option>
                      <option value="Burnt">Burnt</option>
                      <option value="Other">Other</option>
                    </select>
                 </div>
                 <button type="submit" className="w-full smart-cyan-pill py-3.5 text-xs uppercase tracking-wider cursor-pointer">Save Entry</button>
              </form>
           </div>
        </div>
      )}

      <div className="bg-white dark:bg-[#070e1b] rounded-3xl border border-slate-200 dark:border-[#162744] shadow-sm overflow-hidden">
        <div className="px-8 py-6 border-b border-slate-100 dark:border-[#162744] flex justify-between items-center">
          <h3 className="text-lg font-bold text-slate-900 dark:text-white flex items-center gap-3">
            <div className="w-10 h-10 bg-[#0a1527] border border-[#00d2ff]/30 rounded-xl flex items-center justify-center text-[#00e5ff]">
              <History size={20} />
            </div>
            Wastage History (Active Session)
          </h3>
        </div>
        
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="text-[10px] uppercase text-slate-400 font-bold tracking-widest bg-slate-50 dark:bg-[#0a1527]/50 border-b border-slate-100 dark:border-[#162744]">
                <th className="px-8 py-4">Date</th>
                <th className="px-8 py-4">Product</th>
                <th className="px-8 py-4">Qty</th>
                <th className="px-8 py-4">Loss Value</th>
                <th className="px-8 py-4">Reason</th>
                <th className="px-8 py-4 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-[#162744]">
              {activeWastage.map(w => (
                <tr key={w.id} className="hover:bg-slate-50 dark:hover:bg-[#0a1527]/50 transition-colors group">
                  <td className="px-8 py-4 text-slate-500 text-sm whitespace-nowrap">{new Date(w.date).toLocaleDateString()}</td>
                  <td className="px-8 py-4 font-bold text-slate-900 dark:text-slate-200">{w.productName}</td>
                  <td className="px-8 py-4 font-medium text-slate-500 dark:text-slate-400">{w.quantity} {w.unit}</td>
                  <td className="px-8 py-4 font-black text-rose-500">৳{w.lossValue.toLocaleString()}</td>
                  <td className="px-8 py-4">
                    <span className="bg-slate-100 dark:bg-[#0a1527] border border-slate-200 dark:border-[#162744] text-slate-500 dark:text-slate-400 px-3 py-1 rounded-lg text-[10px] font-bold uppercase tracking-widest">
                      {w.reason}
                    </span>
                  </td>
                  <td className="px-8 py-4 text-right">
                    <button onClick={() => onDelete(w.id)} className="p-2 text-slate-400 hover:text-red-500 hover:bg-red-500/10 rounded-xl transition-all cursor-pointer">
                      <Trash2 size={18} />
                    </button>
                  </td>
                </tr>
              ))}
              {activeWastage.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-8 py-16 text-center text-slate-400 font-medium">
                     No wastage records found for this session.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
      <div className="bg-white dark:bg-[#070e1b] rounded-3xl border border-slate-200 dark:border-[#162744] shadow-sm overflow-hidden mt-8">
        <div className="px-8 py-6 border-b border-slate-100 dark:border-[#162744] flex justify-between items-center">
          <h3 className="text-lg font-bold text-slate-900 dark:text-white flex items-center gap-3">
            <div className="w-10 h-10 bg-rose-500/10 border border-rose-500/20 rounded-xl flex items-center justify-center text-rose-500">
              <History size={20} />
            </div>
            Full Wastage History
          </h3>
          <div className="px-4 py-2 bg-slate-50 dark:bg-[#0a1527] rounded-xl border border-slate-200 dark:border-[#162744]">
             <span className="text-xs font-black text-slate-500 dark:text-[#00e5ff] uppercase tracking-widest">Total Records: {wastage.length}</span>
          </div>
        </div>
        
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="text-[10px] uppercase text-slate-400 font-bold tracking-widest bg-slate-50 dark:bg-[#0a1527]/50 border-b border-slate-100 dark:border-[#162744]">
                <th className="px-8 py-4">Date</th>
                <th className="px-8 py-4">Product</th>
                <th className="px-8 py-4">Qty</th>
                <th className="px-8 py-4">Loss Value</th>
                <th className="px-8 py-4">Reason</th>
                <th className="px-8 py-4 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-[#162744]">
              {[...wastage].reverse().map(w => (
                <tr key={w.id} className="hover:bg-slate-50 dark:hover:bg-[#0a1527]/50 transition-colors group">
                  <td className="px-8 py-4 text-slate-500 text-xs whitespace-nowrap">
                    <div className="font-bold text-slate-700 dark:text-slate-300">{new Date(w.date).toLocaleDateString()}</div>
                    <div className="text-[10px] opacity-60 text-slate-400">{new Date(w.date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</div>
                  </td>
                  <td className="px-8 py-4 font-bold text-slate-900 dark:text-slate-200">{w.productName}</td>
                  <td className="px-8 py-4 font-medium text-slate-500 dark:text-slate-400">{w.quantity} {w.unit}</td>
                  <td className="px-8 py-4 font-black text-rose-500">৳{w.lossValue.toLocaleString()}</td>
                  <td className="px-8 py-4">
                    <span className="bg-slate-100 dark:bg-[#0a1527] border border-slate-200 dark:border-[#162744] text-slate-500 dark:text-slate-400 px-3 py-1 rounded-lg text-[10px] font-bold uppercase tracking-widest">
                      {w.reason}
                    </span>
                  </td>
                  <td className="px-8 py-4 text-right">
                    <button onClick={() => onDelete(w.id)} className="p-2 text-slate-400 hover:text-red-500 hover:bg-red-500/10 rounded-xl transition-all cursor-pointer">
                      <Trash2 size={18} />
                    </button>
                  </td>
                </tr>
              ))}
              {wastage.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-8 py-16 text-center text-slate-400 font-medium">
                     No wastage records found.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default WastageView;
