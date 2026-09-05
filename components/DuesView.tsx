
import React, { useState, useMemo } from 'react';
import { Sale } from '../types';
import { generateId } from '../services/idGenerator';
import { 
  Wallet, 
  Search, 
  Phone, 
  User, 
  Check, 
  Trash2, 
  Calendar, 
  AlertCircle, 
  Smartphone, 
  CreditCard, 
  ChevronDown, 
  ChevronUp,
  CheckCircle2,
  X,
  ArrowRight
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

interface Props {
  sales: Sale[];
  onUpdateSales: (updatedSales: Sale[]) => void;
}

interface CustomerDue {
  id: string;
  customerName: string;
  customerPhone: string;
  totalBill: number;
  totalPaid: number;
  totalDue: number;
  sales: Sale[];
}

const DuesView: React.FC<Props> = ({ sales, onUpdateSales }) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [expandedCustomer, setExpandedCustomer] = useState<string | null>(null);
  const [selectedCustomerForPayment, setSelectedCustomerForPayment] = useState<CustomerDue | null>(null);
  
  // Payment Modal States
  const [paymentAmount, setPaymentAmount] = useState('');
  const [paymentMethod, setPaymentMethod] = useState<'Cash' | 'Mobile Payment'>('Cash');
  const [mobileProvider, setMobileProvider] = useState<'Bkash' | 'Nagad' | 'Rocket' | 'Other'>('Bkash');
  const [transactionId, setTransactionId] = useState('');

  const dueSales = useMemo(() => {
    return sales.filter(s => s.dueAmount > 0);
  }, [sales]);

  const groupedDues = useMemo(() => {
    const groups: { [key: string]: CustomerDue } = {};
    
    dueSales.forEach(sale => {
      const name = (sale.customerName || '').trim() || 'Unknown Customer';
      const phone = (sale.customerPhone || '').trim();
      const key = `${name.toLowerCase()}_${phone}`;
      
      if (!groups[key]) {
        groups[key] = {
          id: key,
          customerName: name,
          customerPhone: phone,
          totalBill: 0,
          totalPaid: 0,
          totalDue: 0,
          sales: []
        };
      }
      
      groups[key].totalBill += sale.totalPrice;
      groups[key].totalPaid += sale.amountPaid;
      groups[key].totalDue += sale.dueAmount;
      groups[key].sales.push(sale);
    });
    
    return Object.values(groups).sort((a, b) => a.customerName.localeCompare(b.customerName));
  }, [dueSales]);

  const filteredDues = useMemo(() => {
    return groupedDues.filter(g => 
      g.customerName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      g.customerPhone.toLowerCase().includes(searchTerm.toLowerCase())
    );
  }, [groupedDues, searchTerm]);

  const handlePayment = () => {
    if (!selectedCustomerForPayment) return;
    
    let remainingPayment = parseFloat(paymentAmount) || 0;
    if (remainingPayment <= 0) return;

    const sortedSales = [...selectedCustomerForPayment.sales].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
    const updatedSales: Sale[] = [];

    for (const sale of sortedSales) {
      if (remainingPayment <= 0) break;
      if (sale.dueAmount <= 0) continue;

      const paymentForThisSale = Math.min(sale.dueAmount, remainingPayment);
      const newPaid = sale.amountPaid + paymentForThisSale;
      const newDue = sale.totalPrice - newPaid;

      const newPayment = {
        id: generateId('pmt'),
        amount: paymentForThisSale,
        date: new Date().toISOString(),
        method: paymentMethod
      };

      updatedSales.push({
        ...sale,
        amountPaid: newPaid,
        dueAmount: newDue,
        paymentMethod: paymentMethod,
        mobileProvider: paymentMethod === 'Mobile Payment' ? mobileProvider : undefined,
        transactionId: paymentMethod === 'Mobile Payment' ? (transactionId || undefined) : undefined,
        payments: [...(sale.payments || []), newPayment]
      });

      remainingPayment -= paymentForThisSale;
    }

    if (updatedSales.length > 0) {
      onUpdateSales(updatedSales);
    }
    
    // Reset states
    setSelectedCustomerForPayment(null);
    setPaymentAmount('');
    setTransactionId('');
    setPaymentMethod('Cash');
    setMobileProvider('Bkash');
  };

  const totalDue = useMemo(() => {
    return dueSales.reduce((total, s) => total + s.dueAmount, 0);
  }, [dueSales]);

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      {/* Header Section */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <div className="lg:col-span-4 bg-[#050b14] dark:bg-[#070e1b] p-8 rounded-3xl shadow-xl text-white border border-[#00d2ff]/40 relative overflow-hidden group">
          <div className="absolute -right-4 -bottom-4 opacity-10 group-hover:scale-110 transition-transform duration-500 text-[#00e5ff]">
            <Wallet size={180} />
          </div>
          <div className="relative z-10">
            <div className="flex items-center gap-2 mb-2">
              <span className="w-2 h-2 rounded-full bg-[#00e5ff] shadow-[0_0_8px_#00e5ff]"></span>
              <h4 className="text-[#00e5ff] font-bold text-xs uppercase tracking-widest">Total Active Dues</h4>
            </div>
            <div className="flex items-baseline gap-1 text-white">
              <span className="text-2xl font-bold text-[#00e5ff]">৳</span>
              <span className="text-5xl font-black tracking-tighter drop-shadow-[0_0_15px_rgba(0,229,255,0.3)]">{totalDue.toLocaleString()}</span>
            </div>
            <p className="mt-4 text-slate-400 text-[10px] font-bold uppercase tracking-widest">Across {groupedDues.length} Customers</p>
          </div>
        </div>

        <div className="lg:col-span-8 bg-white dark:bg-[#070e1b] p-8 rounded-3xl border border-slate-200 dark:border-[#162744] shadow-sm flex items-center justify-between gap-6 relative overflow-hidden">
          <div className="relative z-10">
            <h2 className="text-2xl font-black text-slate-900 dark:text-white mb-2">Unified Due Management</h2>
            <p className="text-slate-500 dark:text-slate-400 text-sm max-w-md">
              Customer dues ledger and one-click payment collection module.
            </p>
          </div>
          <div className="hidden sm:flex w-20 h-20 bg-[#0a1527] rounded-2xl items-center justify-center border border-[#00d2ff]/30 text-[#00e5ff] shadow-[0_0_15px_rgba(0,210,255,0.2)]">
            <Wallet size={32} />
          </div>
        </div>
      </div>

      {/* Search Bar */}
      <div className="relative">
        <Search className="absolute left-6 top-1/2 -translate-y-1/2 text-[#00e5ff]" size={22} />
        <input
          type="text"
          placeholder="Search by customer name or phone number..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="w-full pl-16 pr-6 py-4.5 bg-white dark:bg-[#070e1b] border border-slate-200 dark:border-[#162744] rounded-2xl shadow-sm focus:border-[#00e5ff] focus:shadow-[0_0_15px_rgba(0,229,255,0.2)] outline-none transition-all text-base font-medium text-slate-900 dark:text-white placeholder-slate-400"
        />
      </div>

      {/* Customer List */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {filteredDues.length === 0 ? (
          <div className="col-span-full py-20 text-center bg-white dark:bg-[#070e1b] rounded-3xl border border-dashed border-slate-200 dark:border-[#162744]">
            <div className="w-20 h-20 bg-[#0a1527] border border-[#00d2ff]/20 rounded-full flex items-center justify-center mx-auto mb-6 text-[#00e5ff]">
              <Wallet size={40} />
            </div>
            <p className="text-slate-700 dark:text-slate-300 font-bold text-lg">No active dues found</p>
            <p className="text-slate-400 dark:text-slate-500 text-sm mt-1">All accounts are settled!</p>
          </div>
        ) : (
          filteredDues.map(customerDue => (
            <div key={customerDue.id} className="bg-white dark:bg-[#070e1b] rounded-3xl border border-slate-200 dark:border-[#162744] hover:border-[#00e5ff]/50 shadow-sm hover:shadow-[0_0_20px_rgba(0,210,255,0.15)] transition-all overflow-hidden flex flex-col">
              <div className="p-7 pb-6">
                <div className="flex justify-between items-start mb-6">
                  <div className="flex items-center gap-4">
                    <div className="w-14 h-14 rounded-2xl bg-[#0a1527] border border-[#00d2ff]/40 flex items-center justify-center text-[#00e5ff] font-black text-2xl shadow-[0_0_12px_rgba(0,210,255,0.25)]">
                      {customerDue.customerName[0] || 'U'}
                    </div>
                    <div>
                      <h3 className="text-xl font-black text-slate-900 dark:text-white leading-tight">
                        {customerDue.customerName}
                      </h3>
                      <p className="text-sm text-slate-500 dark:text-slate-400 flex items-center gap-2 mt-1">
                        <Phone size={14} className="text-[#00e5ff]" /> {customerDue.customerPhone || 'No Phone'}
                      </p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Total Due</p>
                    <p className="text-3xl font-black text-rose-500 tracking-tighter">৳{customerDue.totalDue.toLocaleString()}</p>
                  </div>
                </div>

                <button 
                  onClick={() => setExpandedCustomer(expandedCustomer === customerDue.id ? null : customerDue.id)}
                  className="flex items-center gap-2 text-[10px] font-black text-slate-400 uppercase tracking-widest hover:text-[#00e5ff] transition-colors mb-4 cursor-pointer"
                >
                  {customerDue.sales.length} Transactions 
                  {expandedCustomer === customerDue.id ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                </button>

                <AnimatePresence>
                  {expandedCustomer === customerDue.id && (
                    <motion.div 
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: 'auto', opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      className="overflow-hidden space-y-2 mb-6"
                    >
                      {customerDue.sales.map(sale => (
                        <div key={sale.id} className="p-3 bg-slate-50 dark:bg-[#0a1527] rounded-xl border border-slate-100 dark:border-[#162744] flex justify-between items-center text-xs">
                          <div className="flex flex-col">
                            <span className="font-bold text-slate-700 dark:text-slate-300">{new Date(sale.date).toLocaleDateString()}</span>
                            <span className="text-[10px] text-slate-400">{sale.items.length} items</span>
                          </div>
                          <div className="text-right">
                            <div className="font-black text-slate-900 dark:text-white">৳{sale.dueAmount.toLocaleString()}</div>
                            <div className="text-[9px] text-slate-400">Total: ৳{sale.totalPrice}</div>
                          </div>
                        </div>
                      ))}
                    </motion.div>
                  )}
                </AnimatePresence>

                <button 
                  onClick={() => setSelectedCustomerForPayment(customerDue)}
                  className="w-full smart-cyan-pill py-3.5 flex items-center justify-center gap-3 text-xs uppercase tracking-widest cursor-pointer"
                >
                  <CheckCircle2 size={18} /> Collect Payment
                </button>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Payment Collection Modal */}
      <AnimatePresence>
        {selectedCustomerForPayment && (
          <div className="fixed inset-0 z-[150] flex items-center justify-center p-6 bg-black/80 backdrop-blur-xl no-print">
            <motion.div 
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="bg-white dark:bg-[#070e1b] w-full max-w-md rounded-3xl shadow-[0_20px_60px_rgba(0,0,0,0.9)] overflow-hidden border border-slate-200 dark:border-[#162744]"
            >
              <div className="p-6 pb-5 border-b border-slate-100 dark:border-[#162744] flex justify-between items-center">
                <h3 className="text-lg font-black text-slate-900 dark:text-white flex items-center gap-3 uppercase tracking-tight">
                  <div className="w-10 h-10 bg-[#0a1527] border border-[#00d2ff]/30 rounded-xl flex items-center justify-center text-[#00e5ff]">
                    <Wallet size={18} />
                  </div>
                  Collect Payment
                </h3>
                <button 
                  onClick={() => setSelectedCustomerForPayment(null)} 
                  className="p-2 text-slate-400 hover:text-red-500 transition-colors cursor-pointer"
                >
                  <X size={22} />
                </button>
              </div>

              <div className="p-6 space-y-5">
                <div className="p-5 bg-slate-50 dark:bg-[#0a1527] rounded-2xl border border-slate-100 dark:border-[#162744]">
                  <div className="flex justify-between items-center mb-1">
                    <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Customer</span>
                    <span className="text-[10px] font-black text-rose-400 uppercase tracking-widest">Outstanding Due</span>
                  </div>
                  <div className="flex justify-between items-end">
                    <div className="font-black text-lg text-slate-900 dark:text-white">{selectedCustomerForPayment.customerName}</div>
                    <div className="font-black text-2xl text-rose-500">৳{selectedCustomerForPayment.totalDue.toLocaleString()}</div>
                  </div>
                </div>

                <div className="space-y-4">
                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-[#00d2ff] uppercase px-1 tracking-widest">Payment Amount (৳)</label>
                    <input 
                      type="number" 
                      autoFocus
                      className="w-full p-5 rounded-2xl bg-slate-50 dark:bg-[#0a1120] border-2 border-slate-200 dark:border-[#162744] text-slate-900 dark:text-white text-3xl font-black outline-none focus:border-[#00e5ff] focus:shadow-[0_0_15px_rgba(0,229,255,0.25)] transition-all"
                      placeholder="0.00"
                      value={paymentAmount}
                      onChange={e => setPaymentAmount(e.target.value)}
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <button
                      onClick={() => setPaymentMethod('Cash')}
                      className={`flex flex-col items-center justify-center gap-2 py-4 rounded-2xl border-2 transition-all cursor-pointer ${paymentMethod === 'Cash' ? 'border-[#00e5ff] bg-[#00e5ff]/10 text-[#00e5ff] shadow-[0_0_15px_rgba(0,229,255,0.2)] font-bold' : 'border-slate-100 dark:border-slate-800 text-slate-400'}`}
                    >
                      <Wallet size={24} />
                      <span className="text-[10px] font-black uppercase tracking-widest">Cash</span>
                    </button>
                    <button
                      onClick={() => setPaymentMethod('Mobile Payment')}
                      className={`flex flex-col items-center justify-center gap-2 py-4 rounded-2xl border-2 transition-all cursor-pointer ${paymentMethod === 'Mobile Payment' ? 'border-[#00e5ff] bg-[#00e5ff]/10 text-[#00e5ff] shadow-[0_0_15px_rgba(0,229,255,0.2)] font-bold' : 'border-slate-100 dark:border-slate-800 text-slate-400'}`}
                    >
                      <Smartphone size={24} />
                      <span className="text-[10px] font-black uppercase tracking-widest">Mobile</span>
                    </button>
                  </div>

                  {paymentMethod === 'Mobile Payment' && (
                    <motion.div 
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: 'auto', opacity: 1 }}
                      className="space-y-4 pt-2"
                    >
                      <div className="grid grid-cols-4 gap-2">
                        {(['Bkash', 'Nagad', 'Rocket', 'Other'] as const).map((provider) => (
                          <button
                            key={provider}
                            onClick={() => setMobileProvider(provider)}
                            className={`py-2 rounded-xl border text-[9px] font-black uppercase transition-all cursor-pointer ${mobileProvider === provider ? 'smart-cyan-pill' : 'bg-slate-50 dark:bg-[#0a1120] text-slate-400 border-slate-100 dark:border-slate-800'}`}
                          >
                            {provider}
                          </button>
                        ))}
                      </div>
                      <div className="relative">
                        <CreditCard className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                        <input
                          type="text"
                          placeholder="Transaction ID (Optional)"
                          className="w-full pl-12 pr-4 py-4 bg-slate-50 dark:bg-[#0a1120] border border-slate-100 dark:border-[#162744] rounded-2xl focus:border-[#00e5ff] outline-none transition-all text-sm font-bold text-slate-900 dark:text-white"
                          value={transactionId}
                          onChange={e => setTransactionId(e.target.value)}
                        />
                      </div>
                    </motion.div>
                  )}
                </div>

                <button 
                  onClick={handlePayment}
                  disabled={!paymentAmount || parseFloat(paymentAmount) <= 0}
                  className="w-full smart-cyan-pill py-4 text-sm uppercase tracking-widest flex items-center justify-center gap-3 cursor-pointer disabled:opacity-50"
                >
                  Confirm Payment <ArrowRight size={18} />
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default DuesView;
