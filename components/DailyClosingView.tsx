import React, { useState, useMemo } from 'react';
import { Sale, Expense, DailyClosing, Wastage } from '../types';
import { generateId } from '../services/idGenerator';
import { 
  Lock, 
  History, 
  Trash2, 
  Clock,
  LockOpen,
  X,
  Printer,
  Edit2,
  Check,
  Download,
  FileSpreadsheet,
  FileText,
  Copy
} from 'lucide-react';

interface Props {
  sales: Sale[];
  expenses: Expense[];
  wastage: Wastage[];
  closings: DailyClosing[];
  onCloseDay: (closing: any) => void;
  onDeleteClosing: (id: string) => void;
  onUpdateClosing: (closing: DailyClosing) => void;
  currentUser: string;
}

const DailyClosingView: React.FC<Props> = ({ 
  sales, 
  expenses, 
  wastage, 
  closings, 
  onCloseDay, 
  onDeleteClosing, 
  onUpdateClosing, 
  currentUser 
}) => {
  const [actualCashInput, setActualCashInput] = useState<number | ''>('');
  const [activePrintRecord, setActivePrintRecord] = useState<DailyClosing | null>(null);
  const [modalTab, setModalTab] = useState<'excel' | 'receipt'>('excel');
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const today = new Date().toISOString().split('T')[0];
  
  // Inline edit state
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editActualCash, setEditActualCash] = useState<number | ''>('');
  const [editDate, setEditDate] = useState<string>('');

  const lastClosingTimestamp = useMemo(() => {
    if (closings.length === 0) return 0;
    return Math.max(...closings.map(c => new Date(c.timestamp || '').getTime()));
  }, [closings]);

  const activeStats = useMemo(() => {
    const activeSales = sales.filter(s => new Date(s.date).getTime() > lastClosingTimestamp);
    const activeExpenses = expenses.filter(e => new Date(e.date).getTime() > lastClosingTimestamp);
    const activeWastage = wastage.filter(w => new Date(w.date).getTime() > lastClosingTimestamp);
    
    const totalSalesVolume = activeSales.reduce((sum, s) => sum + (s.totalPrice || 0), 0);
    
    let totalCashCollected = 0;
    let totalCashPayments = 0;
    let totalMobilePayments = 0;

    sales.forEach(s => {
      if (s.payments && s.payments.length > 0) {
        s.payments.forEach(p => {
          if (new Date(p.date).getTime() > lastClosingTimestamp) {
            totalCashCollected += p.amount;
            if (p.method === 'Cash') totalCashPayments += p.amount;
            if (p.method === 'Mobile Payment') totalMobilePayments += p.amount;
          }
        });
      } else {
        if (new Date(s.date).getTime() > lastClosingTimestamp) {
          totalCashCollected += (s.amountPaid || 0);
          if (s.paymentMethod === 'Cash') totalCashPayments += (s.amountPaid || 0);
          if (s.paymentMethod === 'Mobile Payment') totalMobilePayments += (s.amountPaid || 0);
        }
      }
    });

    const totalExpenses = activeExpenses.reduce((sum, e) => sum + (e.amount || 0), 0);
    const totalWastageLoss = activeWastage.reduce((sum, w) => sum + (w.lossValue || 0), 0);
    const systemBalance = totalCashPayments - totalExpenses;
    const totalDues = totalSalesVolume - totalCashCollected;
    
    return { 
      sales: totalSalesVolume, 
      cash: totalCashCollected, 
      cashPayments: totalCashPayments,
      mobilePayments: totalMobilePayments,
      expenses: totalExpenses, 
      wastage: totalWastageLoss, 
      balance: systemBalance,
      dues: totalDues
    };
  }, [sales, expenses, wastage, lastClosingTimestamp]);

  const handleCloseDay = () => {
    if (actualCashInput === '') { 
      setError("Please enter actual cash in hand."); 
      setTimeout(() => setError(null), 3000);
      return; 
    }
    
    const actualCash = Number(actualCashInput);
    const difference = actualCash - activeStats.balance;

    const newClosing: DailyClosing = { 
      id: generateId('cls'), 
      date: today, 
      totalSales: activeStats.sales, 
      totalCashCollected: activeStats.cash, 
      totalCashPayments: activeStats.cashPayments,
      totalMobilePayments: activeStats.mobilePayments,
      totalExpenses: activeStats.expenses, 
      totalWastage: activeStats.wastage, 
      systemBalance: activeStats.balance, 
      actualCash: actualCash, 
      difference: difference, 
      closedBy: currentUser, 
      timestamp: new Date().toISOString() 
    };
    
    onCloseDay(newClosing);
    setModalTab('excel'); // default to beautiful excel sheet view
    setActivePrintRecord(newClosing);
    setActualCashInput('');
    setSuccessMsg("Daily closing completed successfully!");
    setTimeout(() => setSuccessMsg(null), 4000);
  };

  // Turn on edit mode for row
  const startEdit = (c: DailyClosing) => {
    setEditingId(c.id);
    setEditActualCash(c.actualCash);
    setEditDate(c.date);
  };

  // Cancel edit
  const cancelEdit = () => {
    setEditingId(null);
    setEditActualCash('');
    setEditDate('');
  };

  // Save updated closing details
  const saveEdit = (c: DailyClosing) => {
    const cash = editActualCash === '' ? 0 : Number(editActualCash);
    
    // Recalculate difference with updated actualCash
    const diff = cash - (c.systemBalance || 0);

    const updated: DailyClosing = {
      ...c,
      date: editDate || c.date,
      actualCash: cash,
      difference: diff
    };

    onUpdateClosing(updated);
    setEditingId(null);
    setSuccessMsg("Closing record updated successfully!");
    setTimeout(() => setSuccessMsg(null), 3500);
  };

  // Export unique closing as Excel compatible CSV (UTF-8 BOM)
  const exportSingleCsv = (c: DailyClosing) => {
    const headers = [
      "No.",
      "Date",
      "Closed By",
      "Total Sales (BDT)",
      "Cash Collected (BDT)",
      "Cash Payments (BDT)",
      "Mobile Payments (BDT)",
      "Total Expenses (BDT)",
      "Total Wastage (BDT)",
      "System Balance (BDT)",
      "Actual Cash (BDT)",
      "Difference (BDT)"
    ];

    const values = [
      "1",
      c.date,
      c.closedBy,
      `${c.totalSales || 0}`,
      `${c.totalCashCollected || 0}`,
      `${c.totalCashPayments || 0}`,
      `${c.totalMobilePayments || 0}`,
      `${c.totalExpenses || 0}`,
      `${c.totalWastage || 0}`,
      `${c.systemBalance || 0}`,
      `${c.actualCash || 0}`,
      `${c.difference || 0}`
    ];

    const csvContent = "\uFEFF" + [
      headers.join(","),
      values.map(val => `"${val.replace(/"/g, '""')}"`).join(",")
    ].join("\r\n");

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `Daily_Closing_${c.date}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Export all closings as a beautiful combined Excel spreadsheet report (CSV)
  const exportAllToCsv = () => {
    if (closings.length === 0) return;
    const headers = [
      "No.",
      "Date",
      "Closed By",
      "Total Sales (BDT)",
      "Cash Collected (BDT)",
      "Cash Payments (BDT)",
      "Mobile Payments (BDT)",
      "Total Expenses (BDT)",
      "Total Wastage (BDT)",
      "System Balance (BDT)",
      "Actual Cash (BDT)",
      "Difference (BDT)"
    ];

    const rows = [...closings].reverse().map((c, idx) => [
      String(idx + 1),
      c.date,
      c.closedBy,
      `${c.totalSales || 0}`,
      `${c.totalCashCollected || 0}`,
      `${c.totalCashPayments || 0}`,
      `${c.totalMobilePayments || 0}`,
      `${c.totalExpenses || 0}`,
      `${c.totalWastage || 0}`,
      `${c.systemBalance || 0}`,
      `${c.actualCash || 0}`,
      `${c.difference || 0}`
    ]);

    const csvContent = "\uFEFF" + [
      headers.join(","),
      ...rows.map(row => row.map(val => `"${val.replace(/"/g, '""')}"`).join(","))
    ].join("\r\n");

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `SweetBakery_All_Daily_Closings.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Copy data formatted as Excel table directly to clip
  const copyExcelTableToClipboard = (c: DailyClosing) => {
    const textStr = `DAILY CLOSING REPORT - ${c.date}\n` +
      `-------------------------------------------\n` +
      `Date\t${c.date}\n` +
      `Closed By\t${c.closedBy}\n` +
      `Total Sales (BDT)\t৳${c.totalSales}\n` +
      `Cash Collected\t৳${c.totalCashCollected}\n` +
      `Cash Payments\t৳${c.totalCashPayments}\n` +
      `Mobile Payments\t৳${c.totalMobilePayments}\n` +
      `Total Expenses\t৳${c.totalExpenses}\n` +
      `System Balance\t৳${c.systemBalance}\n` +
      `Actual Cash\t৳${c.actualCash}\n` +
      `Difference\t৳${c.difference}\n`;
    
    navigator.clipboard.writeText(textStr);
    alert("Excel formatted data copied to clipboard!");
  };

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      {/* Dynamic Success Notification */}
      {successMsg && (
        <div className="p-4 bg-emerald-500 text-white rounded-2xl font-bold flex items-center justify-between shadow-lg animate-bounce">
          <span>{successMsg}</span>
          <button onClick={() => setSuccessMsg(null)}><X size={18} /></button>
        </div>
      )}

      {/* Main Closing Control Panel */}
      <div className="bg-white dark:bg-[#070e1b] p-6 md:p-10 rounded-3xl border border-slate-200 dark:border-[#162744] shadow-sm relative overflow-hidden">
        <div className="relative z-10">
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6 mb-8">
            <div className="flex items-center gap-3">
              <div className="w-11 h-11 bg-[#0a1527] border border-[#00d2ff]/30 rounded-xl flex items-center justify-center text-[#00e5ff] shadow-[0_0_15px_rgba(0,210,255,0.2)]">
                <Lock size={22} />
              </div>
              <div>
                <h2 className="text-xl md:text-2xl font-black text-slate-900 dark:text-white">Daily Closing Update</h2>
                <p className="text-slate-400 text-xs font-medium">Daily sales, cash counting and shift closing module</p>
              </div>
            </div>
            <button 
              onClick={handleCloseDay} 
              className="smart-cyan-pill px-8 py-3.5 flex items-center justify-center gap-2.5 uppercase tracking-wider text-xs cursor-pointer font-black"
              id="btn_close_day"
            >
              <Lock size={16} /> Close Day
            </button>
          </div>
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-stretch">
            <div className="lg:col-span-8 grid grid-cols-2 md:grid-cols-4 gap-3.5">
              <SummaryItem title="Total Sales" value={activeStats.sales} color="text-slate-700 dark:text-slate-200" />
              <SummaryItem title="Cash Payments" value={activeStats.cashPayments} color="text-emerald-400" />
              <SummaryItem title="Mobile Payments" value={activeStats.mobilePayments} color="text-[#00e5ff]" />
              <SummaryItem title="Total Expenses" value={activeStats.expenses} color="text-rose-400" />
              <SummaryItem title="Wastage Loss" value={activeStats.wastage} color="text-amber-400" />
              <SummaryItem title="Dues" value={activeStats.dues} color="text-orange-400" />
              <SummaryItem title="System Balance" value={activeStats.balance} color="text-emerald-400" highlight />
            </div>
            <div className="lg:col-span-4 bg-[#0a1527] p-6 rounded-2xl border border-[#00d2ff]/30 shadow-[0_0_20px_rgba(0,210,255,0.15)] flex flex-col justify-center">
              <label className="text-[10px] font-black text-[#00e5ff] uppercase tracking-widest mb-2 block">Actual Cash in Hand</label>
              <input 
                type="number" 
                className="w-full bg-white dark:bg-[#050b14] border border-[#162744] rounded-xl p-3.5 text-2xl font-black text-slate-900 dark:text-white outline-none focus:border-[#00e5ff] focus:shadow-[0_0_15px_rgba(0,210,255,0.3)] transition-all text-center" 
                placeholder="0.00" 
                value={actualCashInput} 
                onChange={e => setActualCashInput(e.target.value === '' ? '' : Number(e.target.value))} 
                id="input_actual_cash"
              />
              {error && (
                <div className="mt-3 p-2.5 bg-rose-500/10 border border-rose-500/20 rounded-xl text-rose-400 text-xs font-bold flex items-center gap-2 animate-in slide-in-from-top-2">
                  <X size={14} /> {error}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* History table card with Excel download and Inline Updates */}
      <div id="closing_history_container" className="bg-white dark:bg-[#070e1b] rounded-3xl border border-slate-200 dark:border-[#162744] overflow-hidden shadow-sm">
        <div className="px-8 py-6 border-b border-slate-100 dark:border-[#162744] flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <h3 className="text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2.5">
              <History size={20} className="text-[#00e5ff]" /> Closing History
            </h3>
            <p className="text-xs text-slate-400 mt-0.5">Historical log of daily cash on hand and balance records. You can edit dates or cash entries.</p>
          </div>
          {closings.length > 0 && (
            <button 
              onClick={exportAllToCsv} 
              className="bg-[#0a1527] hover:bg-[#00d2ff]/20 text-[#00e5ff] text-xs font-bold px-4 py-2.5 rounded-xl border border-[#00d2ff]/30 transition-all flex items-center gap-2 cursor-pointer shadow-[0_0_10px_rgba(0,210,255,0.15)]"
              id="btn_export_all_excel"
            >
              <FileSpreadsheet size={15} /> Export All to Excel
            </button>
          )}
        </div>
        
        <div className="overflow-x-auto">
          <table className="w-full text-left" id="closings_table">
            <thead>
              <tr className="text-[10px] uppercase text-slate-400 font-bold border-b border-slate-100 dark:border-[#162744] bg-slate-50/50 dark:bg-[#0a1527]/50">
                <th className="px-8 py-4">Date</th>
                <th className="px-8 py-4">System Balance</th>
                <th className="px-8 py-4">Actual Cash</th>
                <th className="px-8 py-4">Difference</th>
                <th className="px-8 py-4">Closed By</th>
                <th className="px-8 py-4 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-[#162744]">
              {[...closings].reverse().map(c => {
                const isEditing = editingId === c.id;
                return (
                  <tr key={c.id} className="hover:bg-slate-50 dark:hover:bg-[#0a1527]/50 transition-colors text-sm">
                    {/* Date cell */}
                    <td className="px-8 py-4 font-bold text-slate-700 dark:text-slate-200">
                      {isEditing ? (
                        <input 
                          type="date" 
                          value={editDate} 
                          onChange={e => setEditDate(e.target.value)} 
                          className="bg-white dark:bg-[#0a1527] border border-[#00e5ff] rounded-xl px-3 py-1.5 text-xs font-bold text-slate-900 dark:text-white outline-none"
                        />
                      ) : (
                        <span>{new Date(c.date).toLocaleDateString()}</span>
                      )}
                    </td>
                    
                    {/* System Balance cell */}
                    <td className="px-8 py-4 font-bold text-slate-400">
                      ৳{(c.systemBalance || 0).toLocaleString()}
                    </td>
                    
                    {/* Actual Cash cell */}
                    <td className="px-8 py-4 font-bold text-slate-900 dark:text-white text-base">
                      {isEditing ? (
                        <div className="flex items-center gap-1">
                          <span className="text-slate-400 text-xs mr-1">৳</span>
                          <input 
                            type="number" 
                            value={editActualCash} 
                            onChange={e => setEditActualCash(e.target.value === '' ? '' : Number(e.target.value))} 
                            className="w-28 bg-white dark:bg-[#0a1527] border border-[#00e5ff] rounded-xl px-2 py-1 text-xs font-bold text-slate-900 dark:text-white outline-none"
                            placeholder="0.00"
                          />
                        </div>
                      ) : (
                        <span>৳{(c.actualCash || 0).toLocaleString()}</span>
                      )}
                    </td>

                    {/* Difference Cell */}
                    <td className={`px-8 py-4 font-bold ${c.difference >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                      {c.difference >= 0 ? '+' : ''}৳{(c.difference || 0).toLocaleString()}
                    </td>

                    {/* Closed By Cell */}
                    <td className="px-8 py-4 text-slate-400 text-xs font-medium">
                      {c.closedBy.split('@')[0]}
                    </td>
                    
                    {/* Actions cell */}
                    <td className="px-8 py-4 text-right">
                      <div className="flex justify-end gap-1.5">
                        {isEditing ? (
                          <>
                            <button 
                              onClick={() => saveEdit(c)} 
                              title="Save changes"
                              className="p-2 text-emerald-400 hover:text-emerald-300 bg-emerald-500/10 rounded-lg transition-all cursor-pointer"
                            >
                              <Check size={15} />
                            </button>
                            <button 
                              onClick={cancelEdit} 
                              title="Cancel editing"
                              className="p-2 text-rose-400 hover:text-rose-300 bg-rose-500/10 rounded-lg transition-all cursor-pointer"
                            >
                              <X size={15} />
                            </button>
                          </>
                        ) : (
                          <>
                            <button 
                              onClick={() => startEdit(c)} 
                              title="Edit record"
                              className="p-2 text-slate-400 hover:text-[#00e5ff] hover:bg-[#0a1527] rounded-lg transition-all cursor-pointer"
                            >
                              <Edit2 size={15} />
                            </button>
                            <button 
                              onClick={() => { setModalTab('excel'); setActivePrintRecord(c); }} 
                              title="Excel spreadsheet layout"
                              className="p-2 text-slate-400 hover:text-emerald-400 hover:bg-[#0a1527] rounded-lg transition-all cursor-pointer"
                              id={`btn_view_excel_closing_${c.id}`}
                            >
                              <FileSpreadsheet size={15} />
                            </button>
                            <button 
                              onClick={() => { setModalTab('receipt'); setActivePrintRecord(c); }} 
                              title="Receipt paper layout"
                              className="p-2 text-slate-400 hover:text-[#00e5ff] hover:bg-[#0a1527] rounded-lg transition-all cursor-pointer"
                            >
                              <Printer size={15} />
                            </button>
                            <button 
                              onClick={() => onDeleteClosing(c.id)} 
                              title="Delete record"
                              className="p-2 text-slate-400 hover:text-rose-400 hover:bg-[#0a1527] rounded-lg transition-all cursor-pointer"
                            >
                              <Trash2 size={15} />
                            </button>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
              {closings.length === 0 && (
                <tr>
                  <td colSpan={6} className="text-center py-12 text-slate-400 font-medium">
                    No closing records found. Click "Close Day" above to end the active session.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Multi-Format Spreadsheet Printing & CSV Export Modal */}
      {activePrintRecord && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 backdrop-blur-md p-4 no-print block">
          <div className="bg-white dark:bg-[#070e1b] w-full max-w-2xl rounded-3xl border border-slate-200 dark:border-[#162744] shadow-2xl overflow-hidden transition-all duration-300 transform scale-100 flex flex-col max-h-[90vh]">
             {/* Header */}
             <div className="p-6 border-b border-slate-100 dark:border-[#162744] flex justify-between items-center bg-slate-50 dark:bg-[#0a1527]">
               <div>
                 <h3 className="font-black text-slate-900 dark:text-white flex items-center gap-2 text-sm">
                   <Clock size={16} className="text-[#00e5ff]" /> Daily closing report
                 </h3>
                 <p className="text-xs text-slate-400 font-medium">Date: {activePrintRecord.date}</p>
               </div>
               <button 
                 onClick={() => setActivePrintRecord(null)} 
                 className="p-2 text-slate-400 hover:text-white rounded-full hover:bg-slate-800 transition-colors cursor-pointer"
               >
                 <X size={18} />
               </button>
             </div>

             {/* Tab switcher */}
             <div className="flex border-b border-slate-100 dark:border-[#162744] bg-slate-50 dark:bg-[#0a1527]/50 p-2 gap-2">
               <button 
                 onClick={() => setModalTab('excel')} 
                 className={`flex-1 py-2.5 px-4 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-2 cursor-pointer ${
                   modalTab === 'excel' 
                     ? 'bg-emerald-500 text-white shadow-md' 
                     : 'text-slate-400 hover:bg-slate-800 hover:text-white'
                 }`}
                 id="tab_excel"
               >
                 <FileSpreadsheet size={14} /> Excel Sheet Style
               </button>
               <button 
                 onClick={() => setModalTab('receipt')} 
                 className={`flex-1 py-2.5 px-4 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-2 cursor-pointer ${
                   modalTab === 'receipt' 
                     ? 'smart-cyan-pill' 
                     : 'text-slate-400 hover:bg-slate-800 hover:text-white'
                 }`}
                 id="tab_receipt"
               >
                 <FileText size={14} /> Receipt Paper Style
               </button>
             </div>

             {/* Dynamic Render Mode Pane */}
             <div className="flex-1 overflow-y-auto p-6 md:p-8 bg-slate-50 dark:bg-[#0a1120]/20">
               
               {modalTab === 'excel' ? (
                 /* Excel Spreadsheet View Module */
                 <div className="bg-white text-black p-6 rounded-2xl border border-slate-200 shadow-sm font-mono text-xs overflow-x-auto relative" id="print_section">
                    
                    {/* Excel Simulation Utility Header */}
                    <div className="mb-4 border-b border-slate-200 pb-3 flex justify-between items-center text-[10px] text-slate-400 select-none">
                      <div className="flex items-center gap-1.5">
                        <span className="w-2.5 h-2.5 rounded-full bg-red-400"></span>
                        <span className="w-2.5 h-2.5 rounded-full bg-yellow-400"></span>
                        <span className="w-2.5 h-2.5 rounded-full bg-green-400"></span>
                        <span className="ml-2 bg-slate-100 px-2 py-0.5 rounded text-slate-600 font-bold">Microsoft Excel - Book1.xlsx</span>
                      </div>
                      <div>Sheet1</div>
                    </div>

                    <div className="border border-slate-300 rounded overflow-hidden">
                      {/* Excel Bar Column Coordinates */}
                      <table className="w-full text-left border-collapse bg-white">
                        <thead>
                          <tr className="bg-slate-100 text-slate-600 font-bold text-center border-b border-slate-300">
                            <th className="py-1 px-2 border-r border-slate-300 bg-slate-200 text-[10px] w-12 text-center">Row</th>
                            <th className="py-1 px-3 border-r border-slate-300 text-center">A (Category Name)</th>
                            <th className="py-1 px-3 border-r border-slate-300 text-right">B (Value ৳)</th>
                            <th className="py-1 px-3 text-left">C (Remarks)</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-200">
                          <tr className="hover:bg-slate-50">
                            <td className="py-1.5 bg-slate-50 border-r border-slate-300 text-slate-400 text-center font-bold">1</td>
                            <td className="py-1.5 px-3 border-r border-slate-350 font-bold text-slate-800">Total Sales</td>
                            <td className="py-1.5 px-3 border-r border-slate-350 text-right font-bold text-slate-900">৳{(activePrintRecord.totalSales || 0).toLocaleString()}</td>
                            <td className="py-1.5 px-3 text-slate-400 italic">Total revenue generated from sales</td>
                          </tr>
                          <tr className="hover:bg-slate-50">
                            <td className="py-1.5 bg-slate-50 border-r border-slate-300 text-slate-400 text-center font-bold">2</td>
                            <td className="py-1.5 px-3 border-r border-slate-350 text-slate-700">Cash Received</td>
                            <td className="py-1.5 px-3 border-r border-slate-350 text-right text-emerald-600 font-bold">৳{(activePrintRecord.totalCashPayments || 0).toLocaleString()}</td>
                            <td className="py-1.5 px-3 text-slate-400 italic">Physical cash collected</td>
                          </tr>
                          <tr className="hover:bg-slate-50">
                            <td className="py-1.5 bg-slate-50 border-r border-slate-300 text-slate-400 text-center font-bold">3</td>
                            <td className="py-1.5 px-3 border-r border-slate-350 text-slate-700">Mobile Received</td>
                            <td className="py-1.5 px-3 border-r border-slate-350 text-right text-blue-600 font-bold">৳{(activePrintRecord.totalMobilePayments || 0).toLocaleString()}</td>
                            <td className="py-1.5 px-3 text-slate-400 italic">bKash / Nagad / Cards</td>
                          </tr>
                          <tr className="hover:bg-slate-50">
                            <td className="py-1.5 bg-slate-50 border-r border-slate-300 text-slate-400 text-center font-bold">4</td>
                            <td className="py-1.5 px-3 border-r border-slate-350 text-slate-700">Total Expenses</td>
                            <td className="py-1.5 px-3 border-r border-slate-350 text-right text-red-500">৳{(activePrintRecord.totalExpenses || 0).toLocaleString()}</td>
                            <td className="py-1.5 px-3 text-slate-400 italic">Raw materials & store expenses</td>
                          </tr>
                          <tr className="hover:bg-slate-50">
                            <td className="py-1.5 bg-slate-50 border-r border-slate-300 text-slate-400 text-center font-bold">5</td>
                            <td className="py-1.5 px-3 border-r border-slate-350 text-slate-700">Wastage Value</td>
                            <td className="py-1.5 px-3 border-r border-slate-350 text-right text-orange-500">৳{(activePrintRecord.totalWastage || 0).toLocaleString()}</td>
                            <td className="py-1.5 px-3 text-slate-400 italic">Spoiled or damaged products</td>
                          </tr>
                          <tr className="bg-slate-50 font-bold text-slate-900 border-t-2 border-slate-400">
                            <td className="py-2 bg-slate-200 border-r border-slate-300 text-slate-500 text-center">6</td>
                            <td className="py-2 px-3 border-r border-slate-350">System Balance</td>
                            <td className="py-2 px-3 border-r border-slate-350 text-right">৳{(activePrintRecord.systemBalance || 0).toLocaleString()}</td>
                            <td className="py-2 px-3 text-slate-500 font-medium italic">Formula: =Row2 - Row4</td>
                          </tr>
                          <tr className="bg-emerald-50/70 font-bold text-slate-900">
                            <td className="py-2 bg-emerald-100 border-r border-slate-300 text-emerald-600 text-center">7</td>
                            <td className="py-2 px-3 border-r border-slate-350">Actual Cash</td>
                            <td className="py-2 px-3 border-r border-slate-350 text-right text-emerald-700 text-md">৳{(activePrintRecord.actualCash || 0).toLocaleString()}</td>
                            <td className="py-2 px-3 text-emerald-600 italic">Physically counted cash on hand</td>
                          </tr>
                          <tr className={`font-bold ${activePrintRecord.difference >= 0 ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-700'}`}>
                            <td className="py-2 bg-slate-200 border-r border-slate-300 text-center">8</td>
                            <td className="py-2 px-3 border-r border-slate-350">Difference</td>
                            <td className="py-2 px-3 border-r border-slate-350 text-right text-md">
                              {activePrintRecord.difference >= 0 ? '+' : ''}৳{(activePrintRecord.difference || 0).toLocaleString()}
                            </td>
                            <td className="py-2 px-3 italic font-semibold">
                              {activePrintRecord.difference === 0 ? "Perfect matched" : activePrintRecord.difference > 0 ? "Surplus" : "Shortage"}
                            </td>
                          </tr>
                        </tbody>
                      </table>
                    </div>

                    {/* Metadata & Signatures */}
                    <div className="mt-8 pt-4 border-t border-dashed border-slate-300 grid grid-cols-2 gap-4 text-[10px] text-slate-500">
                      <div>
                        <p><strong>Report ID:</strong> CLOSING-{activePrintRecord.id}</p>
                        <p><strong>Generated on:</strong> {new Date(activePrintRecord.timestamp).toLocaleTimeString()}</p>
                        <p><strong>Operator Email:</strong> {activePrintRecord.closedBy}</p>
                      </div>
                      <div className="text-right flex flex-col justify-end items-end select-none">
                        <div className="w-28 border-b border-slate-400 mt-6 mb-1"></div>
                        <p className="mr-4">Manager Signature</p>
                      </div>
                    </div>
                 </div>
               ) : (
                 /* Thermal Receipt Printer Layout */
                 <div className="bg-white text-black p-8 rounded-2xl shadow-sm border border-slate-200 font-mono text-[11px] leading-tight max-w-sm mx-auto text-center relative" id="print_section">
                    <h2 className="text-lg font-black uppercase mb-1 tracking-wider">SWEET LIVE BAKERY</h2>
                    <p className="text-[9px] text-slate-400">SMART BAKERY MANAGEMENT ENGINE</p>
                    <div className="border-b border-dashed border-slate-300 my-2"></div>
                    
                    <div className="text-left space-y-1 mb-4">
                      <div className="flex justify-between"><span>Date:</span><span>{new Date(activePrintRecord.date).toLocaleDateString()}</span></div>
                      <div className="flex justify-between"><span>No:</span><span>#{activePrintRecord.id}</span></div>
                      <div className="flex justify-between"><span>Operator:</span><span>{activePrintRecord.closedBy.split('@')[0]}</span></div>
                    </div>

                    <div className="border-b border-dashed border-black my-2"></div>
                    
                    <div className="space-y-1.5 text-left text-xs">
                       <div className="flex justify-between"><span>Total Sales:</span><span className="font-bold">৳{(activePrintRecord.totalSales || 0).toLocaleString()}</span></div>
                       <div className="flex justify-between"><span>Cash Collected:</span><span>৳{(activePrintRecord.totalCashCollected || 0).toLocaleString()}</span></div>
                       <div className="flex justify-between pl-2 text-[10px] text-slate-500"><span>- Cash Received:</span><span>৳{(activePrintRecord.totalCashPayments || 0).toLocaleString()}</span></div>
                       <div className="flex justify-between pl-2 text-[10px] text-slate-500"><span>- Mobile Received:</span><span>৳{(activePrintRecord.totalMobilePayments || 0).toLocaleString()}</span></div>
                       <div className="flex justify-between"><span>Total Expenses:</span><span className="text-red-500">৳{(activePrintRecord.totalExpenses || 0).toLocaleString()}</span></div>
                       <div className="flex justify-between"><span>Wastage loss:</span><span className="text-orange-500">৳{(activePrintRecord.totalWastage || 0).toLocaleString()}</span></div>
                       
                       <div className="border-t border-slate-300 my-1"></div>
                       
                       <div className="flex justify-between font-bold"><span>System Balance:</span><span>৳{(activePrintRecord.systemBalance || 0).toLocaleString()}</span></div>
                       <div className="flex justify-between font-black text-rose-600 text-lg"><span>Actual Cash:</span><span>৳{(activePrintRecord.actualCash || 0).toLocaleString()}</span></div>
                       
                       <div className="border-t-2 border-double border-slate-400 my-1"></div>
                       
                       <div className="flex justify-between font-bold text-sm">
                         <span>Difference:</span>
                         <span className={activePrintRecord.difference >= 0 ? "text-emerald-600" : "text-red-600"}>
                           {activePrintRecord.difference >= 0 ? '+' : ''}৳{(activePrintRecord.difference || 0).toLocaleString()}
                         </span>
                       </div>
                    </div>
                    
                    <div className="mt-8 pt-4 border-t border-dashed border-slate-300 text-[9px] text-slate-400 text-center">
                       <p>SWEET LIVE BAKERY APPMANAGER</p>
                       <p>Thank you for closing daily cash responsibly.</p>
                    </div>
                 </div>
               )}

             </div>

             {/* Action footer */}
             <div className="p-6 border-t border-slate-100 dark:border-slate-800 flex flex-wrap gap-3 justify-between items-center bg-slate-50 dark:bg-slate-900/40">
               <div className="flex gap-2">
                 <button 
                   onClick={() => exportSingleCsv(activePrintRecord)} 
                   className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold px-4 py-3 rounded-xl flex items-center gap-2 transition-colors select-none"
                   id="btn_download_excel"
                 >
                   <Download size={14} /> Download Excel (CSV)
                 </button>
                 <button 
                   onClick={() => copyExcelTableToClipboard(activePrintRecord)} 
                   className="bg-slate-200 hover:bg-slate-300 text-slate-700 dark:bg-slate-800 dark:hover:bg-slate-700 dark:text-slate-300 text-xs font-bold px-4 py-3 rounded-xl flex items-center gap-2 transition-colors select-none"
                   id="btn_copy_excel"
                 >
                   <Copy size={14} /> Copy Table Data
                 </button>
               </div>
               
               <button 
                 onClick={() => {
                   // Clean styles for perfect print
                   const originalContents = document.body.innerHTML;
                   const printContent = document.getElementById("print_section")?.outerHTML || "";
                   
                   if (printContent) {
                     // Style configuration for window print container
                     const win = window.open("", "_blank");
                     if (win) {
                       win.document.write(`
                         <html>
                           <head>
                             <title>Daily Closing Printout - ${activePrintRecord.date}</title>
                             <style>
                               body { font-family: monospace; padding: 40px; background: white; color: black; font-size: 11px; }
                               .border { border: 1px solid #ccc; }
                               .border-collapse { border-collapse: collapse; }
                               .w-full { width: 100%; }
                               .px-3 { padding-left: 12px; padding-right: 12px; }
                               .py-1.5 { padding-top: 6px; padding-bottom: 6px; }
                               .py-2 { padding-top: 8px; padding-bottom: 8px; }
                               .text-right { text-align: right; }
                               .font-bold { font-weight: bold; }
                               .divide-y tr { border-bottom: 1px solid #ddd; }
                               .bg-slate-50 { background-color: #fafafa; }
                               .hover\\:bg-slate-50:hover { background-color: #f1f1f1; }
                               .mb-4 { margin-bottom: 16px; }
                               .mt-8 { margin-top: 32px; }
                               .pt-4 { padding-top: 16px; }
                               .border-t { border-top: 1px solid #ccc; }
                               .border-dashed { border-style: dashed; }
                               .grid { display: grid; grid-template-columns: 1fr 1fr; }
                               .text-slate-400 { color: #888; }
                               .italic { font-style: italic; }
                               ${modalTab === 'receipt' ? 'body { width: 300px; margin: 0 auto; }' : ''}
                             </style>
                           </head>
                           <body>
                             ${printContent}
                             <script>
                               window.onload = function() {
                                 window.print();
                                 setTimeout(function() { window.close(); }, 500);
                               };
                             </script>
                           </body>
                         </html>
                       `);
                       win.document.close();
                     }
                   }
                 }} 
                 className="bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold px-6 py-3 rounded-xl flex items-center gap-2 transition-colors select-none"
                 id="btn_print_now"
               >
                 <Printer size={14} /> Print Now
               </button>
             </div>
          </div>
        </div>
      )}
    </div>
  );
};

const SummaryItem = ({ title, value, color, highlight }: any) => (
  <div className={`p-4 rounded-2xl border flex flex-col justify-between h-full ${highlight ? 'bg-[#0a1527] border-emerald-500/30' : 'bg-slate-50 dark:bg-[#0a1527] border-slate-200 dark:border-[#162744]'}`}>
    <div><h4 className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">{title}</h4></div>
    <div className={`text-lg font-black ${color}`}>৳{(value || 0).toLocaleString()}</div>
  </div>
);

export default DailyClosingView;
