import React, { useState, useEffect, useMemo } from 'react';
import { 
  RefreshCw, 
  CheckCircle2, 
  AlertTriangle, 
  XCircle, 
  Activity, 
  Copy, 
  Trash2, 
  Search, 
  ChevronDown, 
  ChevronUp, 
  Cloud, 
  Database, 
  Laptop, 
  Smartphone, 
  Info,
  Clock,
  ArrowUpDown,
  Check
} from 'lucide-react';
import { SyncLogEntry } from '../types';
import { storageService } from '../services/storageService';
import { isSupabaseConfigured } from '../services/supabaseClient';

interface SyncLogsViewProps {
  username: string;
  onRunSync?: () => Promise<void>;
  onRunDiagnostic?: () => Promise<void>;
}

export const SyncLogsView: React.FC<SyncLogsViewProps> = ({
  username,
  onRunSync,
  onRunDiagnostic
}) => {
  const [logs, setLogs] = useState<SyncLogEntry[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'success' | 'error' | 'warning'>('all');
  const [expandedLogId, setExpandedLogId] = useState<string | null>(null);
  const [isSyncing, setIsSyncing] = useState(false);
  const [isTesting, setIsTesting] = useState(false);
  const [copiedNotification, setCopiedNotification] = useState(false);
  const [actionMessage, setActionMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Load logs on mount and when username changes
  const refreshLogs = () => {
    const fetched = storageService.getSyncLogs(username);
    setLogs(fetched);
  };

  useEffect(() => {
    refreshLogs();
  }, [username]);

  // Handle Manual Sync
  const handleManualSync = async () => {
    setIsSyncing(true);
    setActionMessage(null);
    try {
      if (onRunSync) {
        await onRunSync();
      } else {
        const res = await storageService.syncAllLocalDataToSupabase(username);
        if (res.success) {
          setActionMessage({
            type: 'success',
            text: `ক্লাউড সিঙ্ক সফল! ${res.count} টি রেকর্ড ক্লাউডে সিঙ্ক হয়েছে।`
          });
        } else {
          setActionMessage({
            type: 'error',
            text: `সিঙ্ক ব্যর্থ হয়েছে: ${res.error || 'অজানা ত্রুটি'}`
          });
        }
      }
    } catch (e: any) {
      setActionMessage({
        type: 'error',
        text: `সিঙ্ক ত্রুটি: ${e.message || 'Error occurred during sync'}`
      });
    } finally {
      setIsSyncing(false);
      refreshLogs();
    }
  };

  // Handle Diagnostic Test
  const handleRunDiagnostic = async () => {
    setIsTesting(true);
    setActionMessage(null);
    try {
      if (onRunDiagnostic) {
        await onRunDiagnostic();
      } else {
        const res = await storageService.testDatabaseOperations(username);
        if (res.success) {
          setActionMessage({
            type: 'success',
            text: 'ডাটাবেজ কানেকশন ও রিড/রাইট টেস্ট সফল হয়েছে!'
          });
        } else {
          setActionMessage({
            type: 'error',
            text: `ডায়াগনস্টিক ব্যর্থ [${res.step}]: ${res.details}`
          });
        }
      }
    } catch (e: any) {
      setActionMessage({
        type: 'error',
        text: `ডায়াগনস্টিক ত্রুটি: ${e.message || 'Diagnostic failed'}`
      });
    } finally {
      setIsTesting(false);
      refreshLogs();
    }
  };

  // Handle Clear Logs
  const handleClearLogs = () => {
    if (window.confirm('আপনি কি নিশ্চিত যে সমস্ত সিঙ্ক লগ মুছে ফেলতে চান? (Are you sure you want to clear all sync logs?)')) {
      storageService.clearSyncLogs(username);
      refreshLogs();
      setActionMessage({
        type: 'success',
        text: 'সমস্ত সিঙ্ক লগ মুছে ফেলা হয়েছে।'
      });
    }
  };

  // Export / Copy Logs Report to Clipboard
  const handleCopyLogsReport = () => {
    if (logs.length === 0) return;

    const reportHeader = `=== SWEET LIVE BAKERY - DATABASE SYNC REPORT ===\nAccount: ${username}\nGenerated At: ${new Date().toLocaleString()}\nSupabase Status: ${isSupabaseConfigured ? 'Connected' : 'Offline'}\nTotal Logs: ${logs.length}\n\n`;
    
    const reportBody = logs.map((log, index) => {
      return `[${index + 1}] ${log.timestamp} | ${log.status.toUpperCase()} | ${log.operation}\nMessage: ${log.message}\n${log.details ? `Details: ${log.details}\n` : ''}${log.durationMs ? `Latency: ${log.durationMs}ms\n` : ''}${log.deviceInfo ? `Device: ${log.deviceInfo}\n` : ''}----------------------------------------`;
    }).join('\n');

    navigator.clipboard.writeText(reportHeader + reportBody);
    setCopiedNotification(true);
    setTimeout(() => setCopiedNotification(false), 2500);
  };

  // Filtered Logs
  const filteredLogs = useMemo(() => {
    return logs.filter(log => {
      const matchesStatus = statusFilter === 'all' || log.status === statusFilter;
      const q = searchQuery.toLowerCase().trim();
      const matchesSearch = !q || 
        log.operation.toLowerCase().includes(q) ||
        log.message.toLowerCase().includes(q) ||
        (log.details && log.details.toLowerCase().includes(q)) ||
        (log.deviceInfo && log.deviceInfo.toLowerCase().includes(q));
      
      return matchesStatus && matchesSearch;
    });
  }, [logs, statusFilter, searchQuery]);

  // Metrics
  const totalCount = logs.length;
  const successCount = logs.filter(l => l.status === 'success').length;
  const errorCount = logs.filter(l => l.status === 'error').length;
  const warningCount = logs.filter(l => l.status === 'warning').length;

  // Format Relative Time
  const formatTimeAgo = (isoString: string) => {
    try {
      const date = new Date(isoString);
      const diffMs = Date.now() - date.getTime();
      const diffSecs = Math.floor(diffMs / 1000);
      if (diffSecs < 60) return 'Just now';
      const diffMins = Math.floor(diffSecs / 60);
      if (diffMins < 60) return `${diffMins}m ago`;
      const diffHours = Math.floor(diffMins / 60);
      if (diffHours < 24) return `${diffHours}h ago`;
      return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
    } catch {
      return isoString;
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      
      {/* Top Header Card */}
      <div className="bg-white dark:bg-[#070e1b] p-6 rounded-3xl border border-slate-200 dark:border-[#162744] shadow-sm">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-xl bg-cyan-500/10 border border-cyan-500/20 flex items-center justify-center text-[#00e5ff]">
                <Activity size={20} />
              </div>
              <h2 className="text-xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
                Sync Logs & Diagnostics
                <span className="text-xs font-semibold text-slate-400 font-normal">
                  (সিঙ্ক হিস্ট্রি ও ডাটাবেজ লগ)
                </span>
              </h2>
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Track recent database read/write and synchronization operations to troubleshoot any cross-device discrepancies.
            </p>
          </div>

          {/* Action Buttons */}
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={handleManualSync}
              disabled={isSyncing}
              className="bg-[#00e5ff] hover:bg-[#00c8e0] text-[#050b14] font-bold text-xs px-3.5 py-2 rounded-xl flex items-center gap-2 transition-all cursor-pointer disabled:opacity-60 shadow-sm active:scale-95"
            >
              <RefreshCw size={14} className={isSyncing ? 'animate-spin' : ''} />
              {isSyncing ? 'Syncing...' : 'Sync Now'}
            </button>

            <button
              type="button"
              onClick={handleRunDiagnostic}
              disabled={isTesting}
              className="bg-slate-100 dark:bg-[#0a1527] hover:bg-slate-200 dark:hover:bg-[#162744] text-slate-800 dark:text-slate-200 font-semibold text-xs px-3.5 py-2 rounded-xl border border-slate-200 dark:border-[#162744] flex items-center gap-2 transition-all cursor-pointer disabled:opacity-60"
            >
              <Activity size={14} className={isTesting ? 'animate-pulse text-[#00e5ff]' : ''} />
              {isTesting ? 'Testing...' : 'Test Connection'}
            </button>

            <button
              type="button"
              onClick={handleCopyLogsReport}
              disabled={logs.length === 0}
              className="bg-slate-100 dark:bg-[#0a1527] hover:bg-slate-200 dark:hover:bg-[#162744] text-slate-700 dark:text-slate-300 font-semibold text-xs px-3 py-2 rounded-xl border border-slate-200 dark:border-[#162744] flex items-center gap-1.5 transition-all cursor-pointer disabled:opacity-40"
              title="Copy diagnostic report to clipboard"
            >
              {copiedNotification ? (
                <>
                  <Check size={14} className="text-emerald-500" />
                  <span className="text-emerald-500 text-xs">Copied!</span>
                </>
              ) : (
                <>
                  <Copy size={14} />
                  <span className="text-xs">Copy Logs</span>
                </>
              )}
            </button>

            <button
              type="button"
              onClick={handleClearLogs}
              disabled={logs.length === 0}
              className="text-slate-400 hover:text-rose-500 p-2 rounded-xl hover:bg-rose-500/10 transition-all cursor-pointer disabled:opacity-30"
              title="Clear all logs"
            >
              <Trash2 size={16} />
            </button>
          </div>
        </div>

        {/* Action feedback message */}
        {actionMessage && (
          <div className={`mt-4 p-3 rounded-xl text-xs font-semibold flex items-center gap-2 border ${
            actionMessage.type === 'success' 
              ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' 
              : 'bg-rose-500/10 text-rose-400 border-rose-500/20'
          }`}>
            {actionMessage.type === 'success' ? <CheckCircle2 size={15} /> : <AlertTriangle size={15} />}
            {actionMessage.text}
          </div>
        )}
      </div>

      {/* Metrics Bento Row */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3.5">
        <div className="bg-white dark:bg-[#070e1b] p-4 rounded-2xl border border-slate-200 dark:border-[#162744] shadow-sm">
          <div className="flex items-center justify-between text-slate-400 text-xs mb-1">
            <span>Total Logged</span>
            <Database size={15} className="text-[#00e5ff]" />
          </div>
          <div className="text-2xl font-black text-slate-900 dark:text-white">
            {totalCount}
          </div>
          <div className="text-[10px] text-slate-400 mt-0.5">Recent sync events</div>
        </div>

        <div className="bg-white dark:bg-[#070e1b] p-4 rounded-2xl border border-slate-200 dark:border-[#162744] shadow-sm">
          <div className="flex items-center justify-between text-slate-400 text-xs mb-1">
            <span>Successful</span>
            <CheckCircle2 size={15} className="text-emerald-500" />
          </div>
          <div className="text-2xl font-black text-emerald-500">
            {successCount}
          </div>
          <div className="text-[10px] text-emerald-500/80 mt-0.5">Verified operations</div>
        </div>

        <div className={`bg-white dark:bg-[#070e1b] p-4 rounded-2xl border shadow-sm transition-colors ${
          errorCount > 0 ? 'border-rose-500/30 bg-rose-500/5' : 'border-slate-200 dark:border-[#162744]'
        }`}>
          <div className="flex items-center justify-between text-slate-400 text-xs mb-1">
            <span>Failed / Errors</span>
            <XCircle size={15} className={errorCount > 0 ? 'text-rose-500' : 'text-slate-400'} />
          </div>
          <div className={`text-2xl font-black ${errorCount > 0 ? 'text-rose-500' : 'text-slate-900 dark:text-white'}`}>
            {errorCount}
          </div>
          <div className={`text-[10px] mt-0.5 ${errorCount > 0 ? 'text-rose-400 font-semibold' : 'text-slate-400'}`}>
            {errorCount > 0 ? 'Needs attention' : 'No errors logged'}
          </div>
        </div>

        <div className="bg-white dark:bg-[#070e1b] p-4 rounded-2xl border border-slate-200 dark:border-[#162744] shadow-sm">
          <div className="flex items-center justify-between text-slate-400 text-xs mb-1">
            <span>Cloud Status</span>
            <Cloud size={15} className={isSupabaseConfigured ? 'text-emerald-400' : 'text-amber-400'} />
          </div>
          <div className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-1.5 pt-1">
            <span className={`w-2 h-2 rounded-full ${isSupabaseConfigured ? 'bg-emerald-500 animate-pulse' : 'bg-amber-500'}`} />
            {isSupabaseConfigured ? 'Connected' : 'Offline'}
          </div>
          <div className="text-[10px] text-slate-400 mt-1 truncate">
            {isSupabaseConfigured ? 'Supabase pqeqlayp...' : 'Local storage only'}
          </div>
        </div>
      </div>

      {/* Troubleshooting Advice Banner (Shown when errors are present) */}
      {errorCount > 0 && (
        <div className="bg-rose-50 dark:bg-rose-950/20 border border-rose-200 dark:border-rose-900/40 p-4 rounded-2xl space-y-2.5">
          <div className="flex items-center gap-2 text-rose-700 dark:text-rose-400 font-bold text-xs">
            <AlertTriangle size={16} />
            <span>ডিভাইস সিঙ্ক অমিল বা ত্রুটি সমাধানের উপায় (Troubleshooting Cross-Device Issues):</span>
          </div>
          <ul className="text-xs text-rose-900 dark:text-rose-300 space-y-1.5 pl-5 list-disc">
            <li>
              <strong>টেবিল সংক্রান্ত সমস্যা (PGRST205 / relation does not exist):</strong> Supabase ড্যাশবোর্ডে গিয়ে SQL Editor-এ <code className="bg-rose-100 dark:bg-rose-900/50 px-1 py-0.5 rounded font-mono text-[11px]">setup_schema.sql</code> কোডটি রান করে টেবিল তৈরি করুন।
            </li>
            <li>
              <strong>অথেনটিকেশন বা সেশন এরর (JWT / RLS error):</strong> একাউন্ট থেকে একবার লগআউট করে মূল ইমেইল ও পাসওয়ার্ড দিয়ে পুনরায় লগইন করুন, যেন রো-লেভেল সিকিউরিটি (RLS) অনুমতি পায়।
            </li>
            <li>
              <strong>অফলাইন বা নেটওয়ার্ক ড্রপ:</strong> ইন্টারনেট সচল থাকলে ওপরের <strong>'Sync Now'</strong> বাটনে চাপ দিয়ে লোকাল ডাটা ক্লাউডে পুশ করুন।
            </li>
          </ul>
        </div>
      )}

      {/* Filter and Search Bar */}
      <div className="bg-white dark:bg-[#070e1b] p-4 rounded-2xl border border-slate-200 dark:border-[#162744] flex flex-col sm:flex-row items-center justify-between gap-3 shadow-sm">
        
        {/* Status Filters */}
        <div className="flex items-center gap-1.5 w-full sm:w-auto overflow-x-auto pb-1 sm:pb-0">
          <button
            type="button"
            onClick={() => setStatusFilter('all')}
            className={`text-xs font-bold px-3 py-1.5 rounded-xl transition-all cursor-pointer whitespace-nowrap ${
              statusFilter === 'all'
                ? 'bg-[#00e5ff] text-[#050b14]'
                : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-[#0a1527]'
            }`}
          >
            All Logs ({totalCount})
          </button>
          <button
            type="button"
            onClick={() => setStatusFilter('success')}
            className={`text-xs font-bold px-3 py-1.5 rounded-xl transition-all cursor-pointer whitespace-nowrap ${
              statusFilter === 'success'
                ? 'bg-emerald-500 text-white'
                : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-[#0a1527]'
            }`}
          >
            Success ({successCount})
          </button>
          <button
            type="button"
            onClick={() => setStatusFilter('error')}
            className={`text-xs font-bold px-3 py-1.5 rounded-xl transition-all cursor-pointer whitespace-nowrap ${
              statusFilter === 'error'
                ? 'bg-rose-500 text-white'
                : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-[#0a1527]'
            }`}
          >
            Failed ({errorCount})
          </button>
          {warningCount > 0 && (
            <button
              type="button"
              onClick={() => setStatusFilter('warning')}
              className={`text-xs font-bold px-3 py-1.5 rounded-xl transition-all cursor-pointer whitespace-nowrap ${
                statusFilter === 'warning'
                  ? 'bg-amber-500 text-white'
                  : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-[#0a1527]'
              }`}
            >
              Warnings ({warningCount})
            </button>
          )}
        </div>

        {/* Search Input */}
        <div className="relative w-full sm:w-72">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            placeholder="Search by operation or message..."
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            className="w-full bg-slate-50 dark:bg-[#0a1527] border border-slate-200 dark:border-[#162744] rounded-xl pl-9 pr-3.5 py-1.5 text-xs text-slate-900 dark:text-white outline-none focus:border-[#00e5ff] transition-all"
          />
        </div>
      </div>

      {/* Logs List Container */}
      <div className="space-y-2.5">
        {filteredLogs.length === 0 ? (
          <div className="bg-white dark:bg-[#070e1b] p-12 rounded-3xl border border-slate-200 dark:border-[#162744] text-center space-y-3">
            <div className="w-14 h-14 mx-auto rounded-2xl bg-slate-100 dark:bg-[#0a1527] flex items-center justify-center text-slate-400">
              <Database size={28} />
            </div>
            <div className="space-y-1">
              <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                {searchQuery || statusFilter !== 'all' ? 'কোনো ফলাফল পাওয়া যায়নি' : 'এখনো কোনো সিঙ্ক লগ রেকর্ড হয়নি'}
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 max-w-sm mx-auto">
                {searchQuery || statusFilter !== 'all' 
                  ? 'ফিল্টার বা সার্চ পরিবর্তন করে পুনরায় চেষ্টা করুন।'
                  : 'ক্লাউড সিঙ্ক চালানো বা প্রোডাক্ট/সেলস আপডেট করলে এখানে স্বয়ংক্রিয়ভাবে বিস্তারিত লগ জমা হবে।'}
              </p>
            </div>
            {totalCount === 0 && (
              <button
                type="button"
                onClick={handleManualSync}
                className="inline-flex items-center gap-2 bg-[#00e5ff] hover:bg-[#00c8e0] text-[#050b14] font-bold text-xs px-4 py-2 rounded-xl transition-all cursor-pointer shadow-sm mt-2"
              >
                <RefreshCw size={14} />
                Run First Cloud Sync
              </button>
            )}
          </div>
        ) : (
          filteredLogs.map(log => {
            const isExpanded = expandedLogId === log.id;
            const isError = log.status === 'error';
            const isWarning = log.status === 'warning';
            const isSuccess = log.status === 'success';

            return (
              <div
                key={log.id}
                className={`bg-white dark:bg-[#070e1b] rounded-2xl border transition-all duration-200 overflow-hidden ${
                  isError 
                    ? 'border-rose-500/30 dark:border-rose-900/40 hover:border-rose-500/60' 
                    : isWarning 
                    ? 'border-amber-500/30 dark:border-amber-900/40 hover:border-amber-500/60' 
                    : 'border-slate-200 dark:border-[#162744] hover:border-slate-300 dark:hover:border-[#20365c]'
                }`}
              >
                {/* Main Card Header / Row */}
                <div 
                  onClick={() => setExpandedLogId(isExpanded ? null : log.id)}
                  className="p-3.5 sm:p-4 flex items-center justify-between gap-3 cursor-pointer select-none"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    {/* Status Icon */}
                    <div className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 ${
                      isError 
                        ? 'bg-rose-500/10 text-rose-500' 
                        : isWarning 
                        ? 'bg-amber-500/10 text-amber-500' 
                        : 'bg-emerald-500/10 text-emerald-500'
                    }`}>
                      {isError ? <XCircle size={16} /> : isWarning ? <AlertTriangle size={16} /> : <CheckCircle2 size={16} />}
                    </div>

                    <div className="min-w-0 space-y-0.5">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-bold text-xs sm:text-sm text-slate-900 dark:text-white truncate">
                          {log.operation}
                        </span>

                        <span className={`text-[10px] font-extrabold uppercase px-2 py-0.5 rounded-md ${
                          isError
                            ? 'bg-rose-500/10 text-rose-500 border border-rose-500/20'
                            : isWarning
                            ? 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
                            : 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                        }`}>
                          {log.status}
                        </span>

                        {log.durationMs !== undefined && (
                          <span className="text-[10px] text-slate-400 bg-slate-100 dark:bg-[#0a1527] px-2 py-0.5 rounded-md border border-slate-200 dark:border-[#162744]">
                            {log.durationMs}ms
                          </span>
                        )}

                        {log.itemCount !== undefined && log.itemCount > 0 && (
                          <span className="text-[10px] font-semibold text-cyan-600 dark:text-[#00e5ff] bg-cyan-50 dark:bg-[#00e5ff]/10 px-2 py-0.5 rounded-md border border-cyan-200 dark:border-[#00e5ff]/20">
                            {log.itemCount} items
                          </span>
                        )}
                      </div>

                      <p className="text-xs text-slate-600 dark:text-slate-300 truncate">
                        {log.message}
                      </p>
                    </div>
                  </div>

                  {/* Timestamp & Toggle */}
                  <div className="flex items-center gap-3 shrink-0">
                    <div className="text-right hidden sm:block">
                      <div className="text-[11px] font-semibold text-slate-500 dark:text-slate-400 flex items-center gap-1">
                        <Clock size={12} />
                        {formatTimeAgo(log.timestamp)}
                      </div>
                      <div className="text-[9px] text-slate-400">
                        {new Date(log.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                      </div>
                    </div>

                    <div className="text-slate-400 hover:text-slate-200 p-1">
                      {isExpanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                    </div>
                  </div>
                </div>

                {/* Expanded Details Panel */}
                {isExpanded && (
                  <div className="px-4 pb-4 pt-1 border-t border-slate-100 dark:border-[#162744] bg-slate-50/50 dark:bg-[#050b14]/50 space-y-3 animate-in slide-in-from-top-1 text-xs">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
                      <div className="space-y-1">
                        <span className="text-slate-400 font-semibold text-[10px] uppercase tracking-wider">
                          Exact Timestamp
                        </span>
                        <div className="text-slate-700 dark:text-slate-200 font-mono text-xs">
                          {new Date(log.timestamp).toLocaleString()}
                        </div>
                      </div>

                      <div className="space-y-1">
                        <span className="text-slate-400 font-semibold text-[10px] uppercase tracking-wider">
                          Recorded Client / Device
                        </span>
                        <div className="text-slate-700 dark:text-slate-200 flex items-center gap-1.5 text-xs">
                          {log.deviceInfo?.includes('Mobile') ? <Smartphone size={13} className="text-cyan-400" /> : <Laptop size={13} className="text-cyan-400" />}
                          {log.deviceInfo || 'Standard Web Browser'}
                        </div>
                      </div>
                    </div>

                    {log.details && (
                      <div className="space-y-1">
                        <span className="text-slate-400 font-semibold text-[10px] uppercase tracking-wider">
                          Technical Details & Diagnostics
                        </span>
                        <div className="p-3 bg-white dark:bg-[#070e1b] rounded-xl border border-slate-200 dark:border-[#162744] font-mono text-[11px] text-slate-700 dark:text-slate-300 whitespace-pre-wrap leading-relaxed">
                          {log.details}
                        </div>
                      </div>
                    )}

                    {isError && (
                      <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-300 text-xs space-y-1">
                        <div className="font-bold flex items-center gap-1.5 text-rose-400">
                          <Info size={14} /> Recommended Action:
                        </div>
                        <p className="text-[11px] leading-relaxed">
                          If this error prevents other devices from seeing updated sales or products, make sure Supabase tables exist and both devices are signed in with the same email account.
                        </p>
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>

    </div>
  );
};
