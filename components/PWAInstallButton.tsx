import React, { useState } from 'react';
import { Download, Smartphone, X, Check, Share, PlusSquare } from 'lucide-react';
import { usePWAInstall } from '../hooks/usePWA';

export const PWAInstallButton: React.FC<{ variant?: 'header' | 'sidebar' | 'pill' }> = ({ variant = 'header' }) => {
  const { isInstallable, isInstalled, isIOS, install } = usePWAInstall();
  const [showIOSModal, setShowIOSModal] = useState(false);
  const [isInstalling, setIsInstalling] = useState(false);

  // If already running in standalone PWA mode, don't display prompt
  if (isInstalled) {
    return null;
  }

  const handleInstallClick = async () => {
    if (isInstallable) {
      setIsInstalling(true);
      await install();
      setIsInstalling(false);
    } else if (isIOS) {
      setShowIOSModal(true);
    }
  };

  if (!isInstallable && !isIOS) {
    return null;
  }

  return (
    <>
      {variant === 'header' && (
        <button
          id="btn_install_app_header"
          onClick={handleInstallClick}
          disabled={isInstalling}
          title="Install Bakery Management App to your device"
          className="flex items-center gap-1.5 px-3 py-2 sm:px-3.5 sm:py-2.5 bg-cyan-50 dark:bg-[#0a1829] border border-cyan-500/30 dark:border-[#00d2ff]/40 text-cyan-700 dark:text-[#00e5ff] rounded-xl sm:rounded-2xl text-xs font-black uppercase tracking-wider hover:bg-cyan-100 dark:hover:bg-[#10243e] transition-all shadow-sm active:scale-95 cursor-pointer"
        >
          <Download size={15} className="animate-bounce" />
          <span className="hidden md:inline">Install App</span>
        </button>
      )}

      {variant === 'sidebar' && (
        <button
          id="btn_install_app_sidebar"
          onClick={handleInstallClick}
          disabled={isInstalling}
          className="w-full flex items-center justify-center gap-2.5 px-4 py-3 bg-gradient-to-r from-[#0092d6]/15 to-[#00d2ff]/20 hover:from-[#0092d6]/25 hover:to-[#00d2ff]/30 border border-[#00d2ff]/40 text-[#00e5ff] rounded-2xl text-xs font-black uppercase tracking-wider transition-all shadow-[0_0_15px_rgba(0,210,255,0.15)] active:scale-98 cursor-pointer"
        >
          <Download size={16} />
          <span>Install Offline App</span>
        </button>
      )}

      {variant === 'pill' && (
        <button
          id="btn_install_app_pill"
          onClick={handleInstallClick}
          disabled={isInstalling}
          className="smart-cyan-pill px-4 py-2 text-xs font-black uppercase tracking-wider flex items-center gap-2 cursor-pointer"
        >
          <Download size={14} />
          <span>Install App</span>
        </button>
      )}

      {/* iOS Installation Instruction Modal */}
      {showIOSModal && (
        <div 
          id="ios_install_guide_modal"
          className="fixed inset-0 z-[350] flex items-center justify-center p-4 bg-black/70 backdrop-blur-md animate-in fade-in duration-200"
        >
          <div className="bg-white dark:bg-[#0a1424] rounded-3xl p-6 sm:p-8 max-w-sm w-full border border-slate-200 dark:border-[#162744] shadow-2xl relative animate-in zoom-in duration-200">
            <button
              onClick={() => setShowIOSModal(false)}
              className="absolute top-4 right-4 p-2 text-slate-400 hover:text-slate-900 dark:hover:text-white rounded-xl cursor-pointer"
            >
              <X size={18} />
            </button>

            <div className="w-14 h-14 bg-cyan-50 dark:bg-[#071324] border border-cyan-500/30 dark:border-[#00d2ff]/40 rounded-2xl flex items-center justify-center text-cyan-600 dark:text-[#00e5ff] mx-auto mb-4 shadow-md">
              <Smartphone size={28} />
            </div>

            <h3 className="text-lg font-black text-slate-900 dark:text-white text-center uppercase tracking-tight mb-2">
              Install on iOS Safari
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 text-center mb-6">
              Install the Bakery POS app to your iPhone / iPad home screen for instant offline access:
            </p>

            <div className="space-y-4 mb-6 text-xs text-slate-700 dark:text-slate-300">
              <div className="flex items-start gap-3 p-3 bg-slate-50 dark:bg-[#070e1c] rounded-xl border border-slate-100 dark:border-[#162744]">
                <div className="w-6 h-6 rounded-lg bg-cyan-500/20 text-cyan-600 dark:text-[#00e5ff] flex items-center justify-center font-black shrink-0">1</div>
                <p>Tap the <strong className="text-slate-900 dark:text-white flex inline-flex items-center gap-1 mx-1"><Share size={12} /> Share</strong> button in your Safari toolbar.</p>
              </div>

              <div className="flex items-start gap-3 p-3 bg-slate-50 dark:bg-[#070e1c] rounded-xl border border-slate-100 dark:border-[#162744]">
                <div className="w-6 h-6 rounded-lg bg-cyan-500/20 text-cyan-600 dark:text-[#00e5ff] flex items-center justify-center font-black shrink-0">2</div>
                <p>Scroll down and tap <strong className="text-slate-900 dark:text-white flex inline-flex items-center gap-1 mx-1"><PlusSquare size={12} /> Add to Home Screen</strong>.</p>
              </div>

              <div className="flex items-start gap-3 p-3 bg-slate-50 dark:bg-[#070e1c] rounded-xl border border-slate-100 dark:border-[#162744]">
                <div className="w-6 h-6 rounded-lg bg-cyan-500/20 text-cyan-600 dark:text-[#00e5ff] flex items-center justify-center font-black shrink-0">3</div>
                <p>Tap <strong className="text-slate-900 dark:text-white">Add</strong> in the top right corner. The app will launch in standalone offline mode!</p>
              </div>
            </div>

            <button
              onClick={() => setShowIOSModal(false)}
              className="w-full smart-cyan-pill py-3 text-xs uppercase tracking-wider cursor-pointer"
            >
              Got it
            </button>
          </div>
        </div>
      )}
    </>
  );
};
