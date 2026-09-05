
import React, { useMemo } from 'react';
import { Product, Sale, Expense, DailyClosing, Wastage, Production } from '../types';
import { 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  PieChart,
  Pie,
  Cell
} from 'recharts';
import { 
  ShoppingCart, 
  Package, 
  ReceiptIndianRupee, 
  TrendingUp, 
  UtensilsCrossed, 
  Monitor, 
  CalendarDays, 
  Clock, 
  PieChart as PieChartIcon,
  Layers,
  ArrowUpRight,
  ShieldAlert,
  Boxes
} from 'lucide-react';

interface Props {
  products: Product[];
  sales: Sale[];
  expenses: Expense[];
  wastage?: Wastage[];
  closings?: DailyClosing[];
  production?: Production[];
}

const Dashboard: React.FC<Props> = ({ products = [], sales = [], expenses = [], wastage = [], closings = [], production = [] }) => {
  const now = new Date();
  const currentMonth = now.getMonth();
  const currentYear = now.getFullYear();

  const lastClosingTimestamp = useMemo(() => {
    if (!closings || closings.length === 0) return 0;
    return Math.max(...closings.map(c => new Date(c.timestamp).getTime()));
  }, [closings]);

  const monthlyStats = useMemo(() => {
    const mSales = sales.filter(s => {
      const d = new Date(s.date);
      return d.getMonth() === currentMonth && d.getFullYear() === currentYear;
    });
    const mExpenses = expenses.filter(e => {
      const d = new Date(e.date);
      return d.getMonth() === currentMonth && d.getFullYear() === currentYear;
    });

    const totalSales = mSales.reduce((acc, s) => acc + (s.totalPrice || 0), 0);
    
    const totalCash = sales.reduce((acc, s) => {
      if (s.payments && s.payments.length > 0) {
        return acc + s.payments.filter(p => {
          const d = new Date(p.date);
          return d.getMonth() === currentMonth && d.getFullYear() === currentYear;
        }).reduce((sum, p) => sum + p.amount, 0);
      } else {
        const d = new Date(s.date);
        if (d.getMonth() === currentMonth && d.getFullYear() === currentYear) {
          return acc + (s.amountPaid || 0);
        }
        return acc;
      }
    }, 0);

    const totalExp = mExpenses.reduce((acc, e) => acc + (e.amount || 0), 0);
    const totalDiscounts = mSales.reduce((acc, s) => acc + (s.discount || 0), 0);

    const mProduction = production.filter(p => {
      const d = new Date(p.date);
      return d.getMonth() === currentMonth && d.getFullYear() === currentYear;
    });
    const totalProduction = mProduction.reduce((acc, p) => acc + p.totalValue, 0);

    return {
      salesVolume: totalSales,
      cashCollected: totalCash,
      expenses: totalExp,
      discounts: totalDiscounts,
      balance: totalCash - totalExp,
      production: totalProduction
    };
  }, [sales, expenses, production, currentMonth, currentYear]);

  const activeSessionStats = useMemo(() => {
    const activeSales = sales.filter(s => new Date(s.date).getTime() > lastClosingTimestamp);
    const activeExpenses = expenses.filter(e => new Date(e.date).getTime() > lastClosingTimestamp);
    const activeProduction = production.filter(p => new Date(p.date).getTime() > lastClosingTimestamp);
    
    const totalSalesVolume = activeSales.reduce((acc, s) => acc + (s.totalPrice || 0), 0);
    
    const totalCashCollected = sales.reduce((acc, s) => {
      if (s.payments && s.payments.length > 0) {
        return acc + s.payments.filter(p => new Date(p.date).getTime() > lastClosingTimestamp).reduce((sum, p) => sum + p.amount, 0);
      } else {
        if (new Date(s.date).getTime() > lastClosingTimestamp) {
          return acc + (s.amountPaid || 0);
        }
        return acc;
      }
    }, 0);

    const totalExpenses = activeExpenses.reduce((acc, e) => acc + (e.amount || 0), 0);
    const totalProduction = activeProduction.reduce((acc, p) => acc + p.totalValue, 0);
    const totalDiscounts = activeSales.reduce((acc, s) => acc + (s.discount || 0), 0);
    
    return {
      salesVolume: totalSalesVolume,
      cashCollected: totalCashCollected,
      expenses: totalExpenses,
      discounts: totalDiscounts,
      mainBalance: totalCashCollected - totalExpenses,
      production: totalProduction
    };
  }, [sales, expenses, production, lastClosingTimestamp]);

  const productPulse = useMemo(() => {
    const pulse = new Map<string, { 
      name: string, 
      produced: number, 
      sold: number, 
      wasted: number,
      stock: number,
      unit: string
    }>();

    // Initialize with all products
    products.forEach(p => {
      pulse.set(p.id, {
        name: p.name,
        produced: 0,
        sold: 0,
        wasted: 0,
        stock: p.stock,
        unit: p.unit
      });
    });

    // Add Production today
    production.filter(p => new Date(p.date).getTime() > lastClosingTimestamp).forEach(p => {
      const entry = pulse.get(p.productId);
      if (entry) entry.produced += p.quantity;
    });

    // Add Sales today
    sales.filter(s => new Date(s.date).getTime() > lastClosingTimestamp).forEach(sale => {
      sale.items.forEach(item => {
        const entry = pulse.get(item.productId);
        if (entry) entry.sold += item.quantity;
      });
    });

    // Add Wastage today
    if (wastage) {
        wastage.filter(w => new Date(w.date).getTime() > lastClosingTimestamp).forEach(w => {
        const entry = pulse.get(w.productId);
        if (entry) entry.wasted += w.quantity;
        });
    }

    return Array.from(pulse.values()).filter(p => p.produced > 0 || p.sold > 0 || p.wasted > 0 || p.stock < 10);
  }, [products, production, sales, wastage, lastClosingTimestamp]);

  const last7Days = useMemo(() => {
    return [...Array(7)].map((_, i) => {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const dateStr = d.toISOString().split('T')[0];
      const daySales = sales
        .filter(s => s.date.startsWith(dateStr))
        .reduce((acc, curr) => acc + (curr.totalPrice || 0), 0);
      return { 
        name: d.toLocaleDateString([], { month: 'numeric', day: 'numeric' }), 
        sales: daySales 
      };
    }).reverse();
  }, [sales]);

  const topSellingProducts = useMemo(() => {
    const productSales = new Map<string, { name: string, quantity: number, revenue: number }>();
    
    sales.forEach(sale => {
      sale.items.forEach(item => {
        const current = productSales.get(item.productId) || { name: item.productName, quantity: 0, revenue: 0 };
        productSales.set(item.productId, {
          name: item.productName,
          quantity: current.quantity + item.quantity,
          revenue: current.revenue + (item.price * item.quantity)
        });
      });
    });

    return Array.from(productSales.values())
      .sort((a, b) => b.revenue - a.revenue)
      .slice(0, 5);
  }, [sales]);

  const salesByCategory = useMemo(() => {
    const categorySales = new Map<string, number>();
    sales.forEach(sale => {
      sale.items.forEach(item => {
        const current = categorySales.get(item.category || 'Other') || 0;
        categorySales.set(item.category || 'Other', current + (item.price * item.quantity));
      });
    });
    return Array.from(categorySales.entries()).map(([name, value]) => ({ name, value }));
  }, [sales]);

  const COLORS = ['#00e5ff', '#3b82f6', '#8b5cf6', '#10b981', '#06b6d4', '#f59e0b'];

  return (
    <div className="space-y-4 md:space-y-6 animate-in fade-in duration-500 pb-8">
      {/* Top Banner Row in POS Cyan/Obsidian Styling */}
      <div className="bg-[#050b14] p-5 sm:p-7 rounded-3xl border border-[#162744] shadow-[0_4px_25px_rgba(0,0,0,0.6)] flex flex-col md:flex-row items-center justify-between gap-4">
        <div className="flex items-center gap-4 text-center md:text-left">
          <div className="w-12 h-12 md:w-14 md:h-14 bg-[#0a1527] border border-[#00d2ff]/40 rounded-2xl flex items-center justify-center shadow-[0_0_20px_rgba(0,210,255,0.3)]">
            <UtensilsCrossed size={24} className="text-[#00e5ff]" />
          </div>
          <div>
            <div className="flex items-center justify-center md:justify-start gap-2.5">
              <h1 className="text-xl sm:text-2xl md:text-3xl font-black text-white tracking-tight">
                SWEET TREATS
              </h1>
              <span className="text-[10px] font-black px-2.5 py-0.5 rounded-md bg-[#00e5ff]/15 text-[#00e5ff] border border-[#00e5ff]/40 uppercase tracking-widest">
                DASHBOARD
              </span>
            </div>
            <p className="text-[#5c7e9f] font-bold uppercase tracking-[0.2em] text-[9px] sm:text-[10px] mt-0.5">
              Bakery Business Intelligence & Operations
            </p>
          </div>
        </div>

        <div className="bg-[#071324] px-4 py-2.5 rounded-2xl border border-[#162744] flex items-center gap-2.5 shadow-sm">
          <CalendarDays size={16} className="text-[#00e5ff]" />
          <span className="text-xs sm:text-sm font-extrabold text-white">
            {now.toLocaleString('default', { month: 'long', year: 'numeric' })}
          </span>
          <span className="w-2 h-2 rounded-full bg-[#00e5ff] shadow-[0_0_8px_#00e5ff] animate-pulse ml-1"></span>
        </div>
      </div>

      {/* Quick Actions Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4">
        <QuickAction 
          icon={<ShoppingCart size={20} />} 
          label="New Sale (POS)" 
          subLabel="Point of Sale" 
          onClick={() => (window as any).navigateToView('SALES')} 
          glowColor="rgba(0,229,255,0.35)"
          accentText="text-[#00e5ff]"
        />
        <QuickAction 
          icon={<Package size={20} />} 
          label="Inventory" 
          subLabel="Stock & Products" 
          onClick={() => (window as any).navigateToView('INVENTORY')} 
          glowColor="rgba(59,130,246,0.35)"
          accentText="text-blue-400"
        />
        <QuickAction 
          icon={<ReceiptIndianRupee size={20} />} 
          label="Expenses" 
          subLabel="Record Costs" 
          onClick={() => (window as any).navigateToView('EXPENSES')} 
          glowColor="rgba(239,68,68,0.35)"
          accentText="text-red-400"
        />
        <QuickAction 
          icon={<Monitor size={20} />} 
          label="Daily Closing" 
          subLabel="End of Day Audit" 
          onClick={() => (window as any).navigateToView('DAILY_CLOSING')} 
          glowColor="rgba(16,185,129,0.35)"
          accentText="text-emerald-400"
        />
      </div>

      {/* Monthly Stats Section */}
      <div>
        <div className="flex items-center gap-2 mb-3 px-1">
          <TrendingUp size={16} className="text-[#00e5ff]" />
          <h3 className="text-xs font-black text-[#5c7e9f] uppercase tracking-widest">
            Monthly Overview
          </h3>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3 sm:gap-4">
          <StatCard title="Monthly Sales" value={monthlyStats.salesVolume} type="sales" subLabel="Total Gross Sales" />
          <StatCard title="Total Collected" value={monthlyStats.cashCollected} type="revenue" subLabel="Cash & Digital Received" />
          <StatCard title="Monthly Production" value={monthlyStats.production} type="production" subLabel="Total Production Value" />
          <StatCard title="Total Discounts" value={monthlyStats.discounts} type="discount" subLabel="Discounts Given" />
          <StatCard title="Monthly Expenses" value={monthlyStats.expenses} type="expense" subLabel="Total Costs" />
        </div>
      </div>

      {/* Today's Active Session & Trend Chart Section */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 sm:gap-5">
        {/* Today's Active Session Panel */}
        <div className="lg:col-span-5 bg-[#050b14] p-5 sm:p-6 rounded-3xl border border-[#162744] shadow-[0_10px_35px_rgba(0,0,0,0.5)] flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between pb-4 border-b border-[#162744] mb-4">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl bg-[#081527] border border-[#00d2ff]/40 flex items-center justify-center text-[#00e5ff] shadow-[0_0_10px_rgba(0,210,255,0.2)]">
                  <Clock size={16} />
                </div>
                <h3 className="text-sm sm:text-base font-black uppercase tracking-wider text-white">
                  Today's Session
                </h3>
              </div>
              <span className="text-[10px] font-black px-2.5 py-1 rounded-full bg-[#07192e] border border-[#00d2ff]/40 text-[#00e5ff]">
                ACTIVE
              </span>
            </div>

            <div className="space-y-2.5">
              <div className="flex justify-between items-center p-3.5 bg-[#081222] border border-[#162744] rounded-2xl">
                <div>
                  <span className="text-[10px] text-[#6b8daf] font-bold uppercase tracking-wider block">Cash in Hand</span>
                  <span className="text-[11px] text-slate-400">Total Collected - Expenses</span>
                </div>
                <span className="text-base sm:text-lg font-black text-emerald-400">
                  ৳{activeSessionStats.mainBalance.toLocaleString()}
                </span>
              </div>

              <div className="flex justify-between items-center p-3.5 bg-[#081222] border border-[#162744] rounded-2xl">
                <div>
                  <span className="text-[10px] text-[#6b8daf] font-bold uppercase tracking-wider block">Daily Production</span>
                  <span className="text-[11px] text-slate-400">Production Value</span>
                </div>
                <span className="text-base sm:text-lg font-black text-[#00e5ff]">
                  ৳{activeSessionStats.production.toLocaleString()}
                </span>
              </div>

              <div className="flex justify-between items-center p-3.5 bg-[#081222] border border-[#162744] rounded-2xl">
                <div>
                  <span className="text-[10px] text-[#6b8daf] font-bold uppercase tracking-wider block">Session Discount</span>
                  <span className="text-[11px] text-slate-400">Total Discounts Given</span>
                </div>
                <span className="text-base sm:text-lg font-black text-red-400">
                  ৳{activeSessionStats.discounts.toLocaleString()}
                </span>
              </div>

              <div className="flex justify-between items-center p-3.5 bg-[#081222] border border-[#162744] rounded-2xl">
                <div>
                  <span className="text-[10px] text-[#6b8daf] font-bold uppercase tracking-wider block">Daily Sales</span>
                  <span className="text-[11px] text-slate-400">Gross Sales Value</span>
                </div>
                <span className="text-base sm:text-lg font-black text-white">
                  ৳{activeSessionStats.salesVolume.toLocaleString()}
                </span>
              </div>
            </div>
          </div>

          <div className="mt-4 pt-3 border-t border-[#162744] flex items-center justify-between text-[11px] text-[#5c7e9f]">
            <span>Last Closing Status:</span>
            <span className="text-slate-300 font-semibold">
              {lastClosingTimestamp ? new Date(lastClosingTimestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'No closings yet'}
            </span>
          </div>
        </div>

        {/* Weekly Sales Trend Chart */}
        <div className="lg:col-span-7 bg-[#050b14] p-5 sm:p-6 rounded-3xl border border-[#162744] shadow-[0_10px_35px_rgba(0,0,0,0.5)] flex flex-col justify-between">
          <div className="flex items-center justify-between mb-4 pb-3 border-b border-[#162744]">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-xl bg-[#081527] border border-[#00d2ff]/40 flex items-center justify-center text-[#00e5ff]">
                <TrendingUp size={16} />
              </div>
              <h3 className="text-sm sm:text-base font-black uppercase tracking-wider text-white">
                Weekly Sales Trend
              </h3>
            </div>
            <span className="text-[10px] font-black uppercase tracking-widest bg-[#071324] border border-[#162744] text-[#00e5ff] px-3 py-1 rounded-full">
              Last 7 Days
            </span>
          </div>

          <div className="h-64 sm:h-72 w-full pt-2">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={last7Days}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#162744" />
                <XAxis dataKey="name" stroke="#5c7e9f" fontSize={11} tickLine={false} axisLine={false} />
                <YAxis stroke="#5c7e9f" fontSize={11} tickLine={false} axisLine={false} />
                <Tooltip 
                  contentStyle={{ 
                    backgroundColor: '#050b14', 
                    borderColor: '#00e5ff', 
                    borderRadius: '16px', 
                    fontSize: '12px',
                    color: '#fff',
                    boxShadow: '0 0 15px rgba(0,229,255,0.3)'
                  }} 
                  itemStyle={{ color: '#00e5ff', fontWeight: 800 }}
                  formatter={(value: any) => [`৳${Number(value).toLocaleString()}`, 'Sales']}
                />
                <Line 
                  type="monotone" 
                  dataKey="sales" 
                  stroke="#00e5ff" 
                  strokeWidth={3.5} 
                  dot={{ fill: '#00e5ff', r: 4, strokeWidth: 2, stroke: '#050b14' }} 
                  activeDot={{ r: 6, fill: '#ffffff', stroke: '#00e5ff', strokeWidth: 3 }}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Daily Pulse Section */}
      <div className="bg-[#050b14] rounded-3xl border border-[#162744] shadow-[0_10px_35px_rgba(0,0,0,0.5)] overflow-hidden">
        <div className="p-4 sm:p-5 border-b border-[#162744] flex items-center justify-between flex-wrap gap-3 bg-[#081222]/50">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-[#0a1527] border border-[#00d2ff]/40 rounded-2xl text-[#00e5ff] shadow-[0_0_12px_rgba(0,210,255,0.2)]">
              <Boxes size={20} />
            </div>
            <div>
              <h3 className="text-sm sm:text-base font-black text-white uppercase tracking-tight">
                Daily Production & Sales Pulse
              </h3>
              <p className="text-[9px] sm:text-[10px] font-bold text-[#5c7e9f] uppercase tracking-wider">
                Live Daily Production, Sales & Stock Tracking
              </p>
            </div>
          </div>
          <div className="flex gap-2">
            <div className="px-2.5 py-1 bg-[#07192e] text-[#00e5ff] text-[10px] font-black rounded-lg uppercase tracking-wider border border-[#00d2ff]/40 flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 bg-[#00e5ff] rounded-full animate-pulse" />
              Made
            </div>
            <div className="px-2.5 py-1 bg-emerald-500/10 text-emerald-400 text-[10px] font-black rounded-lg uppercase tracking-wider border border-emerald-500/30 flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 bg-emerald-400 rounded-full animate-pulse" />
              Sold
            </div>
            <div className="px-2.5 py-1 bg-[#071324] text-slate-300 text-[10px] font-black rounded-lg uppercase tracking-wider border border-[#162744] flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 bg-slate-400 rounded-full" />
              Stock
            </div>
          </div>
        </div>
        
        {/* Desktop Table View */}
        <div className="hidden md:block overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-[#081222] border-b border-[#162744]">
                <th className="px-6 py-3 text-[10px] font-black uppercase text-[#6b8daf]">Product Name</th>
                <th className="px-6 py-3 text-[10px] font-black uppercase text-[#6b8daf]">Made Today</th>
                <th className="px-6 py-3 text-[10px] font-black uppercase text-[#6b8daf]">Sold Today</th>
                <th className="px-6 py-3 text-[10px] font-black uppercase text-[#6b8daf]">Wastage</th>
                <th className="px-6 py-3 text-[10px] font-black uppercase text-[#6b8daf]">Current Stock</th>
                <th className="px-6 py-3 text-[10px] font-black uppercase text-[#6b8daf] text-right">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#162744]">
              {productPulse.length === 0 ? (
                <tr>
                  <td colSpan={6} className="p-10 text-center text-[#5c7e9f] font-bold uppercase tracking-widest text-xs">
                    No activity recorded in the current session.
                  </td>
                </tr>
              ) : (
                productPulse.map((p, idx) => (
                  <tr key={idx} className="hover:bg-[#081527] transition-colors group">
                    <td className="px-6 py-3.5">
                      <div className="font-extrabold text-white text-xs sm:text-sm group-hover:text-[#00e5ff] transition-colors">
                        {p.name}
                      </div>
                    </td>
                    <td className="px-6 py-3.5">
                      <span className="text-xs font-black text-[#00e5ff]">
                        {p.produced > 0 ? `+${p.produced}` : '0'} {p.unit}
                      </span>
                    </td>
                    <td className="px-6 py-3.5">
                      <span className="text-xs font-black text-emerald-400">
                        {p.sold > 0 ? `-${p.sold}` : '0'} {p.unit}
                      </span>
                    </td>
                    <td className="px-6 py-3.5">
                      <span className="text-xs font-black text-red-400">
                        {p.wasted > 0 ? `-${p.wasted}` : '0'} {p.unit}
                      </span>
                    </td>
                    <td className="px-6 py-3.5">
                      <div className="flex flex-col">
                        <span className={`text-xs font-black ${p.stock < 10 ? 'text-red-400' : 'text-white'}`}>
                          {p.stock} {p.unit}
                        </span>
                        <div className="w-20 h-1.5 bg-[#071324] rounded-full mt-1.5 overflow-hidden border border-[#162744]">
                          <div 
                            className={`h-full transition-all duration-700 ${p.stock < 10 ? 'bg-red-500 shadow-[0_0_8px_#ef4444]' : 'bg-[#00e5ff] shadow-[0_0_8px_#00e5ff]'}`} 
                            style={{ width: `${Math.min(100, (p.stock / 100) * 100)}%` }} 
                          />
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-3.5 text-right">
                      {p.stock < 10 ? (
                        <span className="text-[9px] font-black bg-red-500/20 text-red-400 border border-red-500/40 px-2 py-0.5 rounded-md uppercase">
                          Refill
                        </span>
                      ) : (
                        <span className="text-[9px] font-black bg-emerald-500/20 text-emerald-400 border border-emerald-500/40 px-2 py-0.5 rounded-md uppercase">
                          Good
                        </span>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Mobile Card View */}
        <div className="md:hidden divide-y divide-[#162744]">
          {productPulse.length === 0 ? (
            <div className="p-8 text-center text-[#5c7e9f] font-bold uppercase tracking-widest text-[10px]">
              No activity recorded.
            </div>
          ) : (
            productPulse.map((p, idx) => (
              <div key={idx} className="p-4 space-y-2.5">
                <div className="flex justify-between items-start">
                  <div>
                    <div className="font-extrabold text-white text-xs">{p.name}</div>
                    {p.stock < 10 && (
                      <span className="text-[8px] font-black bg-red-500/20 text-red-400 border border-red-500/40 px-1.5 py-0.5 rounded uppercase mt-1 inline-block">
                        Refill
                      </span>
                    )}
                  </div>
                  <div className="text-right">
                    <div className={`text-xs font-black ${p.stock < 10 ? 'text-red-400' : 'text-white'}`}>
                      {p.stock} {p.unit}
                    </div>
                    <div className="text-[8px] text-[#5c7e9f] font-bold uppercase tracking-wider">Current Stock</div>
                  </div>
                </div>
                
                <div className="grid grid-cols-3 gap-2">
                  <div className="p-2 bg-[#081222] rounded-xl border border-[#162744]">
                    <div className="text-[8px] text-[#00e5ff] font-black uppercase mb-0.5">Made</div>
                    <div className="text-xs font-bold text-white">{p.produced} {p.unit}</div>
                  </div>
                  <div className="p-2 bg-[#081222] rounded-xl border border-[#162744]">
                    <div className="text-[8px] text-emerald-400 font-black uppercase mb-0.5">Sold</div>
                    <div className="text-xs font-bold text-white">{p.sold} {p.unit}</div>
                  </div>
                  <div className="p-2 bg-[#081222] rounded-xl border border-[#162744]">
                    <div className="text-[8px] text-red-400 font-black uppercase mb-0.5">Waste</div>
                    <div className="text-xs font-bold text-white">{p.wasted} {p.unit}</div>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Bottom Insights: Top Selling Products & Sales by Category */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-5">
        {/* Top Selling Products */}
        <div className="bg-[#050b14] p-5 sm:p-6 rounded-3xl border border-[#162744] shadow-[0_10px_35px_rgba(0,0,0,0.5)]">
          <div className="flex items-center justify-between mb-4 pb-3 border-b border-[#162744]">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-xl bg-[#081527] border border-[#00d2ff]/40 flex items-center justify-center text-[#00e5ff]">
                <TrendingUp size={16} />
              </div>
              <h3 className="text-sm sm:text-base font-black uppercase tracking-wider text-white">
                Top Selling Products
              </h3>
            </div>
            <p className="text-[9px] sm:text-[10px] font-bold text-[#5c7e9f] uppercase tracking-widest">
              Highest Grossing Items
            </p>
          </div>
          <div className="space-y-2.5">
            {topSellingProducts.map((p, idx) => (
              <div key={idx} className="flex items-center justify-between p-3 bg-[#081222] rounded-2xl border border-[#162744] hover:border-[#00e5ff]/40 transition-colors group">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 bg-[#0a182d] border border-[#00d2ff]/40 text-[#00e5ff] rounded-xl flex items-center justify-center text-xs font-black shadow-[0_0_8px_rgba(0,210,255,0.2)]">
                    #{idx + 1}
                  </div>
                  <div>
                    <h4 className="font-extrabold text-white text-xs sm:text-sm truncate max-w-[170px] group-hover:text-[#00e5ff] transition-colors">
                      {p.name}
                    </h4>
                    <p className="text-[10px] text-[#6b8daf] font-bold uppercase">{p.quantity} Units Sold</p>
                  </div>
                </div>
                <div className="text-sm font-black text-[#00e5ff]">৳{p.revenue.toLocaleString()}</div>
              </div>
            ))}
            {topSellingProducts.length === 0 && (
              <div className="py-10 text-center text-[#5c7e9f] font-bold uppercase tracking-widest text-xs">
                No sales data available yet.
              </div>
            )}
          </div>
        </div>

        {/* Sales by Category */}
        <div className="bg-[#050b14] p-5 sm:p-6 rounded-3xl border border-[#162744] shadow-[0_10px_35px_rgba(0,0,0,0.5)]">
          <div className="flex items-center justify-between mb-4 pb-3 border-b border-[#162744]">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-xl bg-[#081527] border border-[#00d2ff]/40 flex items-center justify-center text-[#00e5ff]">
                <PieChartIcon size={16} />
              </div>
              <h3 className="text-sm sm:text-base font-black uppercase tracking-wider text-white">
                Sales by Category
              </h3>
            </div>
            <p className="text-[9px] sm:text-[10px] font-bold text-[#5c7e9f] uppercase tracking-widest">
              Category Distribution
            </p>
          </div>
          <div className="h-56">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={salesByCategory}
                  cx="50%"
                  cy="50%"
                  innerRadius={55}
                  outerRadius={75}
                  paddingAngle={4}
                  dataKey="value"
                >
                  {salesByCategory.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip 
                  contentStyle={{ 
                    backgroundColor: '#050b14', 
                    borderColor: '#00e5ff', 
                    borderRadius: '14px', 
                    fontSize: '12px',
                    color: '#fff' 
                  }} 
                  formatter={(value: any) => [`৳${Number(value).toLocaleString()}`, 'Revenue']}
                />
              </PieChart>
            </ResponsiveContainer>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 mt-2 pt-2 border-t border-[#162744]">
            {salesByCategory.map((entry, index) => (
              <div key={entry.name} className="flex items-center gap-2 bg-[#081222] p-1.5 rounded-lg border border-[#162744]">
                <div className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: COLORS[index % COLORS.length] }} />
                <span className="text-[10px] font-bold text-slate-300 uppercase truncate">{entry.name}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

const QuickAction: React.FC<{
  icon: React.ReactNode;
  label: string;
  subLabel?: string;
  onClick: () => void;
  glowColor: string;
  accentText: string;
}> = ({ icon, label, subLabel, onClick, glowColor, accentText }) => (
  <button 
    onClick={onClick}
    className="bg-[#050b14] hover:bg-[#081222] p-3.5 sm:p-4 rounded-2xl border border-[#162744] hover:border-[#00d2ff]/50 shadow-[0_4px_20px_rgba(0,0,0,0.4)] transition-all active:scale-95 flex flex-col items-center gap-2 group relative overflow-hidden cursor-pointer"
  >
    <div className="w-10 h-10 sm:w-11 sm:h-11 bg-[#081527] border border-[#162744] group-hover:border-[#00e5ff]/50 rounded-xl flex items-center justify-center text-[#00e5ff] shadow-[0_0_12px_rgba(0,210,255,0.2)] group-hover:scale-105 transition-transform">
      {icon}
    </div>
    <div className="text-center">
      <div className="text-xs font-black text-white tracking-wide group-hover:text-[#00e5ff] transition-colors">{label}</div>
      {subLabel && <div className="text-[9px] font-bold text-[#5c7e9f]">{subLabel}</div>}
    </div>
  </button>
);

const StatCard: React.FC<{ 
  title: string; 
  value: number; 
  type: 'sales' | 'revenue' | 'production' | 'discount' | 'expense';
  subLabel?: string;
}> = ({ title, value, type, subLabel }) => {
  const isNegative = value < 0;
  
  const getStyles = () => {
    switch(type) {
      case 'sales': return 'text-[#00e5ff]';
      case 'revenue': return 'text-emerald-400';
      case 'production': return 'text-blue-400';
      case 'discount': return 'text-orange-400';
      case 'expense': return 'text-red-400';
      default: return 'text-white';
    }
  };

  return (
    <div className="bg-[#050b14] p-4 sm:p-5 rounded-2xl border border-[#162744] shadow-[0_4px_20px_rgba(0,0,0,0.4)] flex flex-col justify-between hover:border-[#00d2ff]/40 transition-colors">
      <div>
        <h4 className="text-[#6b8daf] font-extrabold text-[9px] uppercase tracking-wider mb-0.5">{title}</h4>
        {subLabel && <div className="text-[10px] font-bold text-[#5c7e9f] mb-3">{subLabel}</div>}
      </div>
      <div className="flex items-baseline gap-1 mt-auto">
        <span className={`text-xs font-bold ${getStyles()}`}>৳</span>
        <span className={`text-xl sm:text-2xl font-black tracking-tight truncate ${getStyles()}`}>
          {isNegative ? '-' : ''}{Math.abs(value).toLocaleString()}
        </span>
      </div>
    </div>
  );
};

export default Dashboard;
