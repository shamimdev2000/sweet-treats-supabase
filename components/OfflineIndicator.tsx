import React from 'react';
import { Wifi, WifiOff, RefreshCw, CheckCircle2, ShieldAlert } from 'lucide-react';
import { useOnlineStatus } from '../hooks/usePWA';

export const OfflineIndicator: React.FC = () => {
  const { isOnline, showReconnectNotice } = useOnlineStatus();

  return (
    <>
      {/* Offline Alert Banner */}
      {!isOnline && (
        <div 
          id="offline_banner"
          className="fixed bottom-16 sm:bottom-6 left-1/2 -translate-x-1/2 z-50 w-[92%] sm:w-auto max-w-lg bg-[#0c192e]/95 dark:bg-[#060e1d]/95 backdrop-blur-xl border border-amber-500/50 text-white px-4 py-3 rounded-2xl shadow-[0_10px_35px_rgba(245,158,11,0.3)] animate-in slide-in-from-bottom-5 duration-300 flex items-center justify-between gap-3"
        >
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-9 h-9 rounded-xl bg-amber-500/20 border border-amber-500/40 flex items-center justify-center text-amber-400 shrink-0">
              <WifiOff size={18} className="animate-pulse" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-amber-400 animate-ping"></span>
                <p className="text-xs font-black uppercase tracking-wider text-amber-400">
                  Offline Mode Active
                </p>
              </div>
              <p className="text-[11px] text-slate-300 font-medium truncate sm:whitespace-normal">
                Workbox cache & local database are active. Sales and notes will continue saving locally.
              </p>
            </div>
          </div>
          <span className="hidden sm:inline-block px-2.5 py-1 bg-amber-500/20 text-amber-300 border border-amber-500/30 rounded-lg text-[10px] font-black uppercase tracking-wider shrink-0">
            Cached
          </span>
        </div>
      )}

      {/* Back Online Toast */}
      {showReconnectNotice && (
        <div 
          id="online_reconnect_toast"
          className="fixed bottom-16 sm:bottom-6 left-1/2 -translate-x-1/2 z-50 w-[92%] sm:w-auto max-w-md bg-[#0a1b2a]/95 dark:bg-[#061826]/95 backdrop-blur-xl border border-emerald-500/50 text-white px-4 py-3 rounded-2xl shadow-[0_10px_35px_rgba(16,185,129,0.3)] animate-in slide-in-from-bottom-5 duration-300 flex items-center gap-3"
        >
          <div className="w-9 h-9 rounded-xl bg-emerald-500/20 border border-emerald-500/40 flex items-center justify-center text-emerald-400 shrink-0">
            <CheckCircle2 size={18} />
          </div>
          <div>
            <p className="text-xs font-black uppercase tracking-wider text-emerald-400">
              Internet Restored
            </p>
            <p className="text-[11px] text-slate-300 font-medium">
              You are back online. Background sync and cloud services are active.
            </p>
          </div>
        </div>
      )}
    </>
  );
};

export const NetworkStatusBadge: React.FC<{ compact?: boolean }> = ({ compact = false }) => {
  const { isOnline } = useOnlineStatus();

  if (compact) {
    return (
      <div 
        id="network_status_badge_compact"
        title={isOnline ? 'Online — Cloud Connected' : 'Offline — Operating from Workbox Cache'} 
        className={`flex items-center gap-1.5 px-2.5 py-1 rounded-xl text-[10px] font-bold border transition-colors ${
          isOnline 
            ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-600 dark:text-emerald-400' 
            : 'bg-amber-500/15 border-amber-500/40 text-amber-600 dark:text-amber-400 animate-pulse'
        }`}
      >
        <span className={`w-1.5 h-1.5 rounded-full ${isOnline ? 'bg-emerald-500' : 'bg-amber-500'}`} />
        <span>{isOnline ? 'Online' : 'Offline'}</span>
      </div>
    );
  }

  return (
    <div 
      id="network_status_badge"
      title={isOnline ? 'Connected to Internet & Cloud Database' : 'Offline Mode — Local Cache Active'}
      className={`flex items-center gap-2 px-3 py-1.5 rounded-2xl text-xs font-black uppercase tracking-wider border transition-all ${
        isOnline 
          ? 'bg-emerald-50/80 dark:bg-emerald-950/30 border-emerald-500/30 text-emerald-600 dark:text-emerald-400' 
          : 'bg-amber-50/80 dark:bg-amber-950/30 border-amber-500/40 text-amber-600 dark:text-amber-400 shadow-sm'
      }`}
    >
      {isOnline ? (
        <>
          <Wifi size={14} className="text-emerald-500" />
          <span className="hidden md:inline">Online</span>
        </>
      ) : (
        <>
          <WifiOff size={14} className="text-amber-500 animate-pulse" />
          <span>Offline</span>
        </>
      )}
    </div>
  );
};
