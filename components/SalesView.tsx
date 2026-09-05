import React, { useState, useMemo, useEffect } from 'react';
import { Product, Sale, SaleItem, View, UserProfile } from '../types';
import { generateId } from '../services/idGenerator';
import { 
  ShoppingCart, 
  Trash2, 
  Search, 
  Plus, 
  Minus, 
  Calculator, 
  User, 
  Phone, 
  Check, 
  History, 
  Printer, 
  X, 
  Package, 
  Menu, 
  Wallet, 
  StickyNote, 
  Sun, 
  Moon,
  ChevronDown,
  Sparkles,
  ArrowRight,
  Receipt,
  Boxes,
  Layers,
  AlertTriangle,
  AlertCircle
} from 'lucide-react';

interface CartItem extends SaleItem {
  displayQuantity?: string;
}

interface Props {
  products: Product[];
  sales: Sale[];
  businessProfile?: UserProfile | null;
  onAddSale: (sale: Sale) => void;
  onCancelSale: (saleId: string) => void;
  onNavigateToView?: (view: View) => void;
  onOpenMobileMenu?: () => void;
  theme?: string;
  onToggleTheme?: () => void;
}

const SalesView: React.FC<Props> = ({ 
  products, 
  sales, 
  businessProfile,
  onAddSale, 
  onCancelSale,
  onNavigateToView,
  onOpenMobileMenu,
  theme,
  onToggleTheme
}) => {
  // Navigation & Time states
  const [currentTime, setCurrentTime] = useState<string>('');
  const [activeCategory, setActiveCategory] = useState<string>('ALL');
  const [productSearchTerm, setProductSearchTerm] = useState('');
  const [isProductDropdownOpen, setIsProductDropdownOpen] = useState(false);
  
  // Cart & Checkout states
  const [cart, setCart] = useState<CartItem[]>([]);
  const [paymentMethod, setPaymentMethod] = useState<'Cash' | 'Mobile Payment'>('Cash');
  const [mobileProvider, setMobileProvider] = useState<'bKash' | 'Nagad' | 'Rocket' | 'Upay'>('bKash');
  const [trxId, setTrxId] = useState('');
  const [paidAmount, setPaidAmount] = useState<string>('');
  const [discount, setDiscount] = useState<string>('');
  const [customerName, setCustomerName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  
  // Modals
  const [isHistoryModalOpen, setIsHistoryModalOpen] = useState(false);
  const [receiptSale, setReceiptSale] = useState<Sale | null>(null);
  const [historySearch, setHistorySearch] = useState('');
  const [historyTab, setHistoryTab] = useState<'today' | 'all'>('today');

  // Live Clock (12h format like screenshot 05:32 PM)
  useEffect(() => {
    const updateTime = () => {
      const now = new Date();
      setCurrentTime(now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: true }));
    };
    updateTime();
    const interval = setInterval(updateTime, 1000);
    return () => clearInterval(interval);
  }, []);

  // Categories list
  const categories = useMemo(() => {
    const set = new Set<string>();
    products.forEach(p => {
      if (p.category) set.add(p.category);
    });
    return Array.from(set).sort();
  }, [products]);

  // Category counts
  const categoryCounts = useMemo(() => {
    const map: Record<string, number> = { ALL: products.length };
    products.forEach(p => {
      map[p.category] = (map[p.category] || 0) + 1;
    });
    return map;
  }, [products]);

  // Filtered Products
  const filteredProducts = useMemo(() => {
    let list = products.slice();

    if (activeCategory !== 'ALL') {
      list = list.filter(p => p.category === activeCategory);
    }

    if (productSearchTerm.trim()) {
      const lower = productSearchTerm.toLowerCase();
      list = list.filter(p => 
        p.name.toLowerCase().includes(lower) || 
        p.category.toLowerCase().includes(lower) ||
        (p.id && p.id.toLowerCase().includes(lower))
      ).sort((a, b) => {
        const aName = a.name.toLowerCase();
        const bName = b.name.toLowerCase();
        const aExact = aName === lower;
        const bExact = bName === lower;
        if (aExact && !bExact) return -1;
        if (!aExact && bExact) return 1;
        const aStarts = aName.startsWith(lower);
        const bStarts = bName.startsWith(lower);
        if (aStarts && !bStarts) return -1;
        if (!aStarts && bStarts) return 1;
        return Number(b.id) - Number(a.id);
      });
    } else {
      list.sort((a, b) => a.name.localeCompare(b.name));
    }

    return list;
  }, [products, activeCategory, productSearchTerm]);

  // Handle Add / Select Product
  const handleSelectProduct = (product: Product) => {
    const existingIndex = cart.findIndex(item => item.productId === product.id);
    
    if (existingIndex >= 0) {
      const existingItem = cart[existingIndex];
      if (existingItem.quantity < product.stock) {
        const newCart = [...cart];
        const newQty = existingItem.quantity + 1;
        newCart[existingIndex] = {
          ...existingItem,
          quantity: newQty,
          displayQuantity: newQty.toString(),
          subTotal: newQty * existingItem.pricePerUnit
        };
        setCart(newCart);
      } else {
        alert("Not enough stock!");
      }
    } else {
      if (product.stock > 0) {
        const newItem: CartItem = {
          productId: product.id,
          productName: product.name,
          quantity: 1,
          displayQuantity: '1',
          unit: product.unit,
          pricePerUnit: product.price,
          subTotal: product.price
        };
        setCart(prev => [newItem, ...prev]);
      } else {
        alert("Out of stock!");
      }
    }
  };

  // Update Cart Item Quantity
  const updateCartItemQuantity = (index: number, val: string) => {
    const item = cart[index];
    if (!item) return;

    if (val === '') {
      const newCart = [...cart];
      newCart[index] = {
        ...item,
        quantity: 0,
        displayQuantity: '',
        subTotal: 0
      };
      setCart(newCart);
      return;
    }

    const normalizedVal = val.replace(',', '.');
    if (!/^\d*\.?\d*$/.test(normalizedVal)) return;

    const newQuantity = normalizedVal === '.' ? 0 : parseFloat(normalizedVal);
    if (isNaN(newQuantity) || newQuantity < 0) return;
    
    const product = products.find(p => p.id === item.productId);
    if (product && newQuantity > product.stock) {
      alert(`Only ${product.stock} ${product.unit} available in stock!`);
      return;
    }

    const newCart = [...cart];
    newCart[index] = {
      ...item,
      quantity: newQuantity,
      displayQuantity: normalizedVal,
      subTotal: Math.round(newQuantity * item.pricePerUnit)
    };
    setCart(newCart);
  };

  const handleIncrement = (index: number) => {
    const item = cart[index];
    const product = products.find(p => p.id === item.productId);
    const newQty = item.quantity + 1;
    if (product && newQty > product.stock) {
      alert("Insufficient stock available!");
      return;
    }
    const newCart = [...cart];
    newCart[index] = {
      ...item,
      quantity: newQty,
      displayQuantity: newQty.toString(),
      subTotal: newQty * item.pricePerUnit
    };
    setCart(newCart);
  };

  const handleDecrement = (index: number) => {
    const item = cart[index];
    if (item.quantity <= 1) {
      handleRemoveFromCart(index);
      return;
    }
    const newQty = item.quantity - 1;
    const newCart = [...cart];
    newCart[index] = {
      ...item,
      quantity: newQty,
      displayQuantity: newQty.toString(),
      subTotal: newQty * item.pricePerUnit
    };
    setCart(newCart);
  };

  const handleRemoveFromCart = (index: number) => {
    setCart(prev => prev.filter((_, i) => i !== index));
  };

  const handleClearCart = () => {
    if (cart.length > 0) {
      setCart([]);
      setDiscount('');
      setPaidAmount('');
      setCustomerName('');
      setCustomerPhone('');
    }
  };

  // Calculations
  const subTotal = useMemo(() => {
    return cart.reduce((sum, item) => sum + item.subTotal, 0);
  }, [cart]);

  const discountAmount = parseFloat(discount) || 0;
  const totalBill = Math.max(0, subTotal - discountAmount);

  // Sync paid amount when total bill changes
  useEffect(() => {
    setPaidAmount(totalBill > 0 ? totalBill.toString() : '');
  }, [totalBill]);

  const currentPaid = parseFloat(paidAmount) || 0;
  const currentDue = Math.max(0, totalBill - currentPaid);
  const changeToReturn = currentPaid > totalBill ? currentPaid - totalBill : 0;
  const isDue = currentDue > 0;

  // Validation
  const isFormValid = cart.length > 0 && 
    cart.some(item => item.quantity > 0) && 
    (!isDue || (customerName.trim() !== '' && customerPhone.trim() !== ''));

  // Complete Sale Handler
  const handleCompleteSale = () => {
    const validItems: SaleItem[] = cart
      .filter(item => item.quantity > 0)
      .map(item => {
        const { displayQuantity, ...rest } = item;
        return rest;
      });
      
    if (validItems.length === 0) return;
    if (isDue && (!customerName.trim() || !customerPhone.trim())) {
      alert("Customer name and phone number are required for due sales!");
      return;
    }

    const saleId = generateId('sale');
    const newSale: Sale = {
      id: saleId,
      date: new Date().toISOString(),
      items: validItems,
      totalPrice: totalBill,
      discount: discountAmount,
      amountPaid: Math.min(currentPaid, totalBill),
      dueAmount: currentDue,
      customerName: customerName.trim() || undefined,
      customerPhone: customerPhone.trim() || undefined,
      paymentMethod: paymentMethod,
      mobileProvider: paymentMethod === 'Mobile Payment' ? (mobileProvider === 'bKash' ? 'Bkash' : mobileProvider as any) : undefined,
      transactionId: trxId.trim() || undefined,
      payments: currentPaid > 0 ? [{
        id: generateId('pmt'),
        amount: Math.min(currentPaid, totalBill),
        date: new Date().toISOString(),
        method: paymentMethod
      }] : [],
    };

    onAddSale(newSale);
    
    // Automatically prepare receipt modal
    setReceiptSale(newSale);

    // Reset Form
    setCart([]);
    setProductSearchTerm('');
    setPaidAmount('');
    setDiscount('');
    setCustomerName('');
    setCustomerPhone('');
    setTrxId('');
    setPaymentMethod('Cash');
  };

  // Today Sales count and list
  const todaySales = useMemo(() => {
    const todayStr = new Date().toLocaleDateString();
    return sales.filter(sale => 
      new Date(sale.date).toLocaleDateString() === todayStr
    ).reverse();
  }, [sales]);

  // History search filter
  const filteredHistory = useMemo(() => {
    const targetList = historyTab === 'today' ? todaySales : sales.slice().reverse();
    if (!historySearch.trim()) return targetList;
    const q = historySearch.toLowerCase();
    return targetList.filter(s => 
      s.id.includes(q) ||
      (s.customerName && s.customerName.toLowerCase().includes(q)) ||
      (s.customerPhone && s.customerPhone.includes(q)) ||
      s.items.some(item => item.productName.toLowerCase().includes(q))
    );
  }, [sales, todaySales, historyTab, historySearch]);

  const totalCartCount = useMemo(() => {
    return cart.reduce((acc, item) => acc + (item.quantity > 0 ? 1 : 0), 0);
  }, [cart]);

  // Low stock and Zero stock helpers (matching bakery threshold rules)
  const isProductLowStock = (product?: Product | null) => {
    if (!product) return false;
    const unit = product.unit?.toLowerCase() || 'pcs';
    if (unit === 'kg' || unit === 'ltr') return product.stock <= 1;
    if (unit === 'gm') return product.stock <= 1000;
    return product.stock < 10;
  };

  // Critical and Low-stock cart items detection
  const criticalCartItems = useMemo(() => {
    return cart.map(item => {
      const product = products.find(p => p.id === item.productId);
      const stock = product ? product.stock : 0;
      const isZero = stock <= 0;
      const isLow = isProductLowStock(product);
      const isExceeding = item.quantity > stock;
      return {
        ...item,
        product,
        stock,
        isZero,
        isLow: isZero || isLow,
        isExceeding
      };
    }).filter(c => c.isLow || c.isExceeding);
  }, [cart, products]);

  return (
    <div className="h-full flex flex-col overflow-hidden">
      {/* Top Header Row matching screenshot */}
      <div className="bg-[#050b14] border border-[#162744] rounded-2xl px-4 py-2.5 sm:px-5 sm:py-3 flex items-center justify-between gap-3 shadow-[0_4px_20px_rgba(0,0,0,0.5)] shrink-0 mb-2.5 sm:mb-3">
        {/* Left Side: Menu + Title + Live Clock */}
        <div className="flex items-center gap-3 sm:gap-4">
          <button 
            onClick={() => onOpenMobileMenu && onOpenMobileMenu()}
            className="px-3.5 py-1.5 sm:px-4 sm:py-2 bg-[#071324] hover:bg-[#0c1e38] border border-[#00d2ff]/40 rounded-full text-xs font-black text-white flex items-center gap-2 transition-all cursor-pointer shadow-[0_0_12px_rgba(0,210,255,0.2)]"
            title="Open Menu"
          >
            <Menu size={15} className="text-[#00e5ff]" />
            <span>MENU</span>
          </button>

          <div className="flex items-center gap-2.5">
            <span className="w-2.5 h-2.5 rounded-full bg-[#00e5ff] shadow-[0_0_10px_#00e5ff] animate-pulse"></span>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-sm sm:text-base font-black tracking-wider text-white">
                  SWEET TREATS
                </span>
                <span className="text-[10px] font-black px-2 py-0.5 rounded-md bg-[#00e5ff]/15 text-[#00e5ff] border border-[#00e5ff]/40 uppercase tracking-widest">
                  POS
                </span>
              </div>
              <p className="text-[10px] sm:text-[11px] font-bold text-[#5c7e9f] tracking-wide">
                {currentTime || '00:00 AM'}
              </p>
            </div>
          </div>
        </div>

        {/* Right Side Buttons: Sales History, Dues, Notes, Theme */}
        <div className="flex items-center gap-2">
          <button 
            onClick={() => setIsHistoryModalOpen(true)}
            className="smart-cyan-pill px-3.5 py-2 sm:px-4 sm:py-2 text-xs font-black uppercase tracking-wider flex items-center gap-1.5 cursor-pointer shadow-[0_0_15px_rgba(0,229,255,0.4)]"
            id="btn_pos_sales_history"
          >
            <History size={14} />
            <span className="hidden sm:inline">SALES HISTORY</span>
            <span className="sm:hidden">HISTORY</span>
            <span className="bg-black/30 text-white text-[10px] px-1.5 py-0.5 rounded-full font-extrabold ml-0.5">
              {todaySales.length}
            </span>
          </button>

          {onNavigateToView && (
            <>
              <button 
                onClick={() => onNavigateToView(View.DUES)}
                className="px-3 py-2 bg-[#071324] hover:bg-[#0c1e38] border border-[#162744] hover:border-[#00d2ff]/40 rounded-full text-xs font-bold text-slate-300 hover:text-white flex items-center gap-1.5 transition-all cursor-pointer"
                title="Go to Dues"
              >
                <Wallet size={14} className="text-[#00e5ff]" />
                <span className="hidden md:inline">Dues</span>
              </button>

              <button 
                onClick={() => onNavigateToView(View.NOTES)}
                className="px-3 py-2 bg-[#071324] hover:bg-[#0c1e38] border border-[#162744] hover:border-[#00d2ff]/40 rounded-full text-xs font-bold text-slate-300 hover:text-white flex items-center gap-1.5 transition-all cursor-pointer"
                title="Go to Daily Notes"
              >
                <StickyNote size={14} className="text-[#00e5ff]" />
                <span className="hidden md:inline">Notes</span>
              </button>
            </>
          )}

          {onToggleTheme && (
            <button 
              onClick={onToggleTheme}
              className="p-2 bg-[#071324] hover:bg-[#0c1e38] border border-[#162744] hover:border-[#00d2ff]/40 rounded-full text-[#00e5ff] transition-all cursor-pointer"
              title="Toggle Theme"
            >
              {theme === 'dark' ? <Sun size={15} /> : <Moon size={15} />}
            </button>
          )}
        </div>
      </div>

      {/* Main 2-Column POS Layout (Full viewport height, 0 outer scroll) */}
      <div className="flex-1 min-h-0 grid grid-cols-1 lg:grid-cols-12 gap-3 sm:gap-4 overflow-hidden">
        
        {/* Left Section: Search, Direct Dropdown, Category Pills & Product Catalog Grid */}
        <div className="lg:col-span-7 xl:col-span-8 flex flex-col h-full overflow-hidden space-y-2 sm:space-y-2.5">
          
          {/* Search + Direct Select Bar */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5 shrink-0">
            {/* Search Input matching screenshot */}
            <div className="relative flex-1">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 dark:text-[#4d6b8f]" size={16} />
              <input 
                type="text"
                placeholder="Search product by name, category, or barcode..."
                value={productSearchTerm}
                onChange={(e) => setProductSearchTerm(e.target.value)}
                className="w-full pl-10 pr-9 py-2.5 sm:py-3 bg-[#050b14] border border-[#162744] rounded-2xl text-xs sm:text-sm font-semibold text-white placeholder-[#4d6b8f] outline-none focus:border-[#00e5ff] focus:shadow-[0_0_15px_rgba(0,229,255,0.25)] transition-all"
              />
              {productSearchTerm && (
                <button 
                  onClick={() => setProductSearchTerm('')}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white p-1"
                >
                  <X size={15} />
                </button>
              )}
            </div>

            {/* Select Direct Dropdown */}
            <div className="relative min-w-[160px] sm:w-48 shrink-0">
              <select
                value=""
                onChange={(e) => {
                  const p = products.find(prod => prod.id === e.target.value);
                  if (p) handleSelectProduct(p);
                }}
                className="w-full py-2.5 sm:py-3 px-3.5 bg-[#050b14] border border-[#162744] rounded-2xl text-xs font-bold text-white outline-none focus:border-[#00e5ff] cursor-pointer appearance-none pr-8 shadow-sm"
                style={{ 
                  backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 24 24' stroke='%2300e5ff'%3E%3Cpath stroke-linecap='round' stroke-linejoin='round' stroke-width='2.5' d='M19 9l-7 7-7-7'%3E%3C/path%3E%3C/svg%3E")`, 
                  backgroundRepeat: 'no-repeat', 
                  backgroundPosition: 'right 0.85rem center', 
                  backgroundSize: '1.1em 1.1em' 
                }}
              >
                <option value="" className="bg-[#050b14] text-slate-300">Select Direct...</option>
                {products.slice().sort((a,b) => a.name.localeCompare(b.name)).map(p => {
                  const isZero = p.stock <= 0;
                  const isLow = isProductLowStock(p);
                  const stockLabel = isZero ? '⚠️ CRITICAL (0 Stock)' : isLow ? `⚠️ Low (${p.stock} ${p.unit})` : `${p.stock} ${p.unit}`;
                  return (
                    <option key={p.id} value={p.id} className="bg-[#0a1220] text-white">
                      {p.name} - ৳{p.price} ({stockLabel})
                    </option>
                  );
                })}
              </select>
            </div>
          </div>

          {/* Category Filter Pills (ALL (0), Cake (2), etc.) */}
          <div className="flex items-center gap-2 overflow-x-auto pb-1 custom-scrollbar shrink-0">
            <button 
              onClick={() => setActiveCategory('ALL')}
              className={`px-4 py-1.5 sm:px-5 sm:py-2 rounded-full text-xs font-black uppercase tracking-wider transition-all shrink-0 cursor-pointer ${
                activeCategory === 'ALL'
                  ? 'smart-cyan-pill'
                  : 'bg-[#071324] hover:bg-[#0c1e38] text-slate-400 hover:text-white border border-[#162744]'
              }`}
            >
              ALL {categoryCounts['ALL'] || 0}
            </button>

            {categories.map(cat => (
              <button 
                key={cat}
                onClick={() => setActiveCategory(cat)}
                className={`px-3.5 py-1.5 sm:px-4 sm:py-2 rounded-full text-xs font-bold uppercase tracking-wider transition-all shrink-0 cursor-pointer ${
                  activeCategory === cat
                    ? 'smart-cyan-pill'
                    : 'bg-[#071324] hover:bg-[#0c1e38] text-slate-400 hover:text-white border border-[#162744]'
                }`}
              >
                {cat} ({categoryCounts[cat] || 0})
              </button>
            ))}
          </div>

          {/* Product Catalog Grid Container (Scrolls internally) */}
          <div className="bg-[#050b14] border border-[#162744] rounded-3xl p-3.5 sm:p-4 flex-1 min-h-0 flex flex-col overflow-hidden">
            {filteredProducts.length === 0 ? (
              /* Empty State matching screenshot */
              <div className="flex-1 flex flex-col items-center justify-center text-center py-10">
                <div className="w-14 h-14 bg-[#071324] border border-[#162744] rounded-2xl flex items-center justify-center text-[#00d2ff] mb-3 shadow-[0_0_20px_rgba(0,210,255,0.15)]">
                  <Boxes size={28} className="text-[#00e5ff]" />
                </div>
                <h3 className="text-xs sm:text-sm font-bold text-slate-300 uppercase tracking-wider">
                  NO PRODUCTS FOUND
                </h3>
                <p className="text-[11px] text-[#527196] font-semibold mt-1">
                  Please try changing your search or category filter.
                </p>
                {productSearchTerm && (
                  <button 
                    onClick={() => setProductSearchTerm('')}
                    className="mt-3 text-xs font-bold text-[#00e5ff] hover:underline cursor-pointer"
                  >
                    Clear Search
                  </button>
                )}
              </div>
            ) : (
              /* Products Grid (High Density / Compact for Maximum Visibility) */
              <div className="grid grid-cols-2 min-[380px]:grid-cols-3 sm:grid-cols-4 md:grid-cols-4 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 gap-1.5 sm:gap-2 overflow-y-auto flex-1 min-h-0 pr-1 custom-scrollbar">
                {filteredProducts.map(p => {
                  const cartItem = cart.find(c => c.productId === p.id);
                  const isOutOfStock = p.stock <= 0;
                  const isLowStock = isProductLowStock(p);

                  return (
                    <div 
                      key={p.id}
                      onClick={() => !isOutOfStock && handleSelectProduct(p)}
                      className={`relative bg-[#081222] border rounded-xl p-1.5 sm:p-2 flex flex-col justify-between transition-all duration-150 group select-none ${
                        isOutOfStock 
                          ? 'opacity-60 border-red-500/30 bg-red-950/10 cursor-not-allowed'
                          : cartItem 
                          ? 'border-[#00e5ff] shadow-[0_0_12px_rgba(0,229,255,0.25)] bg-[#0b1b31] cursor-pointer'
                          : isLowStock
                          ? 'border-amber-500/30 hover:border-amber-400/60 hover:bg-[#0e182b] cursor-pointer'
                          : 'border-[#162744] hover:border-[#00e5ff]/50 hover:bg-[#0c1c33] cursor-pointer'
                      }`}
                    >
                      {/* Top Badges */}
                      <div className="flex items-center justify-between gap-1 mb-0.5">
                        <span className="text-[7.5px] sm:text-[8px] font-bold px-1.5 py-0.5 rounded bg-[#050b14] text-[#6b8daf] border border-[#162744] truncate max-w-[55px]">
                          {p.category}
                        </span>
                        <span className={`text-[7.5px] sm:text-[8px] font-black px-1.5 py-0.5 rounded border flex items-center gap-0.5 ${
                          isOutOfStock 
                            ? 'bg-red-500/20 text-red-400 border-red-500/40 animate-pulse'
                            : isLowStock
                            ? 'bg-amber-500/20 text-amber-300 border-amber-500/40'
                            : 'bg-[#00e5ff]/10 text-[#00e5ff] border-[#00e5ff]/30'
                        }`}>
                          {isOutOfStock ? (
                            <>
                              <AlertTriangle size={8} /> CRITICAL (0)
                            </>
                          ) : isLowStock ? (
                            <>
                              <AlertCircle size={8} /> Low: {p.stock}
                            </>
                          ) : (
                            `${p.stock} ${p.unit}`
                          )}
                        </span>
                      </div>

                      {/* Product Name */}
                      <h4 className="font-extrabold text-[11px] sm:text-xs text-white line-clamp-1 leading-tight my-0.5 group-hover:text-[#00e5ff] transition-colors" title={p.name}>
                        {p.name}
                      </h4>

                      {/* Price & Cart Counter */}
                      <div className="mt-0.5 pt-1 border-t border-[#162744] flex items-center justify-between">
                        <div className="text-[11px] sm:text-xs font-black text-[#00e5ff]">
                          ৳{p.price}
                          <span className="text-[8px] text-slate-400 font-normal ml-0.5">/{p.unit}</span>
                        </div>

                        {cartItem ? (
                          <div className="w-4.5 h-4.5 rounded-full bg-[#00e5ff] text-black font-black text-[9.5px] flex items-center justify-center shadow-[0_0_8px_#00e5ff]">
                            {cartItem.quantity}
                          </div>
                        ) : (
                          <div className="w-4.5 h-4.5 rounded-full bg-[#071324] group-hover:bg-[#00e5ff] text-slate-400 group-hover:text-black font-bold flex items-center justify-center transition-all">
                            <Plus size={10} />
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* Right Section: Active Sale / Cart Panel (Matching screenshot exactly, perfectly fitted) */}
        <div className="lg:col-span-5 xl:col-span-4 bg-[#050b14] border border-[#162744] rounded-3xl p-3.5 sm:p-4 flex flex-col h-full overflow-hidden justify-between shadow-[0_10px_35px_rgba(0,0,0,0.6)]">
          
          <div className="flex-1 min-h-0 flex flex-col overflow-hidden">
            {/* Header: ACTIVE SALE + Badge */}
            <div className="flex items-center justify-between pb-2.5 border-b border-[#162744] shrink-0">
              <div className="flex items-center gap-2">
                <ShoppingCart size={18} className="text-[#00e5ff]" />
                <h3 className="text-sm sm:text-base font-black uppercase tracking-wider text-white">
                  ACTIVE SALE
                </h3>
                <span className="px-2 py-0.5 rounded-full bg-[#07192e] border border-[#00d2ff]/40 text-[#00e5ff] text-[10px] font-black">
                  {totalCartCount} items
                </span>
              </div>

              {cart.length > 0 && (
                <button 
                  onClick={handleClearCart}
                  className="text-xs font-bold text-red-400 hover:text-red-300 hover:underline cursor-pointer"
                >
                  Clear Cart
                </button>
              )}
            </div>

            {/* Critical & Low-Stock Visual Alert Banner for Selected Items */}
            {criticalCartItems.length > 0 && (
              <div className="mt-2 p-2.5 rounded-xl bg-red-500/10 border border-red-500/40 text-red-300 text-xs flex items-start gap-2 animate-in fade-in shrink-0">
                <AlertTriangle size={15} className="text-red-400 shrink-0 mt-0.5 animate-bounce" />
                <div className="flex-1 min-w-0">
                  <div className="font-extrabold text-[10px] text-red-400 uppercase tracking-wider flex items-center justify-between gap-1">
                    <span>Critical / Low Stock Alert</span>
                    <span className="text-[9px] px-1.5 py-0.5 rounded bg-red-500/30 text-red-200 font-black">
                      {criticalCartItems.length} {criticalCartItems.length === 1 ? 'item' : 'items'}
                    </span>
                  </div>
                  <p className="text-[10px] text-slate-300 mt-0.5 font-medium leading-snug">
                    {criticalCartItems.map(c => (
                      <span key={c.productId} className="inline-block mr-2">
                        • <strong className="text-white">{c.productName}</strong>: {c.stock <= 0 ? (
                          <span className="text-red-400 font-bold">0 in stock (Critical)</span>
                        ) : (
                          <span className="text-amber-300 font-bold">{c.stock} {c.unit} left</span>
                        )}
                        {c.isExceeding && (
                          <span className="text-red-300 font-bold ml-1">(Qty exceeds stock)</span>
                        )}
                      </span>
                    ))}
                  </p>
                </div>
              </div>
            )}

            {/* Cart Items Area (Scrolls internally) */}
            <div className="flex-1 min-h-0 overflow-y-auto custom-scrollbar py-2 my-1">
              {cart.length === 0 ? (
                /* Empty Cart matching screenshot */
                <div className="h-full flex flex-col items-center justify-center py-6 text-center">
                  <div className="w-12 h-12 bg-[#071324] border border-[#162744] rounded-full flex items-center justify-center text-[#00d2ff] mb-2.5 shadow-[0_0_15px_rgba(0,210,255,0.15)]">
                    <ShoppingCart size={20} className="text-[#00e5ff]" />
                  </div>
                  <h4 className="text-xs sm:text-sm font-bold text-slate-300 uppercase tracking-wide">
                    CART IS EMPTY
                  </h4>
                  <p className="text-[10px] text-[#527196] font-semibold mt-0.5">
                    Select products from the left catalog
                  </p>
                </div>
              ) : (
                /* Cart Items List */
                <div className="space-y-2 pr-1">
                  {cart.map((item, index) => {
                    const product = products.find(p => p.id === item.productId);
                    const stock = product ? product.stock : 0;
                    const isZeroStock = stock <= 0;
                    const isLowStock = isProductLowStock(product);
                    const isExceedingStock = item.quantity > stock;

                    return (
                      <div 
                        key={item.productId}
                        className={`border rounded-2xl p-2.5 flex flex-col gap-1.5 shadow-sm transition-all ${
                          isZeroStock || isExceedingStock
                            ? 'bg-[#150a0f] border-red-500/50 shadow-[0_0_10px_rgba(239,68,68,0.15)]'
                            : isLowStock
                            ? 'bg-[#141009] border-amber-500/40 shadow-[0_0_8px_rgba(245,158,11,0.1)]'
                            : 'bg-[#081222] border-[#162744]'
                        }`}
                      >
                        <div className="flex items-center justify-between gap-2">
                          <div className="flex-1 min-w-0">
                            <h5 className="text-xs font-extrabold text-white truncate">
                              {item.productName}
                            </h5>
                            <p className="text-[9px] text-[#6b8daf] font-semibold">
                              ৳{item.pricePerUnit} / {item.unit}
                            </p>
                          </div>

                          {/* Quantity Controls */}
                          <div className="flex items-center gap-1 bg-[#050b14] border border-[#162744] rounded-full px-1.5 py-0.5">
                            <button 
                              onClick={() => handleDecrement(index)}
                              className="w-4.5 h-4.5 rounded-full bg-[#0b192e] text-[#00e5ff] hover:bg-[#00e5ff] hover:text-black flex items-center justify-center transition-colors cursor-pointer"
                            >
                              <Minus size={10} />
                            </button>
                            <input 
                              type="text"
                              inputMode="decimal"
                              value={item.displayQuantity !== undefined ? item.displayQuantity : item.quantity}
                              onChange={(e) => updateCartItemQuantity(index, e.target.value)}
                              className="w-9 text-center bg-transparent text-white font-black text-[11px] outline-none"
                            />
                            <button 
                              onClick={() => handleIncrement(index)}
                              className="w-4.5 h-4.5 rounded-full bg-[#0b192e] text-[#00e5ff] hover:bg-[#00e5ff] hover:text-black flex items-center justify-center transition-colors cursor-pointer"
                            >
                              <Plus size={10} />
                            </button>
                          </div>

                          {/* Item Total Price */}
                          <div className="text-right min-w-[50px]">
                            <span className="text-xs font-black text-[#00e5ff]">
                              ৳{item.subTotal}
                            </span>
                          </div>

                          {/* Remove Button */}
                          <button 
                            onClick={() => handleRemoveFromCart(index)}
                            className="text-slate-500 hover:text-red-400 p-1 cursor-pointer transition-colors"
                          >
                            <Trash2 size={13} />
                          </button>
                        </div>

                        {/* Critical / Low Stock Alert Badges */}
                        {(isZeroStock || isLowStock || isExceedingStock) && (
                          <div className="flex flex-wrap items-center gap-1 pt-1 border-t border-white/5">
                            {isZeroStock && (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-red-500/20 text-red-400 border border-red-500/50 text-[9px] font-black tracking-wider uppercase animate-pulse">
                                <AlertTriangle size={10} /> Critical: 0 In Stock
                              </span>
                            )}
                            {!isZeroStock && isLowStock && (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-amber-500/20 text-amber-300 border border-amber-500/40 text-[9px] font-black tracking-wider uppercase">
                                <AlertCircle size={10} /> Low Stock: {stock} {item.unit} left
                              </span>
                            )}
                            {isExceedingStock && (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-red-600 text-white font-black text-[9px] tracking-wider uppercase">
                                <AlertTriangle size={10} /> Qty exceeds available ({stock} {item.unit})
                              </span>
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>

          {/* Bottom Calculations & Payment Panel (Matching uploaded screenshot) */}
          <div className="shrink-0 pt-3 border-t border-[#162744] space-y-2.5">
            
            {/* Subtotal Row */}
            <div className="flex justify-between items-center text-xs sm:text-[13px] font-black text-slate-300">
              <span className="tracking-wide">SUBTOTAL (মোট মূল্য)</span>
              <span className="text-sm sm:text-base font-black text-white">৳{subTotal.toLocaleString()}</span>
            </div>

            {/* Discount Row */}
            <div className="flex justify-between items-center text-xs sm:text-[13px] font-black text-slate-300">
              <span className="tracking-wide">DISCOUNT (ছাড়)</span>
              <div className="relative w-28 sm:w-32">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-xs font-bold pointer-events-none">৳</span>
                <input 
                  type="text" 
                  inputMode="decimal"
                  placeholder="0"
                  value={discount}
                  onChange={(e) => setDiscount(e.target.value.replace(',', '.'))}
                  className="w-full px-3 py-1.5 bg-[#050b14] border border-[#162a45] rounded-xl text-center text-xs sm:text-sm font-black text-white outline-none focus:border-[#00e5ff] transition-all"
                />
              </div>
            </div>

            {/* Divider */}
            <div className="border-t border-[#162744]/80 pt-1.5">
              {/* Total Bill Row (Large Neon Cyan Text) */}
              <div className="flex justify-between items-center">
                <span className="text-xs sm:text-sm font-black uppercase tracking-wider text-white">
                  TOTAL BILL (সর্বমোট)
                </span>
                <span className="text-2xl sm:text-3xl font-black text-[#00e5ff] tracking-tight drop-shadow-[0_0_15px_rgba(0,229,255,0.5)]">
                  ৳{totalBill.toLocaleString()}
                </span>
              </div>
            </div>

            {/* Payment Method & Cash Received Row */}
            <div className="grid grid-cols-2 gap-2.5 pt-1">
              {/* Payment Method */}
              <div className="space-y-1">
                <label className="text-[9px] sm:text-[10px] font-black uppercase tracking-wider text-[#5c7e9f] block">
                  PAYMENT METHOD
                </label>
                <div className="grid grid-cols-2 gap-1.5 p-1 bg-[#050b14] border border-[#162a45] rounded-xl">
                  <button 
                    type="button"
                    onClick={() => setPaymentMethod('Cash')}
                    className={`py-1.5 sm:py-2 rounded-lg text-xs font-black transition-all cursor-pointer ${
                      paymentMethod === 'Cash' 
                        ? 'bg-[#00e5ff] text-black shadow-[0_0_12px_rgba(0,229,255,0.4)]' 
                        : 'text-slate-400 hover:text-white bg-transparent'
                    }`}
                  >
                    Cash
                  </button>
                  <button 
                    type="button"
                    onClick={() => setPaymentMethod('Mobile Payment')}
                    className={`py-1.5 sm:py-2 rounded-lg text-xs font-black transition-all cursor-pointer ${
                      paymentMethod === 'Mobile Payment' 
                        ? 'bg-[#00e5ff] text-black shadow-[0_0_12px_rgba(0,229,255,0.4)]' 
                        : 'text-slate-400 hover:text-white bg-transparent'
                    }`}
                  >
                    Mobile
                  </button>
                </div>
              </div>

              {/* Cash Received Input */}
              <div className="space-y-1">
                <div className="flex justify-between items-center">
                  <label className="text-[9px] sm:text-[10px] font-black uppercase tracking-wider text-[#5c7e9f] block">
                    CASH RECEIVED
                  </label>
                  {paidAmount !== totalBill.toString() && (
                    <button 
                      type="button"
                      onClick={() => setPaidAmount(totalBill.toString())}
                      className="text-[9px] text-[#00e5ff] hover:underline font-bold"
                    >
                      FULL
                    </button>
                  )}
                </div>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-xs sm:text-sm font-bold pointer-events-none">৳</span>
                  <input 
                    type="text" 
                    inputMode="decimal"
                    value={paidAmount}
                    onChange={(e) => setPaidAmount(e.target.value.replace(',', '.'))}
                    placeholder="0"
                    className="w-full px-3 py-1.5 sm:py-2 bg-[#050b14] border border-[#162a45] rounded-xl text-center text-xs sm:text-sm font-black text-white outline-none focus:border-[#00e5ff] transition-all"
                  />
                </div>
              </div>
            </div>

            {/* Mobile Provider selector (if Mobile Payment selected) */}
            {paymentMethod === 'Mobile Payment' && (
              <div className="grid grid-cols-2 gap-2 pt-0.5 animate-in fade-in duration-200">
                <select 
                  value={mobileProvider}
                  onChange={(e) => setMobileProvider(e.target.value as any)}
                  className="w-full p-2 bg-[#050b14] border border-[#162a45] rounded-xl text-xs font-bold text-white outline-none focus:border-[#00e5ff] cursor-pointer"
                >
                  <option value="bKash">bKash</option>
                  <option value="Nagad">Nagad</option>
                  <option value="Rocket">Rocket</option>
                  <option value="Upay">Upay</option>
                </select>
                <input 
                  type="text" 
                  placeholder="TrxID / Ref (Optional)"
                  value={trxId}
                  onChange={(e) => setTrxId(e.target.value)}
                  className="w-full p-2 bg-[#050b14] border border-[#162a45] rounded-xl text-xs font-bold text-white placeholder-slate-500 outline-none focus:border-[#00e5ff]"
                />
              </div>
            )}

            {/* Change or Due Display */}
            {changeToReturn > 0 && (
              <div className="flex justify-between items-center p-2 bg-emerald-500/10 border border-emerald-500/30 rounded-xl text-xs font-black text-emerald-400">
                <span>Change to Return:</span>
                <span className="text-xs sm:text-sm">৳{changeToReturn.toLocaleString()}</span>
              </div>
            )}

            {isDue && (
              <div className="p-2 bg-red-500/10 border border-red-500/30 rounded-xl space-y-1.5 animate-in fade-in duration-200">
                <div className="flex justify-between items-center text-xs font-black text-red-400">
                  <span>Due Amount:</span>
                  <span className="text-xs sm:text-sm">৳{currentDue.toLocaleString()}</span>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <input 
                    type="text" 
                    placeholder="Customer Name *"
                    value={customerName}
                    onChange={(e) => setCustomerName(e.target.value)}
                    className="w-full p-1.5 bg-[#050b14] border border-red-500/40 rounded-lg text-xs font-bold text-white outline-none focus:border-[#00e5ff]"
                  />
                  <input 
                    type="text" 
                    placeholder="Phone Number *"
                    value={customerPhone}
                    onChange={(e) => setCustomerPhone(e.target.value)}
                    className="w-full p-1.5 bg-[#050b14] border border-red-500/40 rounded-lg text-xs font-bold text-white outline-none focus:border-[#00e5ff]"
                  />
                </div>
              </div>
            )}

            {/* CTA Button matching screenshot: COMPLETE SALE (৳0) */}
            <button 
              onClick={handleCompleteSale}
              disabled={!isFormValid}
              className="w-full py-3.5 px-4 rounded-2xl sm:rounded-3xl bg-gradient-to-r from-[#003847] via-[#005566] to-[#003847] hover:from-[#004e63] hover:to-[#004e63] border border-[#00d2ff]/40 text-[#00e5ff] text-xs sm:text-sm font-black uppercase tracking-wider flex items-center justify-center gap-2.5 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer shadow-[0_0_20px_rgba(0,210,255,0.25)] hover:shadow-[0_0_25px_rgba(0,229,255,0.45)] transition-all"
              id="btn_complete_sale"
            >
              <ShoppingCart size={17} className="text-[#00e5ff]" />
              <span>COMPLETE SALE (৳{totalBill.toLocaleString()})</span>
            </button>
          </div>
        </div>
      </div>

      {/* SALES HISTORY MODAL */}
      {isHistoryModalOpen && (
        <div className="fixed inset-0 z-[250] flex items-center justify-center p-4 bg-black/85 backdrop-blur-md animate-in fade-in duration-200">
          <div className="bg-[#0a1220] border border-[#162744] rounded-[2rem] w-full max-w-4xl max-h-[85vh] flex flex-col shadow-[0_20px_60px_rgba(0,0,0,0.9)] overflow-hidden">
            
            {/* Modal Header */}
            <div className="p-6 border-b border-[#162744] flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-[#071324] border border-[#00d2ff]/40 rounded-xl flex items-center justify-center text-[#00e5ff] shadow-[0_0_15px_rgba(0,210,255,0.3)]">
                  <History size={20} />
                </div>
                <div>
                  <h3 className="text-lg font-black text-white">Sales History</h3>
                  <p className="text-xs text-[#5c7e9f] font-semibold">Detailed list of today and previous sales</p>
                </div>
              </div>
              <button 
                onClick={() => setIsHistoryModalOpen(false)}
                className="p-2 text-slate-400 hover:text-white transition-colors cursor-pointer"
              >
                <X size={20} />
              </button>
            </div>

            {/* Filter Tabs & Search */}
            <div className="p-4 px-6 bg-[#050b14] border-b border-[#162744] flex flex-col sm:flex-row items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <button 
                  onClick={() => setHistoryTab('today')}
                  className={`px-4 py-2 rounded-full text-xs font-bold transition-all cursor-pointer ${
                    historyTab === 'today' ? 'smart-cyan-pill' : 'bg-[#0a1220] text-slate-400 hover:text-white border border-[#162744]'
                  }`}
                >
                  Today ({todaySales.length})
                </button>
                <button 
                  onClick={() => setHistoryTab('all')}
                  className={`px-4 py-2 rounded-full text-xs font-bold transition-all cursor-pointer ${
                    historyTab === 'all' ? 'smart-cyan-pill' : 'bg-[#0a1220] text-slate-400 hover:text-white border border-[#162744]'
                  }`}
                >
                  All Records ({sales.length})
                </button>
              </div>

              <div className="relative w-full sm:w-64">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={14} />
                <input 
                  type="text"
                  placeholder="Search invoice or customer..."
                  value={historySearch}
                  onChange={(e) => setHistorySearch(e.target.value)}
                  className="w-full pl-9 pr-3 py-1.5 bg-[#0a1220] border border-[#162744] rounded-full text-xs font-semibold text-white outline-none focus:border-[#00e5ff]"
                />
              </div>
            </div>

            {/* Sales Table Content */}
            <div className="flex-1 overflow-y-auto p-4 px-6 custom-scrollbar">
              {filteredHistory.length === 0 ? (
                <div className="py-16 text-center text-slate-400 font-bold text-sm">
                  No sales records found
                </div>
              ) : (
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="border-b border-[#162744] text-[11px] font-black text-[#5c7e9f] uppercase tracking-wider">
                      <th className="py-3 px-2">Time / Date</th>
                      <th className="py-3 px-2">Items & Customer</th>
                      <th className="py-3 px-2">Method</th>
                      <th className="py-3 px-2">Total</th>
                      <th className="py-3 px-2">Paid / Due</th>
                      <th className="py-3 px-2 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#162744]/60">
                    {filteredHistory.map(sale => (
                      <tr key={sale.id} className="hover:bg-[#0c182c] transition-colors text-xs font-semibold">
                        <td className="py-3 px-2 text-slate-300">
                          <div>{new Date(sale.date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</div>
                          <div className="text-[10px] text-slate-500">{new Date(sale.date).toLocaleDateString()}</div>
                        </td>
                        <td className="py-3 px-2">
                          <div className="font-bold text-white">
                            {sale.items[0]?.productName} {sale.items.length > 1 ? `+${sale.items.length - 1} more` : ''}
                          </div>
                          <div className="text-[11px] text-[#5c7e9f]">
                            {sale.customerName ? `${sale.customerName} (${sale.customerPhone || ''})` : 'Walk-in Customer'}
                          </div>
                        </td>
                        <td className="py-3 px-2">
                          <span className="px-2 py-0.5 rounded-full bg-[#071324] border border-[#162744] text-[10px] text-[#00e5ff]">
                            {sale.paymentMethod || 'Cash'}
                          </span>
                        </td>
                        <td className="py-3 px-2 font-black text-white">
                          ৳{sale.totalPrice}
                          {sale.discount ? <span className="text-[10px] text-amber-400 ml-1">(-৳{sale.discount})</span> : null}
                        </td>
                        <td className="py-3 px-2">
                          <div className="text-emerald-400 font-bold">Paid: ৳{sale.amountPaid}</div>
                          {sale.dueAmount > 0 && (
                            <div className="text-red-400 text-[10px] font-black">Due: ৳{sale.dueAmount}</div>
                          )}
                        </td>
                        <td className="py-3 px-2 text-right space-x-1.5">
                          <button 
                            onClick={() => setReceiptSale(sale)}
                            className="p-1.5 bg-[#071324] hover:bg-[#0c1e38] text-[#00e5ff] border border-[#162744] rounded-lg transition-colors cursor-pointer"
                            title="View / Print Receipt"
                          >
                            <Printer size={14} />
                          </button>
                          <button 
                            onClick={() => {
                              if (confirm("Are you sure you want to cancel this sale and restore stock?")) {
                                onCancelSale(sale.id);
                              }
                            }}
                            className="p-1.5 bg-[#071324] hover:bg-red-500/20 text-red-400 border border-[#162744] rounded-lg transition-colors cursor-pointer"
                            title="Cancel Sale"
                          >
                            <Trash2 size={14} />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>

            {/* Modal Footer */}
            <div className="p-4 px-6 border-t border-[#162744] flex justify-end">
              <button 
                onClick={() => setIsHistoryModalOpen(false)}
                className="smart-cyan-pill px-8 py-2.5 text-xs font-bold uppercase cursor-pointer"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* THERMAL RECEIPT PRINT MODAL */}
      {receiptSale && (
        <div className="fixed inset-0 z-[300] flex items-center justify-center p-4 bg-black/90 backdrop-blur-md animate-in fade-in duration-200">
          <div className="bg-white text-black rounded-2xl w-full max-w-sm overflow-hidden shadow-2xl p-6 font-mono text-xs animate-in zoom-in-95 duration-200">
            {/* Printable Receipt */}
            <div id="printable-pos-receipt" className="space-y-3 text-center">
              <div className="border-b-2 border-black pb-2">
                <h2 className="text-base font-black uppercase tracking-wider">{businessProfile?.businessName || 'SWEET TREATS BAKERY'}</h2>
                {businessProfile?.address && <p className="text-[10px] text-gray-700">{businessProfile.address}</p>}
                <p className="text-[10px] text-gray-700">{businessProfile?.phone ? `Phone: ${businessProfile.phone}` : 'Smart POS Terminal'}</p>
              </div>

              <div className="text-left text-[10px] space-y-0.5 border-b border-dashed border-gray-400 pb-2">
                <div>Invoice #: {receiptSale.id.slice(-8).toUpperCase()}</div>
                <div>Date: {new Date(receiptSale.date).toLocaleString()}</div>
                {receiptSale.customerName && <div>Customer: {receiptSale.customerName} ({receiptSale.customerPhone})</div>}
                <div>Payment: {receiptSale.paymentMethod || 'Cash'}</div>
              </div>

              {/* Items */}
              <table className="w-full text-left text-[10px] border-b border-dashed border-gray-400 pb-2">
                <thead>
                  <tr className="border-b border-black font-bold">
                    <th className="py-1">Item</th>
                    <th className="py-1 text-center">Qty</th>
                    <th className="py-1 text-right">Price</th>
                    <th className="py-1 text-right">Total</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {receiptSale.items.map((it, idx) => (
                    <tr key={idx} className="py-1">
                      <td className="py-1 font-bold">{it.productName}</td>
                      <td className="py-1 text-center">{it.quantity}</td>
                      <td className="py-1 text-right">{businessProfile?.currencySymbol || '৳'}{it.pricePerUnit}</td>
                      <td className="py-1 text-right font-bold">{businessProfile?.currencySymbol || '৳'}{it.subTotal}</td>
                    </tr>
                  ))}
                </tbody>
              </table>

              {/* Totals */}
              <div className="space-y-1 text-right text-[11px] pt-1">
                <div className="flex justify-between">
                  <span>Subtotal:</span>
                  <span>{businessProfile?.currencySymbol || '৳'}{(receiptSale.totalPrice + (receiptSale.discount || 0)).toFixed(0)}</span>
                </div>
                {receiptSale.discount ? (
                  <div className="flex justify-between text-red-600">
                    <span>Discount:</span>
                    <span>-{businessProfile?.currencySymbol || '৳'}{receiptSale.discount}</span>
                  </div>
                ) : null}
                <div className="flex justify-between font-black text-sm border-t border-black pt-1">
                  <span>Total Bill:</span>
                  <span>{businessProfile?.currencySymbol || '৳'}{receiptSale.totalPrice}</span>
                </div>
                <div className="flex justify-between">
                  <span>Paid:</span>
                  <span>{businessProfile?.currencySymbol || '৳'}{receiptSale.amountPaid}</span>
                </div>
                {receiptSale.dueAmount > 0 && (
                  <div className="flex justify-between font-bold text-red-600">
                    <span>Due:</span>
                    <span>{businessProfile?.currencySymbol || '৳'}{receiptSale.dueAmount}</span>
                  </div>
                )}
              </div>

              <div className="border-t-2 border-black pt-3 text-center space-y-1">
                <p className="font-bold text-[11px]">Thank You For Visiting!</p>
                <p className="text-[9px] text-gray-600">{businessProfile?.receiptFooter || 'Please visit again • Smart Bakery POS'}</p>
              </div>
            </div>

            {/* Action buttons */}
            <div className="mt-6 pt-4 border-t border-gray-200 flex gap-2 no-print">
              <button 
                onClick={() => window.print()}
                className="flex-1 bg-black text-white py-2.5 rounded-xl font-bold flex items-center justify-center gap-1.5 hover:bg-gray-800 transition-colors cursor-pointer"
              >
                <Printer size={15} /> Print
              </button>
              <button 
                onClick={() => setReceiptSale(null)}
                className="flex-1 bg-gray-200 text-gray-800 py-2.5 rounded-xl font-bold hover:bg-gray-300 transition-colors cursor-pointer"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default SalesView;
