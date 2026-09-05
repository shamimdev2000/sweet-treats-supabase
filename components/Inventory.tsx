
import React, { useState, useMemo } from 'react';
import { Product } from '../types';
import { generateId } from '../services/idGenerator';
import { Plus, Search, Package, Trash2, ChevronDown, AlertCircle, Banknote, Edit3, X, AlertTriangle, Trash, Barcode } from 'lucide-react';

interface Props {
  products: Product[];
  onAdd: (product: Product, productionQty?: number) => void;
  onUpdate: (product: Product, productionQty?: number) => void;
  onDelete: (id: string) => void;
  onMarkWastage: (p: Product, qty: number, reason: string) => void;
  isManagerAuthenticated: boolean;
  onRequireAuth: (action: () => void) => void;
}

const Inventory: React.FC<Props> = ({ products, onAdd, onUpdate, onDelete, onMarkWastage, isManagerAuthenticated, onRequireAuth }) => {
  const [isAdding, setIsAdding] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [sortBy, setSortBy] = useState<'name_asc' | 'name_desc' | 'price_asc' | 'price_desc'>('name_asc');
  const [filterLowStock, setFilterLowStock] = useState(false);
  
  // Custom Modal States
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [wastageModalProduct, setWastageModalProduct] = useState<Product | null>(null);
  const [wastageQty, setWastageQty] = useState<number | ''>('');
  const [wastageReason, setWastageReason] = useState('Expired');

  const [formData, setFormData] = useState({
    name: '',
    category: 'Bread',
    price: '' as number | '',
    stock: '' as number | '',
    addStock: '' as number | '',
    unit: 'pcs',
    barcode: ''
  });

  // Calculate Total Stock Value
  const stockSummary = useMemo(() => {
    const totalValue = products.reduce((acc, p) => acc + (p.price * p.stock), 0);
    const totalItems = products.length;
    const totalQuantity = products.reduce((acc, p) => acc + p.stock, 0);
    return { totalValue, totalItems, totalQuantity };
  }, [products]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const addStockQty = Number(formData.addStock) || 0;
    const initialStockQty = Number(formData.stock) || 0;
    
    const finalData = {
      ...formData,
      price: Number(formData.price) || 0,
      stock: editingId ? initialStockQty + addStockQty : initialStockQty
    };
    
    // Remove addStock from finalData before calling onAdd/onUpdate
    const { addStock, ...productData } = finalData;

    if (editingId) {
      onUpdate({ ...productData, id: editingId } as Product, addStockQty);
      setEditingId(null);
    } else {
      onAdd({ ...productData, id: generateId('prod') } as Product, initialStockQty);
    }
    setFormData({ name: '', category: 'Bread', price: '', stock: '', unit: 'pcs', barcode: '', addStock: '' });
    setIsAdding(false);
  };

  const handleWastageSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (wastageModalProduct && wastageQty !== '') {
      onMarkWastage(wastageModalProduct, Number(wastageQty), wastageReason);
      setWastageModalProduct(null);
      setWastageQty('');
      setWastageReason('Expired');
    }
  };

  const handleEdit = (p: Product) => {
    setFormData({
      name: p.name,
      category: p.category,
      price: p.price,
      stock: p.stock,
      unit: p.unit,
      barcode: p.barcode || '',
      addStock: ''
    });
    setEditingId(p.id);
    setIsAdding(true);
  };

  const executeDelete = () => {
    if (confirmDeleteId) {
      onDelete(confirmDeleteId);
      setConfirmDeleteId(null);
      if (editingId === confirmDeleteId) {
        setIsAdding(false);
        setEditingId(null);
      }
    }
  };

  const getStockStatus = (p: Product): 'critical' | 'warning' | 'normal' => {
    const unit = p.unit?.toLowerCase() || 'pcs';
    if (p.stock <= 0) return 'critical';
    if (unit === 'kg' && p.stock <= 0.5) return 'critical';
    if (unit === 'gm' && p.stock <= 200) return 'critical';
    if (unit === 'ltr' && p.stock <= 0.5) return 'critical';
    if (unit === 'pcs' && p.stock <= 1) return 'critical';
    
    if (unit === 'kg' && p.stock <= 1) return 'warning';
    if (unit === 'gm' && p.stock <= 500) return 'warning';
    if (unit === 'ltr' && p.stock <= 1) return 'warning';
    if (unit === 'pcs' && p.stock <= 5) return 'warning';

    return 'normal';
  };

  const isLowStock = (p: Product) => {
    return getStockStatus(p) !== 'normal';
  };

  const filteredProducts = products
    .filter(p => {
      const matchesSearch = p.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        p.category.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (p.barcode && p.barcode.includes(searchTerm));
      
      if (filterLowStock) return matchesSearch && isLowStock(p);
      return matchesSearch;
    })
    .sort((a, b) => {
      // If there's a search term, prioritize exact matches or items that start with the search term
      if (searchTerm) {
        const aName = a.name.toLowerCase();
        const bName = b.name.toLowerCase();
        const searchLower = searchTerm.toLowerCase();
        
        const aExact = aName === searchLower;
        const bExact = bName === searchLower;
        if (aExact && !bExact) return -1;
        if (!aExact && bExact) return 1;

        const aStarts = aName.startsWith(searchLower);
        const bStarts = bName.startsWith(searchLower);
        if (aStarts && !bStarts) return -1;
        if (!aStarts && bStarts) return 1;
        
        // If search relevance is equal, prioritize newer items (by ID)
        return Number(b.id) - Number(a.id);
      }

      // Default sorting based on selected sortBy option
      if (sortBy === 'name_asc') return a.name.localeCompare(b.name);
      if (sortBy === 'name_desc') return b.name.localeCompare(a.name);
      if (sortBy === 'price_asc') return a.price - b.price;
      if (sortBy === 'price_desc') return b.price - a.price;
      return 0;
    });

  const units = ['pcs', 'kg', 'gm', 'pkt', 'ltr', 'box'];

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-12 gap-6">
        <div className="md:col-span-4 bg-[#050b14] dark:bg-[#070e1b] p-8 rounded-3xl shadow-xl text-white border border-[#00d2ff]/40 relative overflow-hidden group">
          <div className="absolute -right-4 -bottom-4 opacity-10 group-hover:scale-110 transition-transform duration-500 text-[#00e5ff]">
             <Banknote size={180} />
          </div>
          <div className="relative z-10">
            <div className="flex items-center gap-2 mb-2">
              <span className="w-2 h-2 rounded-full bg-[#00e5ff] shadow-[0_0_8px_#00e5ff]"></span>
              <h4 className="text-[#00e5ff] font-bold text-xs uppercase tracking-widest flex items-center gap-2">
                 <Banknote size={16} /> Total Stock Value
              </h4>
            </div>
            <div className="flex items-baseline gap-1 text-white">
              <span className="text-2xl font-bold text-[#00e5ff]">৳</span>
              <span className="text-5xl font-black tracking-tighter drop-shadow-[0_0_15px_rgba(0,229,255,0.3)]">{stockSummary.totalValue.toLocaleString()}</span>
            </div>
            <p className="mt-4 text-slate-400 text-[10px] font-bold uppercase tracking-widest">Current retail value of stored items</p>
          </div>
        </div>

        <div className="md:col-span-8 bg-white dark:bg-[#070e1b] p-8 rounded-3xl border border-slate-200 dark:border-[#162744] shadow-sm flex flex-col sm:flex-row items-center justify-between gap-6">
           <div className="flex-1">
              <h2 className="text-2xl font-black text-slate-900 dark:text-white mb-2">Inventory Analysis</h2>
              <p className="text-slate-500 dark:text-slate-400 text-sm max-w-md">Total <span className="text-[#00e5ff] font-bold">{stockSummary.totalItems} products</span> and {stockSummary.totalQuantity.toLocaleString()} total units in stock.</p>
           </div>
           <div className="flex gap-4 w-full sm:w-auto">
             <div className="flex-1 sm:flex-none p-4 px-6 bg-slate-50 dark:bg-[#0a1527] rounded-2xl border border-slate-200 dark:border-[#162744] text-center">
                <div className="text-[10px] font-bold text-slate-400 uppercase mb-1">Items</div>
                <div className="text-xl font-black text-slate-900 dark:text-[#00e5ff]">{stockSummary.totalItems}</div>
             </div>
             <div className="flex-1 sm:flex-none p-4 px-6 bg-slate-50 dark:bg-[#0a1527] rounded-2xl border border-slate-200 dark:border-[#162744] text-center">
                <div className="text-[10px] font-bold text-slate-400 uppercase mb-1">Total Qty</div>
                <div className="text-xl font-black text-slate-900 dark:text-emerald-400">{stockSummary.totalQuantity}</div>
             </div>
           </div>
        </div>
      </div>

      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h2 className="text-2xl font-bold text-slate-900 dark:text-white mb-1">Product List</h2>
          <p className="text-slate-500 dark:text-slate-400 text-sm">Manage your bakery items and individual stock levels.</p>
        </div>
        <button 
          onClick={() => {
            setFormData({ name: '', category: 'Bread', price: '', stock: '', unit: 'pcs', barcode: '', addStock: '' });
            setEditingId(null);
            setIsAdding(true);
          }}
          className="smart-cyan-pill px-8 py-3.5 flex items-center gap-2 uppercase tracking-wider text-xs cursor-pointer"
        >
          <Plus size={18} /> Add New Product
        </button>
      </div>

      {/* Search & Sort */}
      <div className="bg-white dark:bg-[#070e1b] p-4 rounded-3xl border border-slate-200 dark:border-[#162744] flex flex-col md:flex-row gap-4 items-center shadow-sm">
        <div className="relative flex-1 w-full">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-[#00e5ff]" size={20} />
          <input 
            type="text" 
            placeholder="Search products by name or barcode..." 
            className="w-full pl-12 pr-4 py-3.5 rounded-xl bg-slate-50 dark:bg-[#0a1527] border border-slate-200 dark:border-[#162744] text-slate-900 dark:text-white placeholder-slate-400 focus:border-[#00e5ff] focus:shadow-[0_0_15px_rgba(0,229,255,0.2)] outline-none transition-all text-sm"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
        <div className="flex items-center gap-3 w-full md:w-auto">
          <button 
            onClick={() => setFilterLowStock(!filterLowStock)}
            className={`px-4 py-3 rounded-xl font-bold text-xs flex items-center gap-2 transition-all border cursor-pointer ${filterLowStock ? 'bg-red-500 text-white border-red-500 shadow-lg shadow-red-500/20' : 'bg-slate-50 dark:bg-[#0a1527] text-slate-400 border-slate-200 dark:border-[#162744] hover:text-white'}`}
          >
            <AlertTriangle size={16} />
            Low Stock
          </button>
          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Sort By:</span>
          <select 
            className="bg-slate-50 dark:bg-[#0a1527] border border-slate-200 dark:border-[#162744] p-3 px-5 rounded-xl text-slate-900 dark:text-white outline-none focus:border-[#00e5ff] cursor-pointer w-full md:w-44 text-sm"
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as any)}
          >
            <option value="name_asc">Name (A-Z)</option>
            <option value="name_desc">Name (Z-A)</option>
            <option value="price_asc">Price (Low-High)</option>
            <option value="price_desc">Price (High-Low)</option>
          </select>
        </div>
      </div>

      {/* Wastage Modal */}
      {wastageModalProduct && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-md z-[120] flex items-center justify-center p-6 animate-in fade-in duration-300">
           <div className="bg-white dark:bg-[#070e1b] p-8 rounded-3xl border border-slate-200 dark:border-[#162744] shadow-2xl w-full max-w-md animate-in zoom-in duration-300">
              <div className="flex justify-between items-center mb-6">
                <h3 className="text-xl font-bold flex items-center gap-3 text-slate-900 dark:text-white">
                   <div className="w-10 h-10 bg-[#0a1527] border border-[#00d2ff]/30 rounded-xl flex items-center justify-center text-[#00e5ff]">
                     <Trash size={18} />
                   </div>
                   Mark Wastage
                </h3>
                <button onClick={() => setWastageModalProduct(null)} className="text-slate-500 hover:text-red-500 transition-colors cursor-pointer">
                  <X size={24} />
                </button>
              </div>
              <form onSubmit={handleWastageSubmit} className="space-y-5">
                 <div className="p-4 bg-slate-50 dark:bg-[#0a1527] rounded-2xl border border-slate-200 dark:border-[#162744]">
                    <p className="text-[10px] font-black text-[#00e5ff] uppercase tracking-widest mb-1">Product</p>
                    <p className="text-lg font-black text-slate-900 dark:text-white">{wastageModalProduct.name}</p>
                 </div>
                 <div className="space-y-2">
                    <label className="text-xs font-bold text-slate-400 uppercase px-1">Quantity ({wastageModalProduct.unit})</label>
                    <input 
                      required 
                      type="number" 
                      step="any"
                      max={wastageModalProduct.stock}
                      className="w-full p-4 rounded-xl bg-slate-50 dark:bg-[#0a1527] border border-slate-200 dark:border-[#162744] text-slate-900 dark:text-white font-black text-2xl outline-none focus:border-[#00e5ff]" 
                      value={wastageQty} 
                      onChange={e => setWastageQty(e.target.value === '' ? '' : Number(e.target.value))} 
                    />
                 </div>
                 <div className="space-y-2">
                    <label className="text-xs font-bold text-slate-400 uppercase px-1">Reason</label>
                    <select className="w-full p-4 rounded-xl bg-slate-50 dark:bg-[#0a1527] border border-slate-200 dark:border-[#162744] text-slate-900 dark:text-white outline-none focus:border-[#00e5ff]" value={wastageReason} onChange={e => setWastageReason(e.target.value)}>
                      <option value="Expired">Expired</option>
                      <option value="Damaged">Damaged</option>
                      <option value="Burnt">Burnt</option>
                      <option value="Other">Other</option>
                    </select>
                 </div>
                 <button type="submit" className="w-full smart-cyan-pill py-4 uppercase tracking-wider text-xs cursor-pointer">
                    Confirm Wastage
                 </button>
              </form>
           </div>
        </div>
      )}

      {/* Product List Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {filteredProducts.map(p => {
          const stockStatus = getStockStatus(p);
          return (
          <div 
            key={p.id} 
            className={`bg-white dark:bg-[#070e1b] p-7 rounded-3xl border relative group transition-all shadow-sm hover:shadow-[0_0_20px_rgba(0,210,255,0.15)] ${
              stockStatus === 'critical'
                ? 'border-red-500/90 ring-2 ring-red-500/20 bg-red-500/5' 
                : stockStatus === 'warning'
                ? 'border-amber-400/90 ring-2 ring-amber-400/20 bg-amber-500/5'
                : 'border-slate-200 dark:border-[#162744] hover:border-[#00e5ff]/50'
            }`}
          >
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <span className="bg-slate-100 dark:bg-[#0a1527] text-slate-600 dark:text-[#00e5ff] px-3 py-1 rounded-lg text-[10px] font-bold uppercase tracking-widest border border-slate-200 dark:border-[#162744]">
                  {p.category}
                </span>
                {stockStatus === 'critical' && (
                  <span className="bg-red-500/20 text-red-500 dark:text-red-400 px-2.5 py-0.5 rounded-md text-[9px] font-black uppercase tracking-wider border border-red-500/30 flex items-center gap-1">
                    <AlertCircle size={10} /> Out / Critical
                  </span>
                )}
                {stockStatus === 'warning' && (
                  <span className="bg-amber-500/20 text-amber-600 dark:text-amber-400 px-2.5 py-0.5 rounded-md text-[9px] font-black uppercase tracking-wider border border-amber-500/30 flex items-center gap-1">
                    <AlertTriangle size={10} /> Reorder Low
                  </span>
                )}
              </div>
              <div className="flex gap-2">
                <button 
                  onClick={() => {
                    const action = () => setWastageModalProduct(p);
                    if (isManagerAuthenticated) {
                      action();
                    } else {
                      onRequireAuth(action);
                    }
                  }} 
                  className="p-2 text-slate-400 hover:text-white bg-slate-100 dark:bg-[#0a1527] hover:bg-rose-500 border border-slate-200 dark:border-[#162744] hover:border-rose-500 transition-all rounded-xl cursor-pointer active:scale-90"
                  title="Mark Wastage"
                >
                  <Trash size={16} />
                </button>
                <button 
                  onClick={() => handleEdit(p)} 
                  className="p-2 text-slate-400 hover:text-[#00e5ff] transition-all bg-slate-100 dark:bg-[#0a1527] hover:border-[#00e5ff]/40 rounded-xl border border-slate-200 dark:border-[#162744] cursor-pointer active:scale-90"
                  title="Edit Product"
                >
                  <Edit3 size={16} />
                </button>
              </div>
            </div>
            
            <div className="absolute top-16 right-7 text-right">
               <div className="flex items-baseline justify-end gap-1 text-[#00e5ff]">
                 <span className="text-base font-bold">৳</span>
                 <span className="text-3xl font-black tracking-tight drop-shadow-[0_0_8px_rgba(0,229,255,0.4)]">{p.price}</span>
               </div>
               <div className="text-[10px] text-slate-400 font-bold uppercase">per {p.unit || 'pcs'}</div>
            </div>
            
            <div className="mb-6 mt-2">
              <h4 className="text-xl font-bold text-slate-900 dark:text-white group-hover:text-[#00e5ff] transition-colors pr-24">
                {p.name}
              </h4>
              {p.barcode && (
                <div className="flex items-center gap-1 text-slate-400 font-bold text-[10px] uppercase mt-1">
                  <Barcode size={12} className="text-[#00e5ff]" /> {p.barcode}
                </div>
              )}
            </div>
            
            <div className="space-y-3">
              <div className="flex justify-between items-center text-sm">
                <span className="text-slate-400 font-semibold text-xs">Available Stock</span>
                <span className={`font-black text-sm ${isLowStock(p) ? 'text-red-400' : 'text-slate-900 dark:text-emerald-400'}`}>
                  {p.stock} {p.unit || 'pcs'}
                </span>
              </div>
              <div className="h-2.5 w-full bg-slate-100 dark:bg-[#0a1527] rounded-full overflow-hidden border border-slate-200 dark:border-[#162744]">
                <div 
                  className={`h-full transition-all duration-1000 ${isLowStock(p) ? 'bg-red-500' : 'bg-gradient-to-r from-[#0092d6] to-[#00e5ff]'}`} 
                  style={{ width: `${Math.min(100, (p.stock / (p.unit === 'kg' ? 10 : p.unit === 'gm' ? 10000 : 100)) * 100)}%` }} 
                />
              </div>
            </div>
          </div>
          );
        })}
        {filteredProducts.length === 0 && (
          <div className="col-span-full py-20 text-center bg-white dark:bg-[#070e1b] border border-slate-200 dark:border-[#162744] rounded-3xl">
             <Package size={48} className="mx-auto mb-4 opacity-20 text-[#00e5ff]" />
             <p className="text-slate-400 font-medium text-base">No products found in inventory.</p>
          </div>
        )}
      </div>

      {/* Delete Modal */}
      {confirmDeleteId && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-md z-[110] flex items-center justify-center p-6 animate-in fade-in duration-300">
          <div className="bg-white dark:bg-[#070e1b] p-8 rounded-3xl border border-slate-200 dark:border-[#162744] shadow-2xl w-full max-w-md animate-in zoom-in duration-300 text-center">
            <div className="w-16 h-16 bg-red-500/10 rounded-2xl flex items-center justify-center mx-auto mb-5 text-red-500 border border-red-500/20">
              <AlertTriangle size={36} />
            </div>
            <h3 className="text-2xl font-black text-slate-900 dark:text-white mb-2">Are you sure?</h3>
            <p className="text-slate-500 dark:text-slate-400 text-sm mb-6">This action cannot be undone.</p>
            <div className="flex flex-col gap-3">
              <button onClick={executeDelete} className="w-full bg-red-500 hover:bg-red-600 text-white font-bold py-3.5 rounded-2xl cursor-pointer transition-all">Delete Item</button>
              <button onClick={() => setConfirmDeleteId(null)} className="w-full bg-slate-100 dark:bg-[#0a1527] text-slate-400 font-bold py-3.5 rounded-2xl hover:text-white cursor-pointer transition-all">Cancel</button>
            </div>
          </div>
        </div>
      )}

      {/* Add/Edit Modal */}
      {isAdding && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-md z-[100] flex items-center justify-center p-6">
          <div className="bg-white dark:bg-[#070e1b] p-8 rounded-3xl border border-slate-200 dark:border-[#162744] shadow-2xl w-full max-w-2xl animate-in zoom-in duration-300">
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-xl font-bold flex items-center gap-3 text-slate-900 dark:text-white">
                 <div className="w-10 h-10 bg-[#0a1527] border border-[#00d2ff]/30 rounded-xl flex items-center justify-center text-[#00e5ff]">
                   <Package size={20} />
                 </div>
                 {editingId ? 'Edit Product' : 'Add New Product'}
              </h3>
              <button onClick={() => {setIsAdding(false); setEditingId(null);}} className="text-slate-400 hover:text-red-500 transition-colors cursor-pointer">
                <X size={24} />
              </button>
            </div>
            <form onSubmit={handleSubmit} className="grid grid-cols-1 md:grid-cols-2 gap-5">
              <div className="space-y-2">
                <label className="text-xs font-bold text-slate-400 uppercase px-1">Product Name</label>
                <input required type="text" className="w-full p-3.5 rounded-xl bg-slate-50 dark:bg-[#0a1527] border border-slate-200 dark:border-[#162744] text-slate-900 dark:text-white focus:border-[#00e5ff] outline-none text-sm" value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} placeholder="e.g. Milk Bread" />
              </div>
              <div className="space-y-2">
                <label className="text-xs font-bold text-slate-400 uppercase px-1">Category</label>
                <select className="w-full p-3.5 rounded-xl bg-slate-50 dark:bg-[#0a1527] border border-slate-200 dark:border-[#162744] text-slate-900 dark:text-white outline-none focus:border-[#00e5ff] text-sm" value={formData.category} onChange={e => setFormData({...formData, category: e.target.value})}>
                  <option value="Bread">Bread</option>
                  <option value="Cake">Cake</option>
                  <option value="Cookies">Cookies</option>
                  <option value="Pastry">Pastry</option>
                  <option value="Sweets">Sweets</option>
                  <option value="Snacks">Snacks</option>
                  <option value="Drinks">Drinks</option>
                  <option value="Other">Other</option>
                </select>
              </div>
              <div className="space-y-2">
                <label className="text-xs font-bold text-slate-400 uppercase px-1">Price (৳) per {formData.unit}</label>
                <input required type="number" step="any" className="w-full p-3.5 rounded-xl bg-slate-50 dark:bg-[#0a1527] border border-slate-200 dark:border-[#162744] text-slate-900 dark:text-white outline-none focus:border-[#00e5ff] text-sm font-bold" value={formData.price} onChange={e => setFormData({...formData, price: e.target.value === '' ? '' : Number(e.target.value)})} placeholder="0.00" />
              </div>
              <div className="space-y-2">
                <label className="text-xs font-bold text-slate-400 uppercase px-1">Stock & Unit</label>
                <div className="flex gap-2">
                  <input required type="number" step="any" className="flex-1 p-3.5 rounded-xl bg-slate-50 dark:bg-[#0a1527] border border-slate-200 dark:border-[#162744] text-slate-900 dark:text-white outline-none focus:border-[#00e5ff] text-sm font-bold" value={formData.stock} onChange={e => setFormData({...formData, stock: e.target.value === '' ? '' : Number(e.target.value)})} placeholder="0" />
                  <select className="w-28 p-3.5 rounded-xl bg-slate-50 dark:bg-[#0a1527] border border-slate-200 dark:border-[#162744] text-slate-900 dark:text-white outline-none focus:border-[#00e5ff] text-sm" value={formData.unit} onChange={e => setFormData({...formData, unit: e.target.value})}>
                    {units.map(u => <option key={u} value={u}>{u}</option>)}
                  </select>
                </div>
              </div>
              {editingId && (
                <div className="space-y-2">
                  <label className="text-xs font-bold text-slate-400 uppercase px-1">Add Stock (+ Quantity)</label>
                  <input type="number" step="any" className="w-full p-3.5 rounded-xl bg-slate-50 dark:bg-[#0a1527] border border-slate-200 dark:border-[#162744] text-slate-900 dark:text-white outline-none focus:border-[#00e5ff] text-sm font-bold" value={formData.addStock} onChange={e => setFormData({...formData, addStock: e.target.value === '' ? '' : Number(e.target.value)})} placeholder="0" />
                </div>
              )}
              <div className="space-y-2 md:col-span-2">
                <label className="text-xs font-bold text-slate-400 uppercase px-1 flex items-center gap-2"><Barcode size={14} className="text-[#00e5ff]" /> Barcode</label>
                <input type="text" className="w-full p-3.5 rounded-xl bg-slate-50 dark:bg-[#0a1527] border border-slate-200 dark:border-[#162744] text-slate-900 dark:text-white outline-none focus:border-[#00e5ff] text-sm" value={formData.barcode} onChange={e => setFormData({...formData, barcode: e.target.value})} placeholder="Optional barcode..." />
              </div>
              <div className="md:col-span-2 flex justify-end gap-3 mt-4">
                <button type="button" onClick={() => {setIsAdding(false); setEditingId(null);}} className="px-6 py-3 text-slate-400 font-semibold hover:text-white transition-colors cursor-pointer text-xs uppercase tracking-wider">Cancel</button>
                <button type="submit" className="smart-cyan-pill px-8 py-3.5 uppercase tracking-wider text-xs cursor-pointer">Save Product</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default Inventory;
