import React, { useState, useEffect } from 'react';
import { 
  UtensilsCrossed, 
  Lock, 
  Mail, 
  Store, 
  User, 
  LogIn, 
  UserPlus, 
  AlertCircle, 
  Check, 
  Loader2,
  KeyRound,
  ArrowLeft,
  Send,
  ShieldCheck,
  Eye,
  EyeOff
} from 'lucide-react';
import { storageService } from '../services/storageService';
import { supabase, isSupabaseConfigured } from '../services/supabaseClient';

interface Props {
  onLogin: (email: string) => void;
  theme: 'dark' | 'light';
}

const Login: React.FC<Props> = ({ onLogin }) => {
  const [isRegister, setIsRegister] = useState(false);
  const [isForgot, setIsForgot] = useState(false);
  const [forgotMethod, setForgotMethod] = useState<'pin' | 'email'>('pin');
  
  // Sign In State
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  
  // Sign Up State
  const [businessName, setBusinessName] = useState('');
  const [ownerName, setOwnerName] = useState('');
  
  // Forgot Password State
  const [managerPin, setManagerPin] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showNewPassword, setShowNewPassword] = useState(false);
  
  // Status
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [loading, setLoading] = useState(false);

  // Listen for Supabase password recovery link redirect
  useEffect(() => {
    if (isSupabaseConfigured && supabase) {
      const { data: authListener } = supabase.auth.onAuthStateChange(async (event) => {
        if (event === 'PASSWORD_RECOVERY') {
          setIsForgot(true);
          setForgotMethod('pin');
          setError('');
          setSuccess('পাসওয়ার্ড রিকভারি সক্রিয় হয়েছে। আপনার নতুন পাসওয়ার্ড লিখুন।');
        }
      });

      return () => {
        authListener.subscription.unsubscribe();
      };
    }
  }, []);

  const clearMessages = () => {
    setError('');
    setSuccess('');
  };

  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    clearMessages();
    setLoading(true);

    const cleanEmail = email.trim().toLowerCase();

    try {
      if (isSupabaseConfigured && supabase) {
        // Authenticate via Supabase Auth
        const { data: authData, error: authErr } = await supabase.auth.signInWithPassword({
          email: cleanEmail,
          password: password
        });

        if (authErr) {
          setError(authErr.message || 'ভুল ইমেইল বা পাসওয়ার্ড। আবার চেষ্টা করুন।');
          setLoading(false);
          return;
        }

        if (authData.user) {
          try {
            await storageService.fetchRemoteProfile(authData.user.id);
          } catch (e) {
            console.warn("fetchRemoteProfile skipped:", e);
          }
          try {
            await storageService.updateProfile(cleanEmail, { lastLogin: new Date().toISOString() });
          } catch (e) {
            console.warn("updateProfile lastLogin skipped:", e);
          }
          onLogin(cleanEmail);
          return;
        }
      }

      // Fallback local auth
      const profiles = storageService.getProfiles();
      const user = profiles.find(p => p.email.toLowerCase() === cleanEmail);

      if (!user) {
        setError('এই ইমেইলে কোনো একাউন্ট পাওয়া যায়নি। নতুন একাউন্ট রেজিস্টার করুন।');
        setLoading(false);
        return;
      }

      if (user.password && user.password !== password) {
        setError('ভুল পাসওয়ার্ড! আবার চেষ্টা করুন অথবা নিচে "পাসওয়ার্ড ভুলে গেছেন?" চাপুন।');
        setLoading(false);
        return;
      }

      try {
        await storageService.updateProfile(cleanEmail, { lastLogin: new Date().toISOString() });
      } catch (e) {
        console.warn("updateProfile lastLogin skipped:", e);
      }
      onLogin(cleanEmail);
    } catch (err: any) {
      setError(err.message || 'Login failed.');
    } finally {
      setLoading(false);
    }
  };

  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault();
    clearMessages();
    setLoading(true);

    const cleanEmail = email.trim().toLowerCase();
    const cleanBusiness = businessName.trim();
    const cleanOwner = ownerName.trim();

    if (!cleanBusiness) {
      setError('দোকান বা বেকারির নাম লিখুন');
      setLoading(false);
      return;
    }

    if (password.length < 8) {
      setError('পাসওয়ার্ড কমপক্ষে ৮ ডিজিট (8 characters) হতে হবে');
      setLoading(false);
      return;
    }

    if (!isSupabaseConfigured || !supabase) {
      setError('Supabase ডাটাবেজ সংযোগ পাওয়া যায়নি। অনুগ্রহ করে পরিবেশ ভেরিয়েবল পরীক্ষা করুন।');
      setLoading(false);
      return;
    }

    try {
      const { data: signUpData, error: signUpErr } = await supabase.auth.signUp({
        email: cleanEmail,
        password: password,
        options: {
          data: {
            business_name: cleanBusiness,
            owner_name: cleanOwner || cleanBusiness,
            manager_pin: '654321'
          }
        }
      });

      if (signUpErr) {
        if (signUpErr.status === 429 || signUpErr.message?.toLowerCase().includes('rate limit')) {
          setError('ইমেইল পাঠানোর লিমিট অতিক্রম করেছে। অনুগ্রহ করে কিছুক্ষণ অপেক্ষা করুন।');
        } else {
          setError(signUpErr.message || 'রেজিস্ট্রেশন ব্যর্থ হয়েছে।');
        }
        setLoading(false);
        return;
      }

      if (!signUpData.user?.id) {
        setError('রেজিস্ট্রেশন সম্পন্ন করা যায়নি। অনুগ্রহ করে আবার চেষ্টা করুন।');
        setLoading(false);
        return;
      }

      if (Array.isArray(signUpData.user.identities) && signUpData.user.identities.length === 0) {
        setError('এই ইমেইল দিয়ে আগেই অ্যাকাউন্ট খোলা হয়েছে। অনুগ্রহ করে লগইন করুন।');
        setLoading(false);
        return;
      }

      setBusinessName('');
      setOwnerName('');
      setPassword('');
      setIsRegister(false);
      setSuccess('রেজিস্ট্রেশন সফল হয়েছে! এখন পাসওয়ার্ড দিয়ে লগইন করুন।');
      setLoading(false);
    } catch (err: any) {
      setError(err.message || 'রেজিস্ট্রেশন ব্যর্থ হয়েছে।');
      setLoading(false);
    }
  };

  // Reset Password via PIN (Database connected)
  const handleResetPasswordWithPin = async (e: React.FormEvent) => {
    e.preventDefault();
    clearMessages();
    setLoading(true);

    const cleanEmail = email.trim().toLowerCase();
    const cleanPin = managerPin.trim();

    if (!cleanEmail) {
      setError('আপনার নিবন্ধিত ইমেইল ঠিকানা লিখুন।');
      setLoading(false);
      return;
    }

    if (!cleanPin) {
      setError('ম্যানেজার পিন লিখুন (ডিফল্ট: 654321)।');
      setLoading(false);
      return;
    }

    if (newPassword.length < 8) {
      setError('নতুন পাসওয়ার্ড কমপক্ষে ৮ ডিজিট হতে হবে।');
      setLoading(false);
      return;
    }

    if (newPassword !== confirmPassword) {
      setError('দুই ঘরের পাসওয়ার্ড মিলছে না! আবার চেক করুন।');
      setLoading(false);
      return;
    }

    try {
      const res = await storageService.resetPasswordWithPin(cleanEmail, cleanPin, newPassword);

      if (!res.success) {
        setError(res.message);
        setLoading(false);
        return;
      }

      // Update in Supabase Auth if currently signed in or session exists
      if (isSupabaseConfigured && supabase) {
        try {
          await supabase.auth.updateUser({ password: newPassword });
        } catch (authErr) {
          console.warn("Supabase Auth password update:", authErr);
        }
      }

      setSuccess('পাসওয়ার্ড সফলভাবে পরিবর্তন হয়েছে! এখন লগইন করুন।');
      setPassword(newPassword);
      setNewPassword('');
      setConfirmPassword('');
      setManagerPin('');
      setIsForgot(false);
    } catch (err: any) {
      setError(err.message || 'পাসওয়ার্ড রিসেট ব্যর্থ হয়েছে।');
    } finally {
      setLoading(false);
    }
  };

  // Reset Password via Email Link (Supabase Auth)
  const handleSendResetEmail = async (e: React.FormEvent) => {
    e.preventDefault();
    clearMessages();
    setLoading(true);

    const cleanEmail = email.trim().toLowerCase();
    if (!cleanEmail) {
      setError('আপনার নিবন্ধিত ইমেইল লিখুন।');
      setLoading(false);
      return;
    }

    try {
      if (isSupabaseConfigured && supabase) {
        const { error: resetErr } = await supabase.auth.resetPasswordForEmail(cleanEmail, {
          redirectTo: `${window.location.origin}`
        });

        if (resetErr) {
          if (resetErr.status === 429 || resetErr.message?.toLowerCase().includes('rate limit')) {
            setError('ইমেইল পাঠানোর লিমিট অতিক্রম করেছে। অনুগ্রহ করে কিছুক্ষণ অপেক্ষা করুন।');
          } else {
            setError(resetErr.message || 'পাসওয়ার্ড রিসেট ইমেইল পাঠাতে ব্যর্থ হয়েছে।');
          }
          setLoading(false);
          return;
        }

        setSuccess(`পাসওয়ার্ড রিসেট লিংক ${cleanEmail} ঠিকানায় পাঠানো হয়েছে। ইনবক্স চেক করুন!`);
      } else {
        setError('অনলাইন ডাটাবেজ সংযোগ পাওয়া যায়নি। অনুগ্রহ করে "ম্যানেজার পিন" অপশনটি ব্যবহার করুন।');
      }
    } catch (err: any) {
      setError(err.message || 'পাসওয়ার্ড রিসেট লিংক পাঠাতে ব্যর্থ হয়েছে।');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-[#040812] flex flex-col items-center justify-center p-4 sm:p-6 relative overflow-hidden font-sans text-slate-900 dark:text-slate-100 selection:bg-[#00e5ff] selection:text-black">
      {/* Background Ambient Glow */}
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 w-[500px] h-[500px] bg-[#00d2ff]/5 dark:bg-[#00d2ff]/10 rounded-full blur-[120px] pointer-events-none" />

      {/* Main Container */}
      <div className="max-w-[440px] w-full relative z-10">
        
        {/* Brand Logo & Title */}
        <div className="mb-6 text-center flex flex-col items-center">
          <div className="w-16 h-16 bg-white dark:bg-[#071324] rounded-2xl border border-cyan-500/30 dark:border-[#00d2ff]/40 flex items-center justify-center shadow-md dark:shadow-[0_0_25px_rgba(0,210,255,0.25)] mb-3 transition-transform hover:scale-105">
            <UtensilsCrossed size={32} className="text-cyan-600 dark:text-[#00e5ff] drop-shadow-xs dark:drop-shadow-[0_0_10px_rgba(0,229,255,0.8)]" />
          </div>
          <h1 className="text-2xl font-black text-slate-900 dark:text-white tracking-tight">
            Bakery Smart <span className="text-cyan-600 dark:text-[#00e5ff]">Manager</span>
          </h1>
          <p className="text-slate-600 dark:text-slate-400 text-xs font-medium mt-1">
            {isForgot 
              ? 'পাসওয়ার্ড রিকভারি ও পরিবর্তন'
              : isRegister 
                ? 'নতুন বেকারি একাউন্ট তৈরি করুন' 
                : 'আপনার বেকারি একাউন্টে লগইন করুন'}
          </p>
        </div>

        {/* Card */}
        <div className="bg-white/95 dark:bg-[#09111f]/95 rounded-3xl shadow-xl dark:shadow-[0_20px_50px_rgba(0,0,0,0.8)] p-6 sm:p-7 border border-slate-200 dark:border-[#162744] backdrop-blur-xl">
          
          {/* Messages */}
          {error && (
            <div className="mb-4 bg-red-500/10 border border-red-500/30 text-red-600 dark:text-red-400 p-3 rounded-xl text-xs font-semibold flex items-start gap-2">
              <AlertCircle size={15} className="shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          {success && (
            <div className="mb-4 bg-emerald-500/10 border border-emerald-500/30 text-emerald-600 dark:text-emerald-400 p-3 rounded-xl text-xs font-semibold flex items-start gap-2">
              <Check size={15} className="shrink-0 mt-0.5" />
              <span>{success}</span>
            </div>
          )}

          {/* FORGOT PASSWORD VIEW */}
          {isForgot ? (
            <div className="space-y-4">
              <div className="flex items-center justify-between pb-1 border-b border-slate-100 dark:border-[#162744]">
                <button
                  type="button"
                  onClick={() => {
                    setIsForgot(false);
                    clearMessages();
                  }}
                  className="flex items-center gap-1.5 text-xs font-bold text-slate-600 dark:text-slate-400 hover:text-cyan-600 dark:hover:text-[#00e5ff] cursor-pointer transition-colors"
                >
                  <ArrowLeft size={14} />
                  <span>লগইনে ফিরে যান</span>
                </button>
                <span className="text-[11px] font-bold text-cyan-600 dark:text-[#00e5ff]">পাসওয়ার্ড রিসেট</span>
              </div>

              {/* Method Switcher */}
              <div className="grid grid-cols-2 gap-2 p-1 bg-slate-100 dark:bg-[#050b14] border border-slate-200 dark:border-[#162a45] rounded-xl">
                <button
                  type="button"
                  onClick={() => {
                    setForgotMethod('pin');
                    clearMessages();
                  }}
                  className={`py-2 px-2 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
                    forgotMethod === 'pin'
                      ? 'bg-white dark:bg-[#0e1d35] text-cyan-600 dark:text-[#00e5ff] shadow-sm border border-cyan-500/30 dark:border-[#00d2ff]/30'
                      : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                  }`}
                >
                  <ShieldCheck size={13} />
                  <span>ম্যানেজার পিন</span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setForgotMethod('email');
                    clearMessages();
                  }}
                  className={`py-2 px-2 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
                    forgotMethod === 'email'
                      ? 'bg-white dark:bg-[#0e1d35] text-cyan-600 dark:text-[#00e5ff] shadow-sm border border-cyan-500/30 dark:border-[#00d2ff]/30'
                      : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                  }`}
                >
                  <Mail size={13} />
                  <span>ইমেইল লিংক</span>
                </button>
              </div>

              {/* Method 1: Manager PIN Reset */}
              {forgotMethod === 'pin' ? (
                <form onSubmit={handleResetPasswordWithPin} className="space-y-3 pt-1">
                  <div className="space-y-1">
                    <label className="text-xs font-bold text-cyan-700 dark:text-[#00d2ff] flex items-center gap-1.5">
                      <Mail size={13} /> নিবন্ধিত ইমেইল
                    </label>
                    <input 
                      required 
                      type="email" 
                      placeholder="owner@example.com"
                      className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 dark:bg-[#050b14] border border-slate-200 dark:border-[#162a45] focus:border-[#00d2ff] text-slate-900 dark:text-white outline-none text-xs sm:text-sm" 
                      value={email} 
                      onChange={e => setEmail(e.target.value)} 
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-xs font-bold text-cyan-700 dark:text-[#00d2ff] flex items-center gap-1.5">
                      <ShieldCheck size={13} /> ম্যানেজার পিন
                    </label>
                    <input 
                      required 
                      type="password" 
                      maxLength={8}
                      placeholder="৬ ডিজিটের ম্যানেজার পিন"
                      className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 dark:bg-[#050b14] border border-slate-200 dark:border-[#162a45] focus:border-[#00d2ff] text-slate-900 dark:text-white outline-none text-xs sm:text-sm tracking-wider" 
                      value={managerPin} 
                      onChange={e => setManagerPin(e.target.value)} 
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-xs font-bold text-cyan-700 dark:text-[#00d2ff] flex items-center gap-1.5">
                      <Lock size={13} /> নতুন পাসওয়ার্ড
                    </label>
                    <div className="relative">
                      <input 
                        required 
                        type={showNewPassword ? "text" : "password"} 
                        minLength={8}
                        placeholder="কমপক্ষে ৮ ডিজিট"
                        className="w-full pl-3.5 pr-10 py-2.5 rounded-xl bg-slate-50 dark:bg-[#050b14] border border-slate-200 dark:border-[#162a45] focus:border-[#00d2ff] text-slate-900 dark:text-white outline-none text-xs sm:text-sm tracking-wider" 
                        value={newPassword} 
                        onChange={e => setNewPassword(e.target.value)} 
                      />
                      <button
                        type="button"
                        onClick={() => setShowNewPassword(!showNewPassword)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700 dark:hover:text-white cursor-pointer"
                      >
                        {showNewPassword ? <EyeOff size={15} /> : <Eye size={15} />}
                      </button>
                    </div>
                  </div>

                  <div className="space-y-1">
                    <label className="text-xs font-bold text-cyan-700 dark:text-[#00d2ff] flex items-center gap-1.5">
                      <Lock size={13} /> পাসওয়ার্ড নিশ্চিত করুন
                    </label>
                    <input 
                      required 
                      type={showNewPassword ? "text" : "password"} 
                      minLength={8}
                      placeholder="একই পাসওয়ার্ড পুনরায় লিখুন"
                      className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 dark:bg-[#050b14] border border-slate-200 dark:border-[#162a45] focus:border-[#00d2ff] text-slate-900 dark:text-white outline-none text-xs sm:text-sm tracking-wider" 
                      value={confirmPassword} 
                      onChange={e => setConfirmPassword(e.target.value)} 
                    />
                  </div>

                  <button 
                    type="submit" 
                    disabled={loading} 
                    className="w-full mt-2 smart-cyan-pill py-3 px-4 flex items-center justify-center gap-2 text-xs sm:text-sm font-black uppercase tracking-wider cursor-pointer transition-all disabled:opacity-50 text-white"
                  >
                    {loading ? <Loader2 className="animate-spin" size={16} /> : <span>পাসওয়ার্ড পরিবর্তন করুন</span>}
                  </button>
                </form>
              ) : (
                /* Method 2: Supabase Email Link */
                <form onSubmit={handleSendResetEmail} className="space-y-3.5 pt-1">
                  <div className="space-y-1">
                    <label className="text-xs font-bold text-cyan-700 dark:text-[#00d2ff] flex items-center gap-1.5">
                      <Mail size={13} /> আপনার নিবন্ধিত ইমেইল
                    </label>
                    <input 
                      required 
                      type="email" 
                      placeholder="owner@example.com"
                      className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 dark:bg-[#050b14] border border-slate-200 dark:border-[#162a45] focus:border-[#00d2ff] text-slate-900 dark:text-white outline-none text-xs sm:text-sm" 
                      value={email} 
                      onChange={e => setEmail(e.target.value)} 
                    />
                  </div>

                  <p className="text-[11px] text-slate-500 dark:text-slate-400 bg-slate-50 dark:bg-[#050b14] p-3 rounded-xl border border-slate-200 dark:border-[#162a45] leading-relaxed">
                    আপনার ইমেইলে একটি সুরক্ষিত পাসওয়ার্ড রিসেট লিংক যাবে। লিংকে ক্লিক করে আপনি নতুন পাসওয়ার্ড সেট করতে পারবেন।
                  </p>

                  <button 
                    type="submit" 
                    disabled={loading} 
                    className="w-full smart-cyan-pill py-3 px-4 flex items-center justify-center gap-2 text-xs sm:text-sm font-black uppercase tracking-wider cursor-pointer transition-all disabled:opacity-50 text-white"
                  >
                    {loading ? <Loader2 className="animate-spin" size={16} /> : (
                      <>
                        <Send size={15} />
                        <span>রিসেট লিংক পাঠান</span>
                      </>
                    )}
                  </button>
                </form>
              )}
            </div>
          ) : (
            /* STANDARD LOGIN / REGISTER VIEW */
            <>
              {/* Tab Switcher */}
              <div className="flex items-center p-1 bg-slate-100 dark:bg-[#050b14] border border-slate-200 dark:border-[#162a45] rounded-2xl mb-5">
                <button 
                  type="button" 
                  onClick={() => { 
                    setIsRegister(false); 
                    clearMessages();
                  }} 
                  className={`flex-1 py-2.5 rounded-xl font-bold text-xs transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
                    !isRegister 
                      ? 'smart-cyan-pill text-white' 
                      : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                  }`}
                >
                  <LogIn size={14} />
                  <span>লগইন (Sign In)</span>
                </button>
                
                <button 
                  type="button" 
                  onClick={() => { 
                    setIsRegister(true); 
                    clearMessages();
                  }} 
                  className={`flex-1 py-2.5 rounded-xl font-bold text-xs transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
                    isRegister 
                      ? 'smart-cyan-pill text-white' 
                      : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                  }`}
                >
                  <UserPlus size={14} />
                  <span>রেজিস্ট্রেশন (Register)</span>
                </button>
              </div>

              {/* Sign In Form */}
              {!isRegister ? (
                <form onSubmit={handleSignIn} className="space-y-4">
                  <div className="space-y-1">
                    <label className="text-xs font-bold text-cyan-700 dark:text-[#00d2ff] flex items-center gap-1.5">
                      <Mail size={13} /> ইমেইল (Email)
                    </label>
                    <input 
                      required 
                      type="email" 
                      autoFocus
                      placeholder="name@example.com"
                      className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 dark:bg-[#050b14] border border-slate-200 dark:border-[#162a45] focus:border-[#00d2ff] text-slate-900 dark:text-white outline-none text-xs sm:text-sm transition-all" 
                      value={email} 
                      onChange={e => setEmail(e.target.value)} 
                    />
                  </div>

                  <div className="space-y-1">
                    <div className="flex items-center justify-between">
                      <label className="text-xs font-bold text-cyan-700 dark:text-[#00d2ff] flex items-center gap-1.5">
                        <Lock size={13} /> পাসওয়ার্ড (Password)
                      </label>
                      <button
                        type="button"
                        onClick={() => {
                          setIsForgot(true);
                          clearMessages();
                        }}
                        className="text-[11px] font-bold text-cyan-600 dark:text-[#00e5ff] hover:underline cursor-pointer transition-colors"
                      >
                        পাসওয়ার্ড ভুলে গেছেন?
                      </button>
                    </div>
                    <div className="relative">
                      <input 
                        required 
                        type={showPassword ? "text" : "password"} 
                        placeholder="••••••••"
                        className="w-full pl-3.5 pr-10 py-2.5 rounded-xl bg-slate-50 dark:bg-[#050b14] border border-slate-200 dark:border-[#162a45] focus:border-[#00d2ff] text-slate-900 dark:text-white outline-none text-xs sm:text-sm tracking-wider transition-all" 
                        value={password} 
                        onChange={e => setPassword(e.target.value)} 
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700 dark:hover:text-white cursor-pointer"
                      >
                        {showPassword ? <EyeOff size={15} /> : <Eye size={15} />}
                      </button>
                    </div>
                  </div>

                  <button 
                    type="submit" 
                    disabled={loading} 
                    className="w-full mt-2 smart-cyan-pill py-3 px-4 flex items-center justify-center gap-2 text-xs sm:text-sm font-black uppercase tracking-wider cursor-pointer transition-all disabled:opacity-50 text-white"
                  >
                    {loading ? <Loader2 className="animate-spin" size={16} /> : <span>লগইন করুন (Sign In)</span>}
                  </button>
                </form>
              ) : (
                /* Register Form */
                <form onSubmit={handleSignUp} className="space-y-3.5">
                  <div className="space-y-1">
                    <label className="text-xs font-bold text-cyan-700 dark:text-[#00d2ff] flex items-center gap-1.5">
                      <Store size={13} /> বেকারি / দোকানের নাম
                    </label>
                    <input 
                      required 
                      type="text" 
                      autoFocus
                      placeholder="যেমন: গ্রিন বেকারি অ্যান্ড কনফেকশনারি"
                      className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 dark:bg-[#050b14] border border-slate-200 dark:border-[#162a45] focus:border-[#00d2ff] text-slate-900 dark:text-white outline-none text-xs sm:text-sm" 
                      value={businessName} 
                      onChange={e => setBusinessName(e.target.value)} 
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-xs font-bold text-cyan-700 dark:text-[#00d2ff] flex items-center gap-1.5">
                      <User size={13} /> মালিক / প্রোপাইটার নাম
                    </label>
                    <input 
                      type="text" 
                      placeholder="আপনার নাম"
                      className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 dark:bg-[#050b14] border border-slate-200 dark:border-[#162a45] focus:border-[#00d2ff] text-slate-900 dark:text-white outline-none text-xs sm:text-sm" 
                      value={ownerName} 
                      onChange={e => setOwnerName(e.target.value)} 
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-xs font-bold text-cyan-700 dark:text-[#00d2ff] flex items-center gap-1.5">
                      <Mail size={13} /> ইমেইল (Login Email)
                    </label>
                    <input 
                      required 
                      type="email" 
                      placeholder="owner@example.com"
                      className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 dark:bg-[#050b14] border border-slate-200 dark:border-[#162a45] focus:border-[#00d2ff] text-slate-900 dark:text-white outline-none text-xs sm:text-sm" 
                      value={email} 
                      onChange={e => setEmail(e.target.value)} 
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-xs font-bold text-cyan-700 dark:text-[#00d2ff] flex items-center gap-1.5">
                      <Lock size={13} /> পাসওয়ার্ড (Password)
                    </label>
                    <input 
                      required 
                      type="password" 
                      minLength={8}
                      placeholder="কমপক্ষে ৮ ডিজিট"
                      className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 dark:bg-[#050b14] border border-slate-200 dark:border-[#162a45] focus:border-[#00d2ff] text-slate-900 dark:text-white outline-none text-xs sm:text-sm tracking-wider" 
                      value={password} 
                      onChange={e => setPassword(e.target.value)} 
                    />
                  </div>

                  <button 
                    type="submit" 
                    disabled={loading} 
                    className="w-full mt-2 smart-cyan-pill py-3 px-4 flex items-center justify-center gap-2 text-xs sm:text-sm font-black uppercase tracking-wider cursor-pointer transition-all disabled:opacity-50 text-white"
                  >
                    {loading ? <Loader2 className="animate-spin" size={16} /> : <span>একাউন্ট তৈরি করুন (Register)</span>}
                  </button>
                </form>
              )}
            </>
          )}

        </div>

      </div>
    </div>
  );
};

export default Login;
