import React, { useState } from 'react';
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
  Sparkles,
  MailCheck
} from 'lucide-react';
import { supabase } from '../services/supabaseClient';

interface Props {
  onLogin: (email: string) => void;
  theme: 'dark' | 'light';
}

const Login: React.FC<Props> = ({ onLogin }) => {
  const [isRegister, setIsRegister] = useState(false);
  
  // Sign In State
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  
  // Sign Up State
  const [businessName, setBusinessName] = useState('');
  const [ownerName, setOwnerName] = useState('');
  
  // Status
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [loading, setLoading] = useState(false);
  const [showVerifyNotice, setShowVerifyNotice] = useState(false);

  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    setLoading(true);

    const cleanEmail = email.trim().toLowerCase();

    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email: cleanEmail,
        password: password,
      });

      if (error) {
        if (error.message.includes('Email not confirmed') || error.message.includes('not confirmed')) {
          setShowVerifyNotice(true);
          setError('আপনার ইমেইল ভেরিফাই করা হয়নি। ইমেইলে পাঠানো লিংকে ক্লিক করুন।');
        } else if (error.message.includes('Invalid login credentials')) {
          setError('ভুল ইমেইল বা পাসওয়ার্ড! আবার চেষ্টা করুন।');
        } else {
          setError(error.message || 'Login failed.');
        }
        setLoading(false);
        return;
      }

      if (data.user) {
        onLogin(cleanEmail);
      }
    } catch (err: any) {
      setError(err.message || 'Login failed.');
    } finally {
      setLoading(false);
    }
  };

  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess('');
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
      setError('পাসওয়ার্ড কমপক্ষে ৮ ডিজিট (8 characters) হতে হবে');
      setLoading(false);
      return;
    }

    try {
      const { data, error } = await supabase.auth.signUp({
        email: cleanEmail,
        password: password,
        options: {
          data: {
            full_name: cleanOwner || cleanBusiness,
            business_name: cleanBusiness,
            owner_name: cleanOwner || cleanBusiness,
          },
        },
      });

      if (error) {
        if (error.message.includes('already registered') || error.message.includes('already been registered')) {
          setError('এই ইমেইল দিয়ে আগেই একাউন্ট খোলা হয়েছে। লগইন করুন।');
        } else {
          setError(error.message || 'Registration failed.');
        }
        setLoading(false);
        return;
      }

      setBusinessName('');
      setOwnerName('');
      setPassword('');
      setIsRegister(false);
      
      if (data.user && !data.session) {
        // Email verification required
        setShowVerifyNotice(true);
        setSuccess('রেজিস্ট্রেশন সফল! আপনার ইমেইলে একটি ভেরিফিকেশন লিংক পাঠানো হয়েছে। লিংকে ক্লিক করে ইমেইল ভেরিফাই করুন, তারপর লগইন করুন।');
      } else if (data.session) {
        // Auto-confirmed (email confirmation disabled)
        onLogin(cleanEmail);
      }
    } catch (err: any) {
      setError(err.message || 'Registration failed.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#040812] flex flex-col items-center justify-center p-4 sm:p-6 relative overflow-hidden font-sans text-slate-100 selection:bg-[#00e5ff] selection:text-black">
      {/* Background Ambient Glow */}
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 w-[500px] h-[500px] bg-[#00d2ff]/5 rounded-full blur-[120px] pointer-events-none" />

      {/* Main Container */}
      <div className="max-w-[420px] w-full relative z-10">
        
        {/* Brand Logo & Title */}
        <div className="mb-6 text-center flex flex-col items-center">
          <div className="w-16 h-16 bg-[#071324] rounded-2xl border border-[#00d2ff]/40 flex items-center justify-center shadow-[0_0_25px_rgba(0,210,255,0.25)] mb-3 transition-transform hover:scale-105">
            <UtensilsCrossed size={32} className="text-[#00e5ff] drop-shadow-[0_0_10px_rgba(0,229,255,0.8)]" />
          </div>
          <h1 className="text-2xl font-black text-white tracking-tight">
            Sweet Treats <span className="text-[#00e5ff]">Corporation</span>
          </h1>
          <p className="text-slate-400 text-xs font-medium mt-1">
            {isRegister ? 'নতুন স্টোর একাউন্ট তৈরি করুন' : 'আপনার স্টোর একাউন্টে লগইন করুন'}
          </p>
        </div>

        {/* Card */}
        <div className="bg-[#09111f]/95 rounded-3xl shadow-[0_20px_50px_rgba(0,0,0,0.8)] p-6 sm:p-7 border border-[#162744] backdrop-blur-xl">
          
          {/* Email Verification Notice */}
          {showVerifyNotice && (
            <div className="mb-5 bg-[#00e5ff]/10 border border-[#00e5ff]/30 p-4 rounded-2xl flex items-start gap-3">
              <MailCheck size={20} className="text-[#00e5ff] shrink-0 mt-0.5" />
              <div>
                <p className="text-xs font-bold text-[#00e5ff] mb-1">ইমেইল ভেরিফিকেশন প্রয়োজন</p>
                <p className="text-[11px] text-slate-300 leading-relaxed">
                  আপনার ইমেইলে একটি ভেরিফিকেশন লিংক পাঠানো হয়েছে। ইমেইল চেক করে লিংকে ক্লিক করুন, তারপর লগইন করুন।
                </p>
              </div>
            </div>
          )}

          {/* Simple Tab Switcher */}
          <div className="flex items-center p-1 bg-[#050b14] border border-[#162a45] rounded-2xl mb-5">
            <button 
              type="button" 
              onClick={() => { 
                setIsRegister(false); 
                setEmail(''); 
                setPassword(''); 
                setBusinessName(''); 
                setOwnerName(''); 
                setError(''); 
                setSuccess(''); 
                setShowVerifyNotice(false);
              }} 
              className={`flex-1 py-2.5 rounded-xl font-bold text-xs transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
                !isRegister 
                  ? 'smart-cyan-pill text-white' 
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <LogIn size={14} />
              <span>লগইন (Sign In)</span>
            </button>
            
            <button 
              type="button" 
              onClick={() => { 
                setIsRegister(true); 
                setEmail(''); 
                setPassword(''); 
                setBusinessName(''); 
                setOwnerName(''); 
                setError(''); 
                setSuccess(''); 
                setShowVerifyNotice(false);
              }} 
              className={`flex-1 py-2.5 rounded-xl font-bold text-xs transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
                isRegister 
                  ? 'smart-cyan-pill text-white' 
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <UserPlus size={14} />
              <span>রেজিস্ট্রেশন (Register)</span>
            </button>
          </div>

          {/* Messages */}
          {error && (
            <div className="mb-4 bg-red-500/10 border border-red-500/30 text-red-400 p-3 rounded-xl text-xs font-semibold flex items-start gap-2">
              <AlertCircle size={15} className="shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          {success && (
            <div className="mb-4 bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 p-3 rounded-xl text-xs font-semibold flex items-start gap-2">
              <Check size={15} className="shrink-0 mt-0.5" />
              <span>{success}</span>
            </div>
          )}

          {/* Form */}
          {!isRegister ? (
            /* Sign In Form */
            <form onSubmit={handleSignIn} className="space-y-4">
              <div className="space-y-1">
                <label className="text-xs font-bold text-[#00d2ff] flex items-center gap-1.5">
                  <Mail size={13} /> ইমেইল (Email)
                </label>
                <input 
                  required 
                  type="email" 
                  autoFocus
                  className="w-full px-3.5 py-2.5 rounded-xl bg-[#050b14] border border-[#162a45] focus:border-[#00d2ff] text-white outline-none text-xs sm:text-sm transition-all" 
                  value={email} 
                  onChange={e => setEmail(e.target.value)} 
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-bold text-[#00d2ff] flex items-center gap-1.5">
                  <Lock size={13} /> পাসওয়ার্ড (Password)
                </label>
                <input 
                  required 
                  type="password" 
                  className="w-full px-3.5 py-2.5 rounded-xl bg-[#050b14] border border-[#162a45] focus:border-[#00d2ff] text-white outline-none text-xs sm:text-sm tracking-wider transition-all" 
                  value={password} 
                  onChange={e => setPassword(e.target.value)} 
                />
              </div>

              <button 
                type="submit" 
                disabled={loading} 
                className="w-full mt-2 smart-cyan-pill py-3 px-4 flex items-center justify-center gap-2 text-xs sm:text-sm font-black uppercase tracking-wider cursor-pointer transition-all disabled:opacity-50"
              >
                {loading ? <Loader2 className="animate-spin" size={16} /> : <span>লগইন করুন (Sign In)</span>}
              </button>
            </form>
          ) : (
            /* Register Form */
            <form onSubmit={handleSignUp} className="space-y-3.5">
              <div className="space-y-1">
                <label className="text-xs font-bold text-[#00d2ff] flex items-center gap-1.5">
                  <Store size={13} /> বেকারি / দোকানের নাম
                </label>
                <input 
                  required 
                  type="text" 
                  autoFocus
                  className="w-full px-3.5 py-2.5 rounded-xl bg-[#050b14] border border-[#162a45] focus:border-[#00d2ff] text-white outline-none text-xs sm:text-sm" 
                  value={businessName} 
                  onChange={e => setBusinessName(e.target.value)} 
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-bold text-[#00d2ff] flex items-center gap-1.5">
                  <User size={13} /> মালিক / প্রোপাইটার নাম
                </label>
                <input 
                  type="text" 
                  className="w-full px-3.5 py-2.5 rounded-xl bg-[#050b14] border border-[#162a45] focus:border-[#00d2ff] text-white outline-none text-xs sm:text-sm" 
                  value={ownerName} 
                  onChange={e => setOwnerName(e.target.value)} 
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-bold text-[#00d2ff] flex items-center gap-1.5">
                  <Mail size={13} /> ইমেইল (Login Email)
                </label>
                <input 
                  required 
                  type="email" 
                  className="w-full px-3.5 py-2.5 rounded-xl bg-[#050b14] border border-[#162a45] focus:border-[#00d2ff] text-white outline-none text-xs sm:text-sm" 
                  value={email} 
                  onChange={e => setEmail(e.target.value)} 
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-bold text-[#00d2ff] flex items-center gap-1.5">
                  <Lock size={13} /> পাসওয়ার্ড (Password)
                </label>
                <input 
                  required 
                  type="password" 
                  minLength={8}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-[#050b14] border border-[#162a45] focus:border-[#00d2ff] text-white outline-none text-xs sm:text-sm tracking-wider" 
                  value={password} 
                  onChange={e => setPassword(e.target.value)} 
                />
              </div>

              <button 
                type="submit" 
                disabled={loading} 
                className="w-full mt-2 smart-cyan-pill py-3 px-4 flex items-center justify-center gap-2 text-xs sm:text-sm font-black uppercase tracking-wider cursor-pointer transition-all disabled:opacity-50"
              >
                {loading ? <Loader2 className="animate-spin" size={16} /> : <span>একাউন্ট তৈরি করুন (Register)</span>}
              </button>
            </form>
          )}

        </div>

      </div>
    </div>
  );
};

export default Login;
