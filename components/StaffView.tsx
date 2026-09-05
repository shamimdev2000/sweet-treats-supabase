import React, { useState } from 'react';
import { Staff, Attendance, Expense, Deduction, Sale } from '../types';
import { generateId } from '../services/idGenerator';
import { 
  Plus, 
  Calendar, 
  CheckCircle2, 
  UserPlus, 
  Users, 
  Banknote, 
  PiggyBank, 
  MinusCircle, 
  X
} from 'lucide-react';

interface Props {
  staff: Staff[];
  attendance: Attendance[];
  expenses: Expense[];
  deductions: Deduction[];
  sales?: Sale[];
  onAddStaff: (s: Staff) => void;
  onUpdateAttendance: (a: Attendance) => void;
  onAddDeduction: (d: Deduction) => void;
  onPaySalary: (staffId: string, amount: number) => void;
}

const StaffView: React.FC<Props> = ({ 
  staff = [], 
  attendance = [], 
  expenses = [], 
  deductions = [], 
  onAddStaff, 
  onUpdateAttendance, 
  onAddDeduction, 
  onPaySalary 
}) => {
  const [activeTab, setActiveTab] = useState<'attendance' | 'salary'>('attendance');
  const [isAdding, setIsAdding] = useState(false);
  const [isDeducting, setIsDeducting] = useState<string | null>(null);
  const [confirmSalaryStaff, setConfirmSalaryStaff] = useState<{id: string, name: string, amount: number} | null>(null);
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);

  const [staffFormData, setStaffFormData] = useState({
    name: '',
    designation: '',
    monthlySalary: '' as number | ''
  });

  const [deductionFormData, setDeductionFormData] = useState({
    amount: '' as number | '',
    reason: ''
  });

  // Current Month Data Calculations
  const now = new Date();
  const currentMonth = now.getMonth();
  const currentYear = now.getFullYear();
  const currentMonthName = now.toLocaleString('default', { month: 'long' });

  const handleAddStaff = (e: React.FormEvent) => {
    e.preventDefault();
    onAddStaff({
      ...staffFormData,
      monthlySalary: Number(staffFormData.monthlySalary) || 0,
      id: generateId('stf'),
      joinDate: new Date().toISOString()
    } as Staff);
    setStaffFormData({ name: '', designation: '', monthlySalary: '' });
    setIsAdding(false);
  };

  const handleAddDeduction = (e: React.FormEvent) => {
    e.preventDefault();
    if (!isDeducting) return;
    
    onAddDeduction({
      id: generateId('ded'),
      staffId: isDeducting,
      amount: Number(deductionFormData.amount) || 0,
      reason: deductionFormData.reason,
      date: new Date().toISOString()
    });
    
    setDeductionFormData({ amount: '', reason: '' });
    setIsDeducting(null);
  };

  const getStatus = (staffId: string) => {
    const record = attendance.find(a => a.staffId === staffId && a.date === selectedDate);
    return record?.status || 'Not Marked';
  };

  const calculateTotalPaid = (staffName: string) => {
    return expenses
      .filter(e => e.category === 'Salary' && e.description.toLowerCase().includes(staffName.toLowerCase()))
      .reduce((sum, e) => sum + e.amount, 0);
  };

  const getCurrentMonthDeductions = (staffId: string) => {
    return deductions
      .filter(d => {
        const dDate = new Date(d.date);
        return d.staffId === staffId && dDate.getMonth() === currentMonth && dDate.getFullYear() === currentYear;
      })
      .reduce((sum, d) => sum + d.amount, 0);
  };

  const getPaymentHistory = (staffName: string) => {
    return expenses
      .filter(e => e.category === 'Salary' && e.description.toLowerCase().includes(staffName.toLowerCase()))
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  };

  const recentAttendance = [...attendance]
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
    .slice(0, 10);

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      {/* Top Header Row with Navigation Tabs */}
      <div className="flex flex-col sm:flex-row justify-between items-center gap-4">
        <div className="flex bg-white dark:bg-[#070d19] p-1.5 rounded-full border border-slate-200 dark:border-[#162744] shadow-sm">
          <button 
            onClick={() => setActiveTab('attendance')}
            className={`px-6 py-2.5 rounded-full font-bold transition-all text-xs uppercase tracking-wider cursor-pointer ${activeTab === 'attendance' ? 'smart-cyan-pill' : 'text-slate-500 dark:text-slate-400 hover:text-white'}`}
          >
            Attendance
          </button>
          <button 
            onClick={() => setActiveTab('salary')}
            className={`px-6 py-2.5 rounded-full font-bold transition-all text-xs uppercase tracking-wider cursor-pointer ${activeTab === 'salary' ? 'smart-cyan-pill' : 'text-slate-500 dark:text-slate-400 hover:text-white'}`}
          >
            Salaries & Payments
          </button>
        </div>

        <div className="flex items-center gap-3">
          {activeTab === 'attendance' && (
            <div className="relative group bg-white dark:bg-[#0a1220] rounded-full border border-slate-200 dark:border-[#162744]">
              <input 
                type="date" 
                className="bg-transparent border-none p-2.5 px-4 pr-10 rounded-full text-slate-900 dark:text-white outline-none focus:ring-0 cursor-pointer text-xs font-bold"
                value={selectedDate}
                onChange={e => setSelectedDate(e.target.value)}
              />
              <Calendar className="absolute right-3.5 top-1/2 -translate-y-1/2 text-[#00e5ff] pointer-events-none" size={15} />
            </div>
          )}
          <button 
            onClick={() => setIsAdding(!isAdding)}
            className="smart-cyan-pill px-5 py-2.5 text-xs uppercase tracking-wider flex items-center gap-2 cursor-pointer font-bold"
          >
            <Plus size={15} />
            <span>Add Staff</span>
          </button>
        </div>
      </div>

      {/* Staff Registration Modal Form */}
      {isAdding && (
        <div className="bg-white dark:bg-[#070e1b] p-6 sm:p-8 rounded-3xl border border-slate-200 dark:border-[#162744] shadow-sm animate-in fade-in zoom-in duration-300">
          <h3 className="text-lg font-bold mb-5 text-slate-900 dark:text-white flex items-center gap-2">
            <div className="w-9 h-9 bg-[#0a1527] border border-[#00d2ff]/30 rounded-xl flex items-center justify-center text-[#00e5ff]">
              <UserPlus size={18} />
            </div>
            Register Staff Member
          </h3>
          <form onSubmit={handleAddStaff} className="grid grid-cols-1 md:grid-cols-3 gap-5">
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-400 uppercase px-1">Full Name</label>
              <input required type="text" className="w-full p-3.5 rounded-xl bg-slate-50 dark:bg-[#0a1527] border border-slate-200 dark:border-[#162744] text-slate-900 dark:text-white outline-none focus:border-[#00e5ff] text-sm" value={staffFormData.name} onChange={e => setStaffFormData({...staffFormData, name: e.target.value})} placeholder="e.g. Shuvo Rahman" />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-400 uppercase px-1">Designation</label>
              <input required type="text" className="w-full p-3.5 rounded-xl bg-slate-50 dark:bg-[#0a1527] border border-slate-200 dark:border-[#162744] text-slate-900 dark:text-white outline-none focus:border-[#00e5ff] text-sm" value={staffFormData.designation} onChange={e => setStaffFormData({...staffFormData, designation: e.target.value})} placeholder="e.g. Master Baker / Cashier" />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-400 uppercase px-1">Monthly Salary (৳)</label>
              <input required type="number" className="w-full p-3.5 rounded-xl bg-slate-50 dark:bg-[#0a1527] border border-slate-200 dark:border-[#162744] text-slate-900 dark:text-white outline-none focus:border-[#00e5ff] text-sm font-bold" value={staffFormData.monthlySalary} onChange={e => setStaffFormData({...staffFormData, monthlySalary: e.target.value === '' ? '' : Number(e.target.value)})} placeholder="0" />
            </div>
            <div className="md:col-span-3 flex justify-end gap-3 pt-2">
              <button type="button" onClick={() => setIsAdding(false)} className="px-5 py-2 text-slate-400 font-semibold hover:text-white transition-colors text-xs uppercase tracking-wider cursor-pointer">Cancel</button>
              <button type="submit" className="smart-cyan-pill px-6 py-2.5 text-xs uppercase tracking-wider cursor-pointer">Save Staff</button>
            </div>
          </form>
        </div>
      )}

      {/* Main Views for Attendance or Salary */}
      {activeTab === 'attendance' ? (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          {/* Main Attendance List */}
          <div className="lg:col-span-7">
            <div className="bg-white dark:bg-[#070e1b] rounded-3xl border border-slate-200 dark:border-[#162744] overflow-hidden shadow-sm">
              <div className="px-6 py-4 border-b border-slate-100 dark:border-[#162744] flex items-center justify-between">
                <h3 className="text-base font-bold text-slate-900 dark:text-white">Daily Attendance for {new Date(selectedDate).toLocaleDateString()}</h3>
                <span className="text-xs text-[#00e5ff] font-bold">Total Staff: {staff.length}</span>
              </div>
              <div className="p-5 space-y-3">
                {staff.map(s => {
                  const status = getStatus(s.id);
                  return (
                    <div key={s.id} className="flex flex-col sm:flex-row items-center justify-between p-4 px-5 bg-slate-50 dark:bg-[#0a1527] rounded-2xl border border-slate-200 dark:border-[#162744] hover:border-[#00d2ff]/40 transition-all gap-4">
                      <div className="flex items-center gap-3.5 w-full sm:w-auto">
                        <div className="w-10 h-10 rounded-xl bg-[#070e1b] border border-[#00d2ff]/30 flex items-center justify-center text-[#00e5ff] font-bold text-sm shadow-[0_0_10px_rgba(0,210,255,0.2)]">
                          {s.name.charAt(0).toUpperCase()}
                        </div>
                        <div>
                          <h4 className="font-bold text-sm text-slate-900 dark:text-white">{s.name}</h4>
                          <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">{s.designation}</p>
                        </div>
                      </div>
                      
                      <div className="flex gap-2 w-full sm:w-auto">
                        <button 
                          onClick={() => onUpdateAttendance({ id: Date.now().toString(), staffId: s.id, date: selectedDate, status: 'Present' })}
                          className={`flex-1 sm:flex-none px-3.5 py-2 rounded-xl font-bold text-xs transition-all cursor-pointer ${status === 'Present' ? 'bg-emerald-500 text-white shadow-[0_0_10px_rgba(16,185,129,0.3)]' : 'bg-slate-200 dark:bg-[#070e1b] border border-slate-300 dark:border-[#162744] text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'}`}
                        >
                          Present
                        </button>
                        <button 
                          onClick={() => onUpdateAttendance({ id: Date.now().toString(), staffId: s.id, date: selectedDate, status: 'Late' })}
                          className={`flex-1 sm:flex-none px-3.5 py-2 rounded-xl font-bold text-xs transition-all cursor-pointer ${status === 'Late' ? 'bg-amber-500 text-white shadow-[0_0_10px_rgba(245,158,11,0.3)]' : 'bg-slate-200 dark:bg-[#070e1b] border border-slate-300 dark:border-[#162744] text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'}`}
                        >
                          Late
                        </button>
                        <button 
                          onClick={() => onUpdateAttendance({ id: Date.now().toString(), staffId: s.id, date: selectedDate, status: 'Absent' })}
                          className={`flex-1 sm:flex-none px-3.5 py-2 rounded-xl font-bold text-xs transition-all cursor-pointer ${status === 'Absent' ? 'bg-rose-500 text-white shadow-[0_0_10px_rgba(244,63,94,0.3)]' : 'bg-slate-200 dark:bg-[#070e1b] border border-slate-300 dark:border-[#162744] text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'}`}
                        >
                          Absent
                        </button>
                      </div>
                    </div>
                  );
                })}
                {staff.length === 0 && (
                  <div className="p-12 text-center text-slate-400">
                    <Users size={36} className="mx-auto mb-3 opacity-20 text-[#00e5ff]" />
                    <p className="text-xs font-bold uppercase tracking-wider">No staff added yet.</p>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* History Sidebar */}
          <div className="lg:col-span-5 space-y-6">
            <div className="bg-white dark:bg-[#070e1b] rounded-3xl border border-slate-200 dark:border-[#162744] overflow-hidden shadow-sm">
              <div className="px-6 py-4 flex items-center justify-between border-b border-slate-100 dark:border-[#162744]">
                <h3 className="text-xs font-bold text-slate-900 dark:text-white uppercase tracking-widest">Recent Attendance Records</h3>
              </div>
              <div className="divide-y divide-slate-100 dark:divide-[#162744]">
                 {recentAttendance.length === 0 ? (
                    <div className="p-10 text-center text-slate-400 font-bold uppercase tracking-widest text-[10px]">No records found</div>
                 ) : (
                    recentAttendance.map(a => {
                       const staffMember = staff.find(s => s.id === a.staffId);
                       return (
                          <div key={a.id} className="p-4 px-6 flex justify-between items-center hover:bg-slate-50 dark:hover:bg-[#0a1527]/50 transition-colors">
                              <div>
                                <div className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mb-0.5">{new Date(a.date).toLocaleDateString()}</div>
                                <div className="text-xs font-bold text-slate-900 dark:text-white">{staffMember?.name || 'Unknown'}</div>
                              </div>
                              <span className={`font-black uppercase tracking-widest text-[10px] ${
                                a.status === 'Present' ? 'text-emerald-400' : 
                                a.status === 'Late' ? 'text-amber-400' : 'text-rose-400'
                              }`}>
                                {a.status}
                              </span>
                          </div>
                       );
                    })
                 )}
              </div>
            </div>
          </div>
        </div>
      ) : (
        /* Salaries View */
        <div className="bg-white dark:bg-[#070e1b] p-6 lg:p-8 rounded-3xl border border-slate-200 dark:border-[#162744] shadow-sm">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {staff.map(s => {
              const totalPaid = calculateTotalPaid(s.name);
              const history = getPaymentHistory(s.name);
              const currentMonthDeductions = getCurrentMonthDeductions(s.id);
              const netPayable = s.monthlySalary - currentMonthDeductions;
              const isPaidThisMonth = history.some(h => h.description.includes(currentMonthName) && h.description.includes(new Date().getFullYear().toString()));

              return (
                <div key={s.id} className="bg-slate-50 dark:bg-[#0a1527] p-6 rounded-3xl border border-slate-200 dark:border-[#162744] hover:border-[#00d2ff]/40 transition-all group flex flex-col h-full shadow-sm">
                  <div className="flex justify-center mb-3 relative">
                    <div className="w-12 h-12 bg-[#070e1b] border border-[#00d2ff]/30 rounded-2xl flex items-center justify-center text-[#00e5ff] shadow-[0_0_15px_rgba(0,210,255,0.2)] group-hover:scale-105 transition-transform">
                      <Banknote size={24} />
                    </div>
                    <button onClick={() => setIsDeducting(s.id)} className="absolute -top-1 -right-1 p-1.5 bg-rose-500 text-white rounded-full shadow-lg hover:scale-110 transition-transform cursor-pointer" title="Add Deduction"><MinusCircle size={13} /></button>
                  </div>
                  <div className="text-center mb-5">
                    <h4 className="text-base font-bold mb-0.5 text-slate-900 dark:text-white">{s.name}</h4>
                    <p className="text-slate-400 text-[10px] font-bold uppercase tracking-widest mb-3">{s.designation}</p>
                    <div className="mt-2 p-3.5 bg-white dark:bg-[#070e1b] rounded-2xl border border-slate-200 dark:border-[#162744] shadow-sm">
                       <span className="text-[10px] text-[#00e5ff] uppercase font-bold tracking-widest mb-1 block">Net Payable ({currentMonthName})</span>
                       <div className="text-xl font-black text-slate-900 dark:text-white">৳{netPayable.toLocaleString()}</div>
                       {currentMonthDeductions > 0 && (
                         <span className="text-[10px] text-rose-400 font-bold block mt-0.5">Includes ৳{currentMonthDeductions.toLocaleString()} deduction</span>
                       )}
                    </div>
                  </div>
                  <div className="space-y-2.5 mb-5 flex-grow">
                    <div className="bg-white dark:bg-[#070e1b] p-3 rounded-xl border border-slate-200 dark:border-[#162744] flex items-center justify-between">
                       <div className="flex items-center gap-2 text-emerald-400">
                          <PiggyBank size={14} />
                          <span className="text-[10px] font-bold uppercase">Lifetime Paid</span>
                       </div>
                       <div className="text-xs font-bold text-slate-900 dark:text-white">৳{totalPaid.toLocaleString()}</div>
                    </div>
                  </div>
                  <button 
                    onClick={() => { setConfirmSalaryStaff({id: s.id, name: s.name, amount: netPayable}); }}
                    disabled={isPaidThisMonth}
                    className={`w-full font-bold py-3 rounded-xl transition-all cursor-pointer active:scale-95 mt-auto flex items-center justify-center gap-2 text-xs uppercase tracking-wider ${isPaidThisMonth ? 'bg-slate-200 dark:bg-[#070e1b] text-slate-400 cursor-not-allowed border border-slate-300 dark:border-[#162744]' : 'smart-cyan-pill'}`}
                  >
                    {isPaidThisMonth ? <CheckCircle2 size={15} /> : <Banknote size={15} />}
                    {isPaidThisMonth ? 'Already Paid This Month' : 'Pay Net Salary'}
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Salary Confirmation Modal */}
      {confirmSalaryStaff && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-6 bg-black/80 backdrop-blur-md animate-in fade-in duration-300">
           <div className="bg-white dark:bg-[#070e1b] p-7 rounded-3xl border border-slate-200 dark:border-[#162744] shadow-2xl w-full max-w-sm animate-in zoom-in duration-300 text-center">
              <div className="w-14 h-14 bg-[#0a1527] border border-[#00d2ff]/30 rounded-2xl flex items-center justify-center mx-auto mb-4 text-[#00e5ff] shadow-[0_0_15px_rgba(0,210,255,0.2)]">
                <Banknote size={28} />
              </div>
              <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-1.5">Salary Payment</h3>
              <p className="text-slate-600 dark:text-slate-400 mb-6 text-xs">
                Confirm salary payment of <span className="text-slate-900 dark:text-white font-bold">৳{confirmSalaryStaff.amount.toLocaleString()}</span> to <span className="text-[#00e5ff] font-bold">{confirmSalaryStaff.name}</span> for {currentMonthName}?
              </p>
              <div className="flex flex-col gap-2.5">
                <button 
                  onClick={() => {
                    onPaySalary(confirmSalaryStaff.id, confirmSalaryStaff.amount);
                    setConfirmSalaryStaff(null);
                  }} 
                  className="w-full smart-cyan-pill py-3 text-xs uppercase tracking-wider cursor-pointer font-bold"
                >
                  Confirm Payment
                </button>
                <button 
                  onClick={() => setConfirmSalaryStaff(null)} 
                  className="w-full bg-slate-100 dark:bg-[#0a1527] border border-slate-200 dark:border-[#162744] text-slate-600 dark:text-slate-400 font-bold py-3 rounded-xl hover:text-white transition-all text-xs uppercase tracking-wider cursor-pointer"
                >
                  Cancel
                </button>
              </div>
           </div>
        </div>
      )}

      {/* Deduction Modal */}
      {isDeducting && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-6 bg-black/80 backdrop-blur-md">
           <div className="bg-white dark:bg-[#070e1b] p-7 rounded-3xl border border-slate-200 dark:border-[#162744] shadow-2xl w-full max-w-sm animate-in zoom-in duration-300">
              <div className="flex justify-between items-center mb-5">
                 <h3 className="text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
                   <div className="w-8 h-8 bg-rose-500/10 border border-rose-500/20 rounded-xl flex items-center justify-center text-rose-500">
                     <MinusCircle size={16} />
                   </div>
                   Add Deduction
                 </h3>
                 <button onClick={() => setIsDeducting(null)} className="text-slate-400 hover:text-white cursor-pointer"><X size={18} /></button>
              </div>
              <form onSubmit={handleAddDeduction} className="space-y-4">
                 <div className="space-y-1.5">
                    <label className="text-xs font-bold text-slate-400 uppercase px-1">Amount (৳)</label>
                    <input required type="number" className="w-full p-3 rounded-xl bg-slate-50 dark:bg-[#0a1527] border border-slate-200 dark:border-[#162744] text-slate-900 dark:text-white outline-none focus:border-[#00e5ff] text-xs font-bold" value={deductionFormData.amount} onChange={e => setDeductionFormData({...deductionFormData, amount: e.target.value === '' ? '' : Number(e.target.value)})} placeholder="0.00" />
                 </div>
                 <div className="space-y-1.5">
                    <label className="text-xs font-bold text-slate-400 uppercase px-1">Reason</label>
                    <textarea required className="w-full p-3 rounded-xl bg-slate-50 dark:bg-[#0a1527] border border-slate-200 dark:border-[#162744] text-slate-900 dark:text-white outline-none focus:border-[#00e5ff] text-xs h-20 resize-none" value={deductionFormData.reason} onChange={e => setDeductionFormData({...deductionFormData, reason: e.target.value})} placeholder="Reason for deduction..." />
                 </div>
                 <button type="submit" className="w-full bg-rose-500 hover:bg-rose-600 text-white font-bold py-3 rounded-xl shadow-lg transition-all text-xs uppercase tracking-wider cursor-pointer">Record Deduction</button>
              </form>
           </div>
        </div>
      )}
    </div>
  );
};

export default StaffView;
