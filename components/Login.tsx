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
  ShieldCheck,
  Database
} from 'lucide-react';
import { storageService } from '../services/storageService';
import { UserProfile } from '../types';
import { generateId } from '../services/idGenerator';
import { supabase, isSupabaseConfigured } from '../services/supabaseClient';

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
  const [managerPin, setManagerPin] = useState('');
  
  // Status
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess('');
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
          // Fetch synced profile
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

      // Fallback local auth (without demo bypass)
      const profiles = storageService.getProfiles();
      const user = profiles.find(p => p.email.toLowerCase() === cleanEmail);

      if (!user) {
        setError('এই ইমেইলে কোনো একাউন্ট পাওয়া যায়নি। নতুন একাউন্ট রেজিস্টার করুন।');
        setLoading(false);
        return;
      }

      if (user.password && user.password !== password) {
        setError('ভুল পাসওয়ার্ড! আবার চেষ্টা করুন।');
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
    setError('');
    setSuccess('');
    setLoading(true);

    const cleanEmail = email.trim().toLowerCase();
    const cleanBusiness = businessName.trim();
    const cleanOwner = ownerName.trim();
    const cleanPin = managerPin.trim();

    if (!cleanBusiness) {
      setError('দোকান বা বেকারির নাম লিখুন');
      setLoading(false);
      return;
    }

    if (!cleanPin || cleanPin.length < 4 || cleanPin.length > 6 || !/^\d+$/.test(cleanPin)) {
      setError('ম্যানেজার পিন ৪ থেকে ৬ ডিজিটের সংখ্যা হতে হবে');
      setLoading(false);
      return;
    }

    if (password.length < 8) {
      setError('পাসওয়ার্ড কমপক্ষে ৮ ডিজিট (8 characters) হতে হবে');
      setLoading(false);
      return;
    }

    try {
      if (isSupabaseConfigured && supabase) {
        // Register through Supabase Auth
        const { data: signUpData, error: signUpErr } = await supabase.auth.signUp({
          email: cleanEmail,
          password: password,
          options: {
            data: {
              business_name: cleanBusiness,
              owner_name: cleanOwner || cleanBusiness,
              manager_pin: cleanPin
            }
          }
        });

        if (signUpErr) {
          setError(signUpErr.message || 'রেজিস্ট্রেশন ব্যর্থ হয়েছে।');
          setLoading(false);
          return;
        }

        const newProfile: UserProfile = {
          id: signUpData.user?.id || generateId('usr'),
          email: cleanEmail,
          username: cleanEmail.split('@')[0] || 'bakery',
          businessName: cleanBusiness,
          ownerName: cleanOwner || cleanBusiness,
          managerPin: cleanPin,
          currencySymbol: '৳',
          receiptFooter: `Thank you for shopping at ${cleanBusiness}!`,
          createdAt: new Date().toISOString(),
          lastLogin: new Date().toISOString()
        };

        try {
          await storageService.saveProfile(newProfile);
          await storageService.setManagerPin(cleanEmail, cleanPin);
        } catch (e) {
          console.warn("Profile save warning:", e);
        }

        setBusinessName('');
        setOwnerName('');
        setManagerPin('');
        setPassword('');
        setIsRegister(false);
        setSuccess('রেজিস্ট্রেশন সফল হয়েছে! এখন পাসওয়ার্ড দিয়ে লগইন করুন।');
        setLoading(false);
        return;
      }

      // Local Registration (when Supabase credentials are pending)
      const profiles = storageService.getProfiles();
      if (profiles.some(p => p.email.toLowerCase() === cleanEmail)) {
        setError('এই ইমেইল দিয়ে আগেই একাউন্ট খোলা হয়েছে। লগইন করুন।');
        setLoading(false);
        return;
      }

      const newProfile: UserProfile = {
        id: generateId('usr'),
        email: cleanEmail,
        username: cleanEmail.split('@')[0] || 'bakery',
        businessName: cleanBusiness,
        ownerName: cleanOwner || cleanBusiness,
        password: password,
        managerPin: cleanPin,
        currencySymbol: '৳',
        receiptFooter: `Thank you for shopping at ${cleanBusiness}!`,
        createdAt: new Date().toISOString(),
        lastLogin: new Date().toISOString()
      };

      try {
        await storageService.saveProfile(newProfile);
        await storageService.setManagerPin(cleanEmail, cleanPin);
      } catch (e) {
        console.warn("Profile save warning:", e);
      }

      setBusinessName('');
      setOwnerName('');
      setManagerPin('');
      setPassword('');
      setIsRegister(false);
      setSuccess('রেজিস্ট্রেশন সফল হয়েছে! পাসওয়ার্ড দিয়ে লগইন করুন।');
      setLoading(false);
    } catch (err: any) {
      setError(err.message || 'Registration failed.');
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#040812] flex flex-col items-center justify-center p-4 sm:p-6 relative overflow-hidden font-sans text-slate-100 selection:bg-[#00e5ff] selection:text-black">
      {/* Background Ambient Glow */}
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 w-[500px] h-[500px] bg-[#00d2ff]/5 rounded-full blur-[120px] pointer-events-none" />

      {/* Main Container */}
      <div className="max-w-[440px] w-full relative z-10">
        
        {/* Brand Logo & Title */}
        <div className="mb-6 text-center flex flex-col items-center">
          <div className="w-16 h-16 bg-[#071324] rounded-2xl border border-[#00d2ff]/40 flex items-center justify-center shadow-[0_0_25px_rgba(0,210,255,0.25)] mb-3 transition-transform hover:scale-105">
            <UtensilsCrossed size={32} className="text-[#00e5ff] drop-shadow-[0_0_10px_rgba(0,229,255,0.8)]" />
          </div>
          <h1 className="text-2xl font-black text-white tracking-tight">
            Bakery Smart <span className="text-[#00e5ff]">Manager</span>
          </h1>
          <p className="text-slate-400 text-xs font-medium mt-1">
            {isRegister ? 'নতুন বেকারি একাউন্ট তৈরি করুন' : 'আপনার বেকারি একাউন্টে লগইন করুন'}
          </p>

          {/* Supabase Connection Status Notice */}
          <div className="mt-3 flex items-center gap-2 px-3 py-1.5 rounded-full text-[11px] font-semibold bg-[#071526] border border-[#162744] text-slate-300">
            <Database size={13} className={isSupabaseConfigured ? "text-emerald-400" : "text-amber-400"} />
            <span>
              {isSupabaseConfigured ? "Supabase Connected" : "Supabase: Migration Ready (Env variables pending)"}
            </span>
          </div>
        </div>

        {/* Card */}
        <div className="bg-[#09111f]/95 rounded-3xl shadow-[0_20px_50px_rgba(0,0,0,0.8)] p-6 sm:p-7 border border-[#162744] backdrop-blur-xl">
          
          {/* Tab Switcher */}
          <div className="flex items-center p-1 bg-[#050b14] border border-[#162a45] rounded-2xl mb-5">
            <button 
              type="button" 
              onClick={() => { 
                setIsRegister(false); 
                setEmail(''); 
                setPassword(''); 
                setBusinessName(''); 
                setOwnerName(''); 
                setManagerPin('');
                setError(''); 
                setSuccess(''); 
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
                setManagerPin('');
                setError(''); 
                setSuccess(''); 
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
                  placeholder="name@example.com"
                  className="w-full px-3.5 py-2.5 rounded-xl bg-[#050b14] border border-[#162a45] focus:border-[#00d2ff] text-white outline-none text-xs sm:text-sm transition-all" 
                  value={email} 
                  onChange={e => setEmail(e.target.value)} 
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-bold text-[#00d2ff] flex items-center gap-1.5">
                  <Lock size={13} /> পাসওয়ার্ড (Password)
                </label>
                <input 
                  required 
                  type="password" 
                  placeholder="••••••••"
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
                  placeholder="যেমন: গ্রিন বেকারি অ্যান্ড কনফেকশনারি"
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
                  placeholder="আপনার নাম"
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
                  placeholder="owner@example.com"
                  className="w-full px-3.5 py-2.5 rounded-xl bg-[#050b14] border border-[#162a45] focus:border-[#00d2ff] text-white outline-none text-xs sm:text-sm" 
                  value={email} 
                  onChange={e => setEmail(e.target.value)} 
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-xs font-bold text-[#00d2ff] flex items-center gap-1.5">
                    <Lock size={13} /> পাসওয়ার্ড (Password)
                  </label>
                  <input 
                    required 
                    type="password" 
                    minLength={8}
                    placeholder="কমপক্ষে ৮ ডিজিট"
                    className="w-full px-3.5 py-2.5 rounded-xl bg-[#050b14] border border-[#162a45] focus:border-[#00d2ff] text-white outline-none text-xs sm:text-sm tracking-wider" 
                    value={password} 
                    onChange={e => setPassword(e.target.value)} 
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-bold text-[#00d2ff] flex items-center gap-1.5">
                    <ShieldCheck size={13} /> ম্যানেজার পিন (PIN)
                  </label>
                  <input 
                    required 
                    type="password" 
                    maxLength={6}
                    minLength={4}
                    placeholder="৪-৬ ডিজিট"
                    className="w-full px-3.5 py-2.5 rounded-xl bg-[#050b14] border border-[#162a45] focus:border-[#00d2ff] text-white outline-none text-xs sm:text-sm tracking-widest text-center" 
                    value={managerPin} 
                    onChange={e => setManagerPin(e.target.value)} 
                  />
                </div>
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
