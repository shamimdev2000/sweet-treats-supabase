
import React, { useState, useMemo } from 'react';
import { DailyClosing, MonthlyClosing } from '../types';
import { generateId } from '../services/idGenerator';
import { 
  Calendar, 
  Lock, 
  History, 
  Trash2, 
  X, 
  TrendingUp, 
  TrendingDown, 
  AlertCircle,
  BarChart3,
  Clock,
  FileSpreadsheet,
  Download,
  Copy
} from 'lucide-react';
import { 
  ResponsiveContainer, 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  Cell 
} from 'recharts';

interface Props {
  dailyClosings: DailyClosing[];
  monthlyClosings: MonthlyClosing[];
  onCloseMonth: (closing: MonthlyClosing) => void;
  onDeleteMonthlyClosing: (id: string) => void;
  currentUser: string;
  managerPassword?: string;
}

const MonthlyClosingView: React.FC<Props> = ({ 
  dailyClosings, 
  monthlyClosings, 
  onCloseMonth, 
  onDeleteMonthlyClosing, 
  currentUser,
  managerPassword = '1234'
}) => {
  const [selectedMonth, setSelectedMonth] = useState(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
  });
  const [activePrintRecord, setActivePrintRecord] = useState<MonthlyClosing | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [pinInput, setPinInput] = useState('');
  const [pinError, setPinError] = useState<string | null>(null);

  const monthLabel = useMemo(() => {
    const [year, month] = selectedMonth.split('-');
    return new Date(Number(year), Number(month) - 1).toLocaleString('default', { month: 'long', year: 'numeric' });
  }, [selectedMonth]);

  const monthStats = useMemo(() => {
    const [year, month] = selectedMonth.split('-');
    const closingsInMonth = dailyClosings.filter(c => {
      const cDate = new Date(c.date);
      return cDate.getFullYear() === Number(year) && (cDate.getMonth() + 1) === Number(month);
    });

    const totalSales = closingsInMonth.reduce((sum, c) => sum + (c.totalSales || 0), 0);
    const totalCashPayments = closingsInMonth.reduce((sum, c) => sum + (c.totalCashPayments || 0), 0);
    const totalMobilePayments = closingsInMonth.reduce((sum, c) => sum + (c.totalMobilePayments || 0), 0);
    const totalExpenses = closingsInMonth.reduce((sum, c) => sum + (c.totalExpenses || 0), 0);
    const totalWastage = closingsInMonth.reduce((sum, c) => sum + (c.totalWastage || 0), 0);
    const totalDues = closingsInMonth.reduce((sum, c) => sum + ((c.totalSales || 0) - (c.totalCashCollected || 0)), 0);
    const totalProfit = totalSales - totalExpenses - totalWastage;

    return {
      totalSales,
      totalCashPayments,
      totalMobilePayments,
      totalExpenses,
      totalWastage,
      totalDues,
      totalProfit,
      count: closingsInMonth.length
    };
  }, [dailyClosings, selectedMonth]);

  const isAlreadyClosed = useMemo(() => {
    return monthlyClosings.some(c => c.month === monthLabel);
  }, [monthlyClosings, monthLabel]);

  const handleCloseMonth = () => {
    if (isAlreadyClosed) {
      setError("Closing for this month has already been completed.");
      setTimeout(() => setError(null), 3000);
      return;
    }

    if (monthStats.count === 0) {
      setError("No daily closing data found for this month.");
      setTimeout(() => setError(null), 3000);
      return;
    }

    setPinInput('');
    setPinError(null);
    setShowAuthModal(true);
  };

  const handleAuthVerify = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (pinInput === managerPassword) {
      const newClosing: MonthlyClosing = {
        id: generateId('mcls'),
        month: monthLabel,
        totalSales: monthStats.totalSales,
        totalCashPayments: monthStats.totalCashPayments,
        totalMobilePayments: monthStats.totalMobilePayments,
        totalExpenses: monthStats.totalExpenses,
        totalWastage: monthStats.totalWastage,
        totalProfit: monthStats.totalProfit,
        totalDues: monthStats.totalDues,
        closedBy: currentUser,
        timestamp: new Date().toISOString()
      };

      onCloseMonth(newClosing);
      setActivePrintRecord(newClosing);
      setShowAuthModal(false);
      setPinInput('');
      setPinError(null);
    } else {
      setPinError("Invalid PIN number! Please enter the correct manager PIN.");
    }
  };

  const exportSingleMonthlyCsv = (c: MonthlyClosing) => {
    const headers = [
      "No.",
      "Month",
      "Closed By",
      "Total Sales (BDT)",
      "Cash Received (BDT)",
      "Mobile Received (BDT)",
      "Total Expenses (BDT)",
      "Total Wastage (BDT)",
      "Net Profit (BDT)",
      "Total Dues (BDT)",
      "Time"
    ];

    const values = [
      "1",
      c.month,
      c.closedBy,
      `${c.totalSales || 0}`,
      `${c.totalCashPayments || 0}`,
      `${c.totalMobilePayments || 0}`,
      `${c.totalExpenses || 0}`,
      `${c.totalWastage || 0}`,
      `${c.totalProfit || 0}`,
      `${c.totalDues || 0}`,
      c.timestamp ? new Date(c.timestamp).toLocaleString() : ''
    ];

    const csvContent = "\uFEFF" + [
      headers.join(","),
      values.map(val => `"${val.replace(/"/g, '""')}"`).join(",")
    ].join("\r\n");

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `Monthly_Closing_${c.month.replace(/\s+/g, '_')}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const exportAllMonthlyToCsv = () => {
    if (monthlyClosings.length === 0) return;
    const headers = [
      "No.",
      "Month",
      "Closed By",
      "Total Sales (BDT)",
      "Cash Received (BDT)",
      "Mobile Received (BDT)",
      "Total Expenses (BDT)",
      "Total Wastage (BDT)",
      "Net Profit (BDT)",
      "Total Dues (BDT)",
      "Timestamp"
    ];

    const rows = [...monthlyClosings].reverse().map((c, idx) => [
      String(idx + 1),
      c.month,
      c.closedBy,
      `${c.totalSales || 0}`,
      `${c.totalCashPayments || 0}`,
      `${c.totalMobilePayments || 0}`,
      `${c.totalExpenses || 0}`,
      `${c.totalWastage || 0}`,
      `${c.totalProfit || 0}`,
      `${c.totalDues || 0}`,
      c.timestamp ? new Date(c.timestamp).toLocaleString() : ''
    ]);

    const csvContent = "\uFEFF" + [
      headers.join(","),
      ...rows.map(row => row.map(val => `"${val.replace(/"/g, '""')}"`).join(","))
    ].join("\r\n");

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `SweetBakery_All_Monthly_Closings.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const copyExcelMonthlyToClipboard = (c: MonthlyClosing) => {
    const textStr = `MONTHLY CLOSING REPORT - ${c.month}\n` +
      `-------------------------------------------\n` +
      `Month\t${c.month}\n` +
      `Closed By\t${c.closedBy}\n` +
      `Total Sales (BDT)\t৳${c.totalSales}\n` +
      `Cash Received\t৳${c.totalCashPayments}\n` +
      `Mobile Received\t৳${c.totalMobilePayments}\n` +
      `Total Expenses\t৳${c.totalExpenses}\n` +
      `Wastage Loss\t৳${c.totalWastage}\n` +
      `Total Dues\t৳${c.totalDues}\n` +
      `Net Profit\t৳${c.totalProfit}\n`;
    
    navigator.clipboard.writeText(textStr);
    alert("Excel formatted data copied to clipboard!");
  };

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      <div className="bg-white dark:bg-[#070e1b] p-6 md:p-10 rounded-3xl border border-slate-200 dark:border-[#162744] shadow-sm relative overflow-hidden">
        <div className="relative z-10">
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6 mb-8">
            <div className="flex items-center gap-3">
              <div className="w-11 h-11 bg-[#0a1527] border border-[#00d2ff]/30 rounded-xl flex items-center justify-center text-[#00e5ff] shadow-[0_0_15px_rgba(0,210,255,0.2)]">
                <Calendar size={22} />
              </div>
              <div>
                <h2 className="text-xl md:text-2xl font-black text-slate-900 dark:text-white">Monthly Closing</h2>
                <p className="text-slate-400 text-xs font-medium">Final profit and loss reconciliation at month end</p>
              </div>
            </div>
            <div className="flex flex-col sm:flex-row items-center gap-3 w-full sm:w-auto">
              <input 
                type="month" 
                className="w-full sm:w-auto bg-slate-50 dark:bg-[#0a1527] border border-slate-200 dark:border-[#162744] rounded-xl px-4 py-2.5 text-slate-900 dark:text-white outline-none font-bold text-xs focus:border-[#00e5ff]" 
                value={selectedMonth}
                onChange={e => setSelectedMonth(e.target.value)}
              />
              <button 
                onClick={handleCloseMonth} 
                disabled={isAlreadyClosed}
                className={`w-full sm:w-auto px-6 py-3 flex items-center justify-center gap-2 transition-all uppercase tracking-wider text-xs font-black ${isAlreadyClosed ? 'bg-slate-200 dark:bg-[#0e1a2f] text-slate-500 dark:text-slate-400 rounded-xl border border-slate-700 cursor-not-allowed' : 'smart-cyan-pill cursor-pointer'}`}
              >
                <Lock size={15} /> {isAlreadyClosed ? 'Month Closed' : 'Close Month'}
              </button>
            </div>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-2 md:grid-cols-4 gap-3.5">
            <SummaryItem title="Total Sales" value={monthStats.totalSales} color="text-slate-700 dark:text-slate-200" />
            <SummaryItem title="Cash Received" value={monthStats.totalCashPayments} color="text-emerald-400" />
            <SummaryItem title="Mobile Received" value={monthStats.totalMobilePayments} color="text-[#00e5ff]" />
            <SummaryItem title="Total Expenses" value={monthStats.totalExpenses} color="text-rose-400" />
            <SummaryItem title="Wastage Loss" value={monthStats.totalWastage} color="text-amber-400" />
            <SummaryItem title="Month Dues" value={monthStats.totalDues} color="text-orange-400" />
            <SummaryItem 
              title="Net Profit" 
              value={monthStats.totalProfit} 
              color={monthStats.totalProfit >= 0 ? 'text-emerald-400' : 'text-rose-400'} 
              highlight 
              icon={monthStats.totalProfit >= 0 ? <TrendingUp size={14} /> : <TrendingDown size={14} />}
            />
          </div>

          {error && (
            <div className="mt-4 p-3 bg-rose-500/10 border border-rose-500/20 rounded-xl text-rose-400 text-xs font-bold flex items-center gap-2 animate-in slide-in-from-top-2">
              <AlertCircle size={15} /> {error}
            </div>
          )}

          <div className="mt-6 p-4 bg-[#0a1527] rounded-2xl border border-[#00d2ff]/20 flex items-start gap-3">
            <AlertCircle size={18} className="text-[#00e5ff] flex-shrink-0 mt-0.5" />
            <div className="space-y-0.5">
              <h4 className="text-xs font-bold text-white">Data Protection & Integrity</h4>
              <p className="text-[11px] text-slate-400 font-medium leading-relaxed">
                Closing a month will not delete any active records. Your <strong className="text-white">Customer Dues</strong>, 
                <strong className="text-white"> Inventory Stock</strong>, <strong className="text-white">Staff profiles</strong>, and 
                <strong className="text-white"> Salary/Attendance records</strong> remain safe and intact. This module generates a finalized summary report for {monthLabel}.
              </p>
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <div className="lg:col-span-12 bg-white dark:bg-[#070e1b] p-6 md:p-8 rounded-3xl border border-slate-200 dark:border-[#162744] shadow-sm overflow-hidden">
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2.5">
              <BarChart3 size={20} className="text-[#00e5ff]" />
              Monthly Performance Trend
            </h3>
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Profit & Loss Overview</p>
          </div>
          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={monthlyClosings.slice(-12)}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#162744" />
                <XAxis dataKey="month" stroke="#64748b" fontSize={10} tickLine={false} axisLine={false} />
                <YAxis stroke="#64748b" fontSize={10} tickLine={false} axisLine={false} />
                <Tooltip 
                  contentStyle={{ backgroundColor: '#070e1b', borderColor: '#162744', borderRadius: '12px', color: '#fff' }}
                  cursor={{ fill: 'rgba(0, 210, 255, 0.05)' }}
                />
                <Bar dataKey="totalProfit" radius={[6, 6, 0, 0]}>
                  {monthlyClosings.slice(-12).map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.totalProfit >= 0 ? '#10b981' : '#f43f5e'} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="lg:col-span-12 bg-white dark:bg-[#070e1b] rounded-3xl border border-slate-200 dark:border-[#162744] shadow-sm overflow-hidden">
          <div className="p-6 md:p-8 border-b border-slate-100 dark:border-[#162744] flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
            <div>
              <h3 className="text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2.5">
                <History size={20} className="text-[#00e5ff]" />
                Detailed Monthly History
              </h3>
              <p className="text-xs text-slate-400 mt-0.5">Historical breakdown of monthly performance and net profit</p>
            </div>
            <div className="flex items-center gap-3 flex-wrap">
              {monthlyClosings.length > 0 && (
                <button 
                  onClick={exportAllMonthlyToCsv}
                  className="flex items-center gap-2 px-4 py-2 bg-[#0a1527] hover:bg-[#00d2ff]/20 text-[#00e5ff] rounded-xl border border-[#00d2ff]/30 text-xs font-bold transition-all shadow-[0_0_10px_rgba(0,210,255,0.15)] cursor-pointer"
                >
                  <FileSpreadsheet size={15} /> Export All to Excel
                </button>
              )}
              <div className="flex items-center gap-2 px-3.5 py-2 bg-slate-50 dark:bg-[#0a1527] rounded-xl border border-slate-200 dark:border-[#162744]">
                 <span className="text-xs font-bold text-slate-400">Total Reports: {monthlyClosings.length}</span>
              </div>
            </div>
          </div>
          
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50/50 dark:bg-[#0a1527]/50 border-b border-slate-100 dark:border-[#162744]">
                  <th className="px-8 py-4 text-[10px] font-bold uppercase tracking-widest text-slate-400">Month</th>
                  <th className="px-8 py-4 text-[10px] font-bold uppercase tracking-widest text-slate-400">Sales</th>
                  <th className="px-8 py-4 text-[10px] font-bold uppercase tracking-widest text-rose-400">Expenses</th>
                  <th className="px-8 py-4 text-[10px] font-bold uppercase tracking-widest text-amber-400">Wastage</th>
                  <th className="px-8 py-4 text-[10px] font-bold uppercase tracking-widest text-emerald-400">Net Profit</th>
                  <th className="px-8 py-4 text-[10px] font-bold uppercase tracking-widest text-slate-400 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-[#162744]">
                {[...monthlyClosings].reverse().map((c) => (
                  <tr key={c.id} className="hover:bg-slate-50/50 dark:hover:bg-[#0a1527]/50 transition-colors text-sm">
                    <td className="px-8 py-4">
                      <div className="flex flex-col">
                        <span className="text-sm font-black text-slate-900 dark:text-white">{c.month}</span>
                        <span className="text-[10px] font-bold text-slate-400 uppercase">By {c.closedBy}</span>
                      </div>
                    </td>
                    <td className="px-8 py-4">
                      <span className="text-sm font-bold text-slate-700 dark:text-slate-300">৳{(c.totalSales || 0).toLocaleString()}</span>
                    </td>
                    <td className="px-8 py-4">
                      <span className="text-sm font-bold text-rose-400">৳{(c.totalExpenses || 0).toLocaleString()}</span>
                    </td>
                    <td className="px-8 py-4">
                      <span className="text-sm font-bold text-amber-400">৳{(c.totalWastage || 0).toLocaleString()}</span>
                    </td>
                    <td className="px-8 py-4">
                      <div className="flex items-center gap-2">
                        <span className={`text-sm font-black ${c.totalProfit >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                          ৳{(c.totalProfit || 0).toLocaleString()}
                        </span>
                        {c.totalProfit >= 0 ? <TrendingUp size={14} className="text-emerald-400" /> : <TrendingDown size={14} className="text-rose-400" />}
                      </div>
                    </td>
                    <td className="px-8 py-4 text-right">
                      <div className="flex justify-end gap-1.5">
                        <button 
                          onClick={() => setActivePrintRecord(c)} 
                          className="p-2 text-slate-400 hover:text-emerald-400 hover:bg-[#0a1527] rounded-lg transition-all cursor-pointer"
                          title="Excel Details & Download"
                        >
                          <FileSpreadsheet size={15} />
                        </button>
                        <button 
                          onClick={() => onDeleteMonthlyClosing(c.id)} 
                          className="p-2 text-slate-400 hover:text-rose-400 hover:bg-[#0a1527] rounded-lg transition-all cursor-pointer"
                          title="Delete"
                        >
                          <Trash2 size={15} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
                {monthlyClosings.length === 0 && (
                  <tr>
                    <td colSpan={6} className="px-8 py-16 text-center">
                      <div className="flex flex-col items-center gap-3 opacity-30">
                        <History size={48} className="text-slate-400" />
                        <p className="font-bold text-xs text-slate-400 uppercase tracking-wider">No monthly records found</p>
                      </div>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {activePrintRecord && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 backdrop-blur-md p-4 no-print overflow-y-auto">
          <div className="bg-white dark:bg-[#070e1b] w-full max-w-2xl rounded-3xl shadow-2xl border border-slate-200 dark:border-[#162744] overflow-hidden my-8 animate-in zoom-in duration-300">
            <div className="p-6 border-b border-slate-100 dark:border-[#162744] flex justify-between items-center bg-slate-50 dark:bg-[#0a1527]">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-emerald-500/10 border border-emerald-500/30 rounded-xl flex items-center justify-center text-emerald-400">
                  <FileSpreadsheet size={20} />
                </div>
                <div>
                  <h3 className="font-black text-slate-900 dark:text-white uppercase tracking-wider text-sm flex items-center gap-2">
                    Monthly Statement
                  </h3>
                  <p className="text-[10px] font-bold text-slate-400 uppercase">Month: {activePrintRecord.month}</p>
                </div>
              </div>
              <button 
                onClick={() => setActivePrintRecord(null)} 
                className="p-2 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition-all cursor-pointer"
              >
                <X size={18} />
              </button>
            </div>

            <div className="p-6 overflow-y-auto max-h-[75vh]">
              {/* EXCEL SHEET TEMPLATE ONLY */}
              <div className="space-y-6">
                <div className="p-3 border border-emerald-500/20 bg-emerald-500/5 rounded-2xl flex items-center justify-between text-xs text-emerald-400 font-bold">
                  <span className="flex items-center gap-2">
                    <AlertCircle size={15} /> You can download this statement as a spreadsheet (.csv) file.
                  </span>
                  <button 
                    onClick={() => exportSingleMonthlyCsv(activePrintRecord)}
                    className="px-3 py-1.5 bg-emerald-500 hover:bg-emerald-600 text-white font-bold rounded-lg flex items-center gap-1 transition-all text-xs cursor-pointer"
                  >
                    <Download size={13} /> Excel (.csv)
                  </button>
                </div>

                <div className="border border-slate-200 dark:border-[#162744] rounded-xl overflow-hidden font-mono text-[11px] text-slate-800 dark:text-slate-200 bg-white dark:bg-[#050b14] shadow-sm">
                  {/* Excel Sheet header tabs & bar */}
                  <div className="bg-slate-50 dark:bg-[#0a1527] px-4 py-2 border-b border-slate-200 dark:border-[#162744] flex items-center gap-4 text-slate-400 text-[10px]">
                    <span className="font-bold text-slate-600 dark:text-slate-300">File: MONTHLY_REPORT_{activePrintRecord.month.replace(/\s+/g,'_')}.xlsx</span>
                    <span className="hidden sm:inline">|</span>
                    <span className="hidden sm:inline">Columns: A-K</span>
                    <span className="hidden sm:inline">|</span>
                    <span className="hidden sm:inline">Sheet1</span>
                  </div>

                  <div className="grid grid-cols-[30px_1fr_1fr] border-b border-slate-200 dark:border-[#162744] bg-slate-100/70 dark:bg-[#0a1527] text-slate-400 text-center font-bold font-sans">
                    <div className="border-r border-slate-200 dark:border-[#162744] py-1">*</div>
                    <div className="border-r border-slate-200 dark:border-[#162744] py-1 uppercase text-[9px] tracking-wider text-left pl-3">A (Item Parameter)</div>
                    <div className="py-1 uppercase text-[9px] tracking-wider text-right pr-3">B (Amount / Value)</div>
                  </div>

                  {[
                    { key: "Month", val: activePrintRecord.month },
                    { key: "Total Sales", val: `৳${(activePrintRecord.totalSales || 0).toLocaleString()}`, highlight: true },
                    { key: "Cash Received", val: `৳${(activePrintRecord.totalCashPayments || 0).toLocaleString()}` },
                    { key: "Mobile Received", val: `৳${(activePrintRecord.totalMobilePayments || 0).toLocaleString()}` },
                    { key: "Total Expenses", val: `৳${(activePrintRecord.totalExpenses || 0).toLocaleString()}` },
                    { key: "Wastage Loss", val: `৳${(activePrintRecord.totalWastage || 0).toLocaleString()}` },
                    { key: "Customer Dues", val: `৳${(activePrintRecord.totalDues || 0).toLocaleString()}` },
                    { key: "Net Profit", val: `৳${(activePrintRecord.totalProfit || 0).toLocaleString()}`, highlight: true, profit: activePrintRecord.totalProfit >= 0 },
                    { key: "Closed By", val: activePrintRecord.closedBy },
                    { key: "Approved Code", val: "APPROVED_BY_PIN" },
                    { key: "Timestamp", val: activePrintRecord.timestamp ? new Date(activePrintRecord.timestamp).toLocaleString() : '' }
                  ].map((row, index) => (
                    <div key={index} className={`grid grid-cols-[30px_1fr_1fr] border-b border-slate-200 dark:border-[#162744] hover:bg-slate-50 dark:hover:bg-[#0a1527]/40 ${row.highlight ? (row.profit !== undefined ? (row.profit ? 'bg-emerald-500/5' : 'bg-rose-500/5') : 'bg-slate-50 dark:bg-[#0a1527]/30 font-black') : ''}`}>
                      <div className="border-r border-slate-200 dark:border-[#162744] py-2.5 text-center bg-slate-50/50 dark:bg-[#0a1527]/50 text-[9px] text-slate-400 font-sans font-bold">{index + 1}</div>
                      <div className="border-r border-slate-200 dark:border-[#162744] py-2.5 pl-3 flex items-center font-bold text-slate-600 dark:text-slate-300">
                        {row.key}
                      </div>
                      <div className={`py-2.5 pr-3 text-right font-black ${row.profit !== undefined ? (row.profit ? 'text-emerald-400' : 'text-rose-400') : 'text-slate-900 dark:text-white'}`}>
                        {row.val}
                      </div>
                    </div>
                  ))}
                </div>

                <div className="flex gap-2">
                  <button 
                    onClick={() => exportSingleMonthlyCsv(activePrintRecord)}
                    className="flex-1 py-3 bg-emerald-500 hover:bg-emerald-600 border border-emerald-600/25 text-white text-xs font-bold transition-all rounded-xl flex items-center justify-center gap-2 shadow-md shadow-emerald-500/10 cursor-pointer"
                  >
                    <Download size={15} /> Download Excel (.csv)
                  </button>
                  <button 
                    onClick={() => copyExcelMonthlyToClipboard(activePrintRecord)}
                    className="px-4 py-3 bg-slate-100 hover:bg-slate-200 dark:bg-[#0a1527] dark:hover:bg-[#162744] text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-[#162744] text-xs font-bold rounded-xl flex items-center justify-center gap-2 transition-all cursor-pointer"
                    title="Copy spreadsheet table to clipboard"
                  >
                    <Copy size={15} /> Clipboard Copy
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Manager Authentication Permission Modal */}
      {showAuthModal && (
        <div className="fixed inset-0 z-[300] flex items-center justify-center bg-black/80 backdrop-blur-md p-4 no-print animate-in fade-in duration-300">
          <div className="bg-white dark:bg-[#070e1b] w-full max-w-md rounded-3xl shadow-2xl overflow-hidden p-8 border border-slate-200 dark:border-[#162744] animate-in zoom-in duration-305">
            <div className="w-14 h-14 bg-[#0a1527] border border-[#00d2ff]/30 rounded-2xl flex items-center justify-center mx-auto mb-5 text-[#00e5ff] shadow-[0_0_15px_rgba(0,210,255,0.2)]">
              <Lock size={26} />
            </div>
            
            <h3 className="text-lg font-black text-slate-900 dark:text-white text-center mb-1">Manager Permission Required</h3>
            <p className="text-slate-400 text-center text-xs font-bold mb-6">
              Manager PIN / password is required to finalize monthly closing.
            </p>
            
            <form onSubmit={handleAuthVerify} className="space-y-4">
              <div>
                <label className="text-[10px] font-black uppercase text-slate-400 tracking-wider mb-2 block">Manager PIN</label>
                <input 
                  type="password" 
                  className="w-full bg-slate-50 dark:bg-[#050b14] border border-slate-200 dark:border-[#162744] text-center p-3.5 rounded-xl text-lg font-black tracking-widest text-slate-900 dark:text-white outline-none focus:border-[#00e5ff] transition-all placeholder:tracking-normal placeholder:font-medium placeholder:text-slate-500"
                  placeholder="••••"
                  value={pinInput}
                  onChange={e => setPinInput(e.target.value)}
                  autoFocus
                />
              </div>

              {pinError && (
                <p className="text-xs text-rose-400 bg-rose-500/10 p-3 rounded-lg font-bold text-center border border-rose-500/20">
                  {pinError}
                </p>
              )}

              <div className="flex gap-3 pt-2">
                <button 
                  type="button" 
                  onClick={() => { setShowAuthModal(false); setPinInput(''); setPinError(null); }}
                  className="flex-1 py-3 bg-slate-100 hover:bg-slate-200 dark:bg-[#0a1527] dark:hover:bg-[#162744] text-slate-700 dark:text-slate-300 rounded-xl text-xs font-bold transition-all cursor-pointer border border-slate-200 dark:border-[#162744]"
                >
                  Cancel
                </button>
                <button 
                  type="submit"
                  className="flex-1 py-3 smart-cyan-pill text-xs font-black uppercase tracking-wider cursor-pointer"
                >
                  Confirm
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

const SummaryItem = ({ title, value, color, highlight, icon }: any) => (
  <div className={`p-4 rounded-2xl border flex flex-col justify-between h-full ${highlight ? 'bg-[#0a1527] border-emerald-500/30' : 'bg-slate-50 dark:bg-[#0a1527] border-slate-200 dark:border-[#162744]'}`}>
    <div>
      <h4 className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1 flex items-center gap-1">
        {icon} {title}
      </h4>
    </div>
    <div className={`text-lg font-black ${color}`}>৳{(value || 0).toLocaleString()}</div>
  </div>
);

export default MonthlyClosingView;
