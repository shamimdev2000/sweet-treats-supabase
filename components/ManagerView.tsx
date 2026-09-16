import React, { useState, useEffect } from 'react';
import { toast } from 'sonner';
import { 
  User, 
  ShieldCheck, 
  Calendar, 
  HardDrive, 
  LogOut, 
  Key, 
  Trash2, 
  AlertTriangle, 
  Lock, 
  RefreshCw, 
  Store, 
  Phone, 
  MapPin, 
  FileText, 
  Save, 
  Check, 
  Building2,
  DollarSign,
  Shield,
  Clock,
  Cloud,
  Database,
  UploadCloud,
  Copy,
  ExternalLink,
  Activity,
  Eye,
  EyeOff
} from 'lucide-react';
import { UserProfile } from '../types';
import { storageService } from '../services/storageService';
import { isSupabaseConfigured, supabase } from '../services/supabaseClient';
import { SETUP_SCHEMA_SQL } from '../services/schemaSql';
import { SyncLogsView } from './SyncLogsView';

interface Props {
  username: string;
  profile: UserProfile | null;
  onLogout: () => void;
  onReset: () => void;
  onUpdatePassword: (newPass: string) => Promise<void> | void;
  onUpdateAccountPassword?: (newPass: string) => Promise<{ success: boolean; message: string }>;
  onUpdateProfile: (updates: Partial<UserProfile>) => Promise<void>;
  onLock: () => void;
  currentPassword: string;
  stats: {
    products: number;
    sales: number;
    expenses: number;
    staff: number;
    storageSize: number;
  };
}

const ManagerView: React.FC<Props> = ({ 
  username, 
  profile, 
  onLogout, 
  onReset, 
  onUpdatePassword, 
  onUpdateAccountPassword,
  onUpdateProfile,
  onLock, 
  currentPassword, 
  stats 
}) => {
  const [newPass, setNewPass] = useState('');
  const [confirmPass, setConfirmPass] = useState('');
  const [isChangingPass, setIsChangingPass] = useState(false);
  const [isUpdatingPin, setIsUpdatingPin] = useState(false);

  // Cloud Account Login Password State
  const [isChangingLoginPass, setIsChangingLoginPass] = useState(false);
  const [newLoginPass, setNewLoginPass] = useState('');
  const [confirmLoginPass, setConfirmLoginPass] = useState('');
  const [showLoginPass, setShowLoginPass] = useState(false);
  const [isUpdatingLoginPass, setIsUpdatingLoginPass] = useState(false);

  const [activeAdminTab, setActiveAdminTab] = useState<'settings' | 'sync-logs'>('settings');
  const [failedSyncCount, setFailedSyncCount] = useState(0);

  const [isSyncingCloud, setIsSyncingCloud] = useState(false);
  const [isTestingConn, setIsTestingConn] = useState(false);

  // Monitor sync error count for alert badge
  useEffect(() => {
    try {
      const logs = storageService.getSyncLogs(username);
      const errors = logs.filter(l => l.status === 'error').length;
      setFailedSyncCount(errors);
    } catch {
      setFailedSyncCount(0);
    }
  }, [username, isSyncingCloud, isTestingConn]);

  const handleLoginPassUpdate = async () => {
    const cleanPass = newLoginPass.trim();
    if (!cleanPass || cleanPass.length < 8) {
      toast.error("পাসওয়ার্ড কমপক্ষে ৮ অক্ষরের হতে হবে (Minimum 8 characters)!");
      return;
    }
    if (cleanPass !== confirmLoginPass.trim()) {
      toast.error("নতুন পাসওয়ার্ড ও কনফার্ম পাসওয়ার্ড মিলছে না!");
      return;
    }

    setIsUpdatingLoginPass(true);
    const toastId = toast.loading("Saving new password to Supabase Cloud...");
    try {
      let res: { success: boolean; message: string };
      if (onUpdateAccountPassword) {
        res = await onUpdateAccountPassword(cleanPass);
      } else {
        res = await storageService.updateAccountPassword(username, cleanPass);
      }

      if (res.success) {
        toast.success(res.message, { id: toastId, duration: 7000 });
        setIsChangingLoginPass(false);
        setNewLoginPass('');
        setConfirmLoginPass('');
      } else {
        toast.error(res.message, { id: toastId, duration: 7000 });
      }
    } catch (e: any) {
      toast.error(`পাসওয়ার্ড পরিবর্তন ব্যর্থ হয়েছে: ${e.message}`, { id: toastId });
    } finally {
      setIsUpdatingLoginPass(false);
    }
  };

  const handleSyncToSupabase = async () => {
    setIsSyncingCloud(true);
    const toastId = toast.loading("Connecting and syncing local data to Supabase...");
    try {
      const result = await storageService.syncAllLocalDataToSupabase(username);
      if (result.success) {
        toast.success(`Successfully synchronized ${result.count} records to Supabase!`, { id: toastId });
      } else {
        toast.error(result.error || "Failed to sync to Supabase.", { id: toastId, duration: 6000 });
      }
    } catch (e: any) {
      toast.error(`Sync error: ${e.message}`, { id: toastId });
    } finally {
      setIsSyncingCloud(false);
    }
  };

  const handleCopySchemaSql = async () => {
    try {
      await navigator.clipboard.writeText(SETUP_SCHEMA_SQL);
      toast.success("Copied complete setup_schema.sql to clipboard! Paste it into Supabase SQL Editor and click RUN.");
    } catch {
      toast.info("Please copy the script in /supabase/setup_schema.sql into your Supabase SQL Editor.");
    }
  };

  const handleTestConnection = async () => {
    setIsTestingConn(true);
    const toastId = toast.loading("Running full CRUD diagnostics against live Supabase database...");
    try {
      if (!isSupabaseConfigured || !supabase) {
        toast.error("Supabase client is not configured.", { id: toastId });
        return;
      }
      const res = await storageService.testDatabaseOperations(username);
      if (res.success) {
        toast.success("✅ Supabase Verified: SELECT, INSERT, UPDATE, DELETE all working on public.products!", { id: toastId, duration: 6000 });
      } else {
        if (res.error?.code === 'PGRST205' || res.details?.includes('schema cache') || res.details?.includes('Could not find the table')) {
          toast.error("Table public.products not found in schema cache. Run setup_schema.sql in Supabase SQL Editor and reload schema cache.", { id: toastId, duration: 8000 });
        } else {
          toast.error(`❌ Diagnostic failed at [${res.step}]: ${res.details}`, { id: toastId, duration: 7000 });
        }
      }
    } catch (e: any) {
      toast.error(`Diagnostic failed: ${e.message}`, { id: toastId });
    } finally {
      setIsTestingConn(false);
    }
  };

  // Business Profile Form state
  const [businessName, setBusinessName] = useState(profile?.businessName || 'My Bakery');
  const [ownerName, setOwnerName] = useState(profile?.ownerName || username.split('@')[0]);
  const [phone, setPhone] = useState(profile?.phone || '');
  const [address, setAddress] = useState(profile?.address || '');
  const [receiptFooter, setReceiptFooter] = useState(profile?.receiptFooter || 'Thank you for shopping with us! Freshly baked with love.');
  const [currencySymbol, setCurrencySymbol] = useState(profile?.currencySymbol || '৳');
  const [isSavingProfile, setIsSavingProfile] = useState(false);

  useEffect(() => {
    if (profile) {
      setBusinessName(profile.businessName || 'My Bakery');
      setOwnerName(profile.ownerName || username.split('@')[0]);
      setPhone(profile.phone || '');
      setAddress(profile.address || '');
      setReceiptFooter(profile.receiptFooter || 'Thank you for shopping with us! Freshly baked with love.');
      setCurrencySymbol(profile.currencySymbol || '৳');
    }
  }, [profile, username]);

  const handlePassUpdate = async () => {
    const cleanPin = newPass.trim();
    if (cleanPin.length < 4 || cleanPin.length > 6) {
      toast.error("Manager PIN must be between 4 and 6 digits.");
      return;
    }
    if (confirmPass && cleanPin !== confirmPass.trim()) {
      toast.error("New PIN and Confirm PIN do not match.");
      return;
    }
    setIsUpdatingPin(true);
    const toastId = toast.loading("Saving new PIN to database...");
    try {
      await onUpdatePassword(cleanPin);
      setNewPass('');
      setConfirmPass('');
      setIsChangingPass(false);
      toast.success("Manager Security PIN updated and saved to database!", { id: toastId });
    } catch (e: any) {
      toast.error(`Failed to save PIN: ${e.message || 'Database error'}`, { id: toastId });
    } finally {
      setIsUpdatingPin(false);
    }
  };

  const handleProfileSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!businessName.trim()) {
      toast.error("Business name cannot be empty.");
      return;
    }

    setIsSavingProfile(true);
    try {
      await onUpdateProfile({
        businessName: businessName.trim(),
        ownerName: ownerName.trim(),
        phone: phone.trim(),
        address: address.trim(),
        receiptFooter: receiptFooter.trim(),
        currencySymbol: currencySymbol.trim() || '৳'
      });
      toast.success("Store profile updated successfully!");
    } catch (e) {
      toast.error("Failed to update profile.");
    } finally {
      setIsSavingProfile(false);
    }
  };

  return (
    <div className="max-w-5xl mx-auto space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500 pb-12">
      
      {/* Top Banner Card */}
      <div className="bg-white dark:bg-[#070e1b] p-6 sm:p-8 md:p-10 rounded-3xl border border-slate-200 dark:border-[#162744] shadow-sm relative overflow-hidden">
        <div className="relative z-10 flex flex-col md:flex-row items-center md:items-start gap-6">
          <div className="w-20 h-20 sm:w-24 sm:h-24 bg-[#0a1527] border border-[#00d2ff]/30 rounded-2xl flex items-center justify-center text-[#00e5ff] shadow-[0_0_20px_rgba(0,210,255,0.2)] shrink-0">
            <Store size={44} />
          </div>
          
          <div className="text-center md:text-left flex-1">
            <div className="flex flex-wrap items-center justify-center md:justify-start gap-3 mb-1.5">
              <h2 className="text-2xl md:text-3xl font-black text-slate-900 dark:text-white">
                {profile?.businessName || 'Bakery Store'}
              </h2>
              <span className="bg-emerald-500/10 text-emerald-400 text-[10px] font-bold uppercase tracking-widest px-2.5 py-0.5 rounded-full border border-emerald-500/20">
                Isolated SaaS Account
              </span>
            </div>
            
            <p className="text-slate-400 text-xs font-medium mb-4 flex flex-wrap items-center justify-center md:justify-start gap-2">
              <span className="flex items-center gap-1">
                <User size={14} className="text-[#00e5ff]" />
                Owner: <strong className="text-slate-200">{profile?.ownerName || username.split('@')[0]}</strong>
              </span>
              <span>•</span>
              <span className="text-slate-400">Account Email: {username}</span>
            </p>

            <div className="flex flex-wrap justify-center md:justify-start gap-2.5">
              <div className="flex items-center gap-2 text-[11px] text-slate-300 font-bold uppercase tracking-wider bg-slate-50 dark:bg-[#0a1527] px-3 py-1.5 rounded-xl border border-slate-200 dark:border-[#162744]">
                <ShieldCheck size={13} className="text-[#00e5ff]" />
                Tenant: {profile?.id || 'tenant_default'}
              </div>
              <div className="flex items-center gap-2 text-[11px] text-slate-300 font-bold uppercase tracking-wider bg-slate-50 dark:bg-[#0a1527] px-3 py-1.5 rounded-xl border border-slate-200 dark:border-[#162744]">
                <HardDrive size={13} className="text-[#00e5ff]" />
                Storage: 100% Isolated
              </div>
              <div className="flex items-center gap-2 text-[11px] text-slate-300 font-bold uppercase tracking-wider bg-slate-50 dark:bg-[#0a1527] px-3 py-1.5 rounded-xl border border-slate-200 dark:border-[#162744]">
                <Calendar size={13} className="text-[#00e5ff]" />
                Registered: {profile?.createdAt ? new Date(profile.createdAt).toLocaleDateString() : 'Active'}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Admin Panel Sub-Navigation Tabs */}
      <div className="flex items-center gap-2 border-b border-slate-200 dark:border-[#162744] pb-3">
        <button
          type="button"
          onClick={() => setActiveAdminTab('settings')}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
            activeAdminTab === 'settings'
              ? 'bg-[#00e5ff] text-[#050b14] shadow-sm'
              : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-[#0a1527]'
          }`}
        >
          <Building2 size={15} />
          <span>Store Settings & Security</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveAdminTab('sync-logs')}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
            activeAdminTab === 'sync-logs'
              ? 'bg-[#00e5ff] text-[#050b14] shadow-sm'
              : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-[#0a1527]'
          }`}
        >
          <Activity size={15} />
          <span>Sync Logs & Diagnostics</span>
          {failedSyncCount > 0 ? (
            <span className="bg-rose-500 text-white text-[10px] font-black px-1.5 py-0.5 rounded-full animate-pulse">
              {failedSyncCount} failed
            </span>
          ) : (
            <span className="bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 text-[10px] font-bold px-1.5 py-0.5 rounded-md">
              Active
            </span>
          )}
        </button>
      </div>

      {/* Tab 2: Sync Logs & Diagnostics View */}
      {activeAdminTab === 'sync-logs' ? (
        <SyncLogsView 
          username={username}
          onRunSync={handleSyncToSupabase}
          onRunDiagnostic={handleTestConnection}
        />
      ) : (
        <>
          {/* Main Grid: Business Profile Settings & Account Security */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Left 2 Cols: Business Profile Settings */}
        <div className="lg:col-span-2 bg-white dark:bg-[#070e1b] p-6 sm:p-8 rounded-3xl border border-slate-200 dark:border-[#162744] shadow-sm">
          <div className="flex items-center justify-between mb-6 pb-4 border-b border-slate-200 dark:border-[#162744]">
            <h3 className="text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2.5">
              <Building2 size={20} className="text-[#00e5ff]" />
              Store & Receipt Information
            </h3>
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
              Applied on Receipts & Reports
            </span>
          </div>

          <form onSubmit={handleProfileSave} className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-[#00d2ff] flex items-center gap-1.5">
                  <Store size={14} /> Business / Bakery Name
                </label>
                <input 
                  type="text" 
                  required
                  value={businessName}
                  onChange={e => setBusinessName(e.target.value)}
                  placeholder="e.g. Crown Bakery & Pastry"
                  className="w-full bg-slate-50 dark:bg-[#050b14] border border-slate-200 dark:border-[#162744] rounded-xl px-3.5 py-2.5 text-xs sm:text-sm font-semibold text-slate-900 dark:text-white outline-none focus:border-[#00e5ff] transition-all"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-bold text-[#00d2ff] flex items-center gap-1.5">
                  <User size={14} /> Owner / Manager Name
                </label>
                <input 
                  type="text" 
                  required
                  value={ownerName}
                  onChange={e => setOwnerName(e.target.value)}
                  placeholder="e.g. Mohammad Shamim"
                  className="w-full bg-slate-50 dark:bg-[#050b14] border border-slate-200 dark:border-[#162744] rounded-xl px-3.5 py-2.5 text-xs sm:text-sm font-semibold text-slate-900 dark:text-white outline-none focus:border-[#00e5ff] transition-all"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-[#00d2ff] flex items-center gap-1.5">
                  <Phone size={14} /> Store Contact Phone
                </label>
                <input 
                  type="text" 
                  value={phone}
                  onChange={e => setPhone(e.target.value)}
                  placeholder="01700-000000"
                  className="w-full bg-slate-50 dark:bg-[#050b14] border border-slate-200 dark:border-[#162744] rounded-xl px-3.5 py-2.5 text-xs sm:text-sm font-semibold text-slate-900 dark:text-white outline-none focus:border-[#00e5ff] transition-all"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-bold text-[#00d2ff] flex items-center gap-1.5">
                  <DollarSign size={14} /> Currency Symbol
                </label>
                <input 
                  type="text" 
                  value={currencySymbol}
                  onChange={e => setCurrencySymbol(e.target.value)}
                  placeholder="৳ or $ or ₹"
                  className="w-full bg-slate-50 dark:bg-[#050b14] border border-slate-200 dark:border-[#162744] rounded-xl px-3.5 py-2.5 text-xs sm:text-sm font-semibold text-slate-900 dark:text-white outline-none focus:border-[#00e5ff] transition-all"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-bold text-[#00d2ff] flex items-center gap-1.5">
                <MapPin size={14} /> Store Branch / Address
              </label>
              <input 
                type="text" 
                value={address}
                onChange={e => setAddress(e.target.value)}
                placeholder="e.g. Shop 12, Main Bazaar Road, Dhaka"
                className="w-full bg-slate-50 dark:bg-[#050b14] border border-slate-200 dark:border-[#162744] rounded-xl px-3.5 py-2.5 text-xs sm:text-sm font-semibold text-slate-900 dark:text-white outline-none focus:border-[#00e5ff] transition-all"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-bold text-[#00d2ff] flex items-center gap-1.5">
                <FileText size={14} /> Receipt Footer Note
              </label>
              <input 
                type="text" 
                value={receiptFooter}
                onChange={e => setReceiptFooter(e.target.value)}
                placeholder="e.g. Thank you for visiting! Please come again."
                className="w-full bg-slate-50 dark:bg-[#050b14] border border-slate-200 dark:border-[#162744] rounded-xl px-3.5 py-2.5 text-xs sm:text-sm font-semibold text-slate-900 dark:text-white outline-none focus:border-[#00e5ff] transition-all"
              />
            </div>

            <div className="pt-2 flex justify-end">
              <button 
                type="submit" 
                disabled={isSavingProfile}
                className="smart-cyan-pill py-3 px-6 text-xs font-bold uppercase tracking-wider flex items-center gap-2 cursor-pointer disabled:opacity-60"
              >
                <Save size={15} />
                <span>{isSavingProfile ? 'Saving Details...' : 'Save Store Details'}</span>
              </button>
            </div>
          </form>
        </div>

        {/* Right 1 Col: Account Security & PIN */}
        <div className="space-y-6">
          
          {/* Manager Security & Password Card */}
          <div className="bg-white dark:bg-[#070e1b] p-6 rounded-3xl border border-slate-200 dark:border-[#162744] shadow-sm">
            <h3 className="text-base font-bold text-slate-900 dark:text-white mb-4 flex items-center gap-2">
              <Key size={17} className="text-[#00e5ff]" />
              Account Security & PIN
            </h3>

            <div className="space-y-3.5">
              <div className="flex items-center justify-between p-3 bg-slate-50 dark:bg-[#0a1527] rounded-xl border border-slate-200 dark:border-[#162744]">
                <span className="text-slate-400 text-xs font-semibold">User Email</span>
                <span className="text-slate-900 dark:text-white font-bold text-xs truncate max-w-[140px]">{username}</span>
              </div>

              {/* 1. Supabase Account Login Password (used on any device for login) */}
              <div className="p-3 bg-slate-50 dark:bg-[#0a1527] rounded-xl border border-slate-200 dark:border-[#162744] space-y-2.5">
                <div className="flex justify-between items-center">
                  <div className="space-y-0.5">
                    <span className="text-slate-400 text-xs font-semibold flex items-center gap-1.5">
                      <Lock size={13} className="text-[#00e5ff]" />
                      Account Login Password
                    </span>
                    <p className="text-[10px] text-slate-500 dark:text-slate-400">
                      মোবাইল বা যেকোনো ডিভাইসে লগইন করার মূল পাসওয়ার্ড
                    </p>
                  </div>
                  <span className="text-slate-900 dark:text-white font-black tracking-widest text-sm">••••••••</span>
                </div>
                
                {isChangingLoginPass ? (
                  <div className="space-y-2.5 animate-in slide-in-from-top-2 pt-1 border-t border-slate-200 dark:border-[#162744]">
                    <div className="relative">
                      <input 
                        type={showLoginPass ? "text" : "password"}
                        placeholder="নতুন পাসওয়ার্ড (কমপক্ষে ৮ ডিজিট)"
                        className="w-full bg-white dark:bg-[#050b14] border border-slate-200 dark:border-[#162744] rounded-xl p-2.5 pr-10 text-slate-900 dark:text-white text-xs outline-none focus:border-[#00e5ff]"
                        value={newLoginPass}
                        onChange={e => setNewLoginPass(e.target.value)}
                      />
                      <button
                        type="button"
                        onClick={() => setShowLoginPass(!showLoginPass)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-200 cursor-pointer"
                      >
                        {showLoginPass ? <EyeOff size={14} /> : <Eye size={14} />}
                      </button>
                    </div>

                    <input 
                      type={showLoginPass ? "text" : "password"}
                      placeholder="নতুন পাসওয়ার্ড নিশ্চিত করুন"
                      className="w-full bg-white dark:bg-[#050b14] border border-slate-200 dark:border-[#162744] rounded-xl p-2.5 text-slate-900 dark:text-white text-xs outline-none focus:border-[#00e5ff]"
                      value={confirmLoginPass}
                      onChange={e => setConfirmLoginPass(e.target.value)}
                    />

                    <p className="text-[10px] text-cyan-700 dark:text-[#00e5ff]/90 bg-cyan-50 dark:bg-[#00e5ff]/10 p-2 rounded-lg border border-cyan-200 dark:border-[#00e5ff]/20">
                      ℹ️ এটি ক্লাউড ডাটাবেজে সেভ হবে। অন্য যেকোনো ডিভাইস বা ফোনে লগইন করতে এই নতুন পাসওয়ার্ড দিতে হবে।
                    </p>

                    <div className="flex gap-2 pt-1">
                      <button 
                        type="button"
                        onClick={handleLoginPassUpdate} 
                        disabled={isUpdatingLoginPass}
                        className="flex-1 bg-cyan-500 hover:bg-cyan-600 disabled:opacity-60 text-white font-bold py-2 rounded-lg text-xs cursor-pointer transition-colors shadow-sm"
                      >
                        {isUpdatingLoginPass ? 'ক্লাউডে সেভ হচ্ছে...' : 'Save Cloud Password'}
                      </button>
                      <button 
                        type="button"
                        disabled={isUpdatingLoginPass}
                        onClick={() => { setIsChangingLoginPass(false); setNewLoginPass(''); setConfirmLoginPass(''); }} 
                        className="flex-1 bg-slate-200 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:text-white font-bold py-2 rounded-lg text-xs cursor-pointer transition-colors"
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                ) : (
                  <button 
                    type="button"
                    onClick={() => setIsChangingLoginPass(true)}
                    className="w-full text-[#00e5ff] text-[10px] font-black uppercase tracking-widest hover:underline text-left cursor-pointer flex items-center justify-between pt-1"
                  >
                    <span>Change Login Password (পাসওয়ার্ড পরিবর্তন)</span>
                    <span>→</span>
                  </button>
                )}
              </div>

              {/* 2. Manager Security PIN (used for admin lock & sensitive operations) */}
              <div className="p-3 bg-slate-50 dark:bg-[#0a1527] rounded-xl border border-slate-200 dark:border-[#162744] space-y-2.5">
                <div className="flex justify-between items-center">
                  <div className="space-y-0.5">
                    <span className="text-slate-400 text-xs font-semibold flex items-center gap-1.5">
                      <ShieldCheck size={13} className="text-emerald-500" />
                      Manager Security PIN
                    </span>
                    <p className="text-[10px] text-slate-500 dark:text-slate-400">
                      অ্যাডমিন প্যানেল লক ও ক্লোজিং ভেরিফিকেশন পিন (৪-৬ ডিজিট)
                    </p>
                  </div>
                  <span className="text-slate-900 dark:text-white font-black tracking-widest text-sm">••••••</span>
                </div>
                
                {isChangingPass ? (
                  <div className="space-y-2 animate-in slide-in-from-top-2 pt-1 border-t border-slate-200 dark:border-[#162744]">
                    <input 
                      type="password"
                      maxLength={6}
                      placeholder="নতুন পিন (৪-৬ ডিজিটের সংখ্যা)"
                      className="w-full bg-white dark:bg-[#050b14] border border-slate-200 dark:border-[#162744] rounded-xl p-2 text-slate-900 dark:text-white text-xs outline-none focus:border-[#00e5ff] tracking-widest text-center"
                      value={newPass}
                      onChange={e => setNewPass(e.target.value)}
                    />
                    <input 
                      type="password"
                      maxLength={6}
                      placeholder="পিন নিশ্চিত করুন"
                      className="w-full bg-white dark:bg-[#050b14] border border-slate-200 dark:border-[#162744] rounded-xl p-2 text-slate-900 dark:text-white text-xs outline-none focus:border-[#00e5ff] tracking-widest text-center"
                      value={confirmPass}
                      onChange={e => setConfirmPass(e.target.value)}
                    />
                    <div className="flex gap-2 pt-1">
                      <button 
                        type="button"
                        onClick={handlePassUpdate} 
                        disabled={isUpdatingPin}
                        className="flex-1 bg-emerald-500 hover:bg-emerald-600 disabled:opacity-60 text-white font-bold py-1.5 rounded-lg text-xs cursor-pointer transition-colors shadow-sm"
                      >
                        {isUpdatingPin ? 'Saving...' : 'Save PIN'}
                      </button>
                      <button 
                        type="button"
                        disabled={isUpdatingPin}
                        onClick={() => { setIsChangingPass(false); setNewPass(''); setConfirmPass(''); }} 
                        className="flex-1 bg-slate-200 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:text-white font-bold py-1.5 rounded-lg text-xs cursor-pointer transition-colors"
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                ) : (
                  <button 
                    type="button"
                    onClick={() => setIsChangingPass(true)}
                    className="w-full text-emerald-500 dark:text-emerald-400 text-[10px] font-black uppercase tracking-widest hover:underline text-left cursor-pointer flex items-center justify-between pt-1"
                  >
                    <span>Change Security PIN (পিন পরিবর্তন)</span>
                    <span>→</span>
                  </button>
                )}
              </div>

              <button 
                onClick={onLock}
                className="w-full bg-[#0a1527] hover:bg-[#162744] text-slate-300 font-bold py-2.5 rounded-xl border border-[#162744] transition-all flex items-center justify-center gap-2 cursor-pointer text-xs"
              >
                <Lock size={15} />
                Lock Manager Profile
              </button>

              <button 
                type="button"
                onClick={onLogout}
                className="w-full bg-rose-500/10 hover:bg-rose-500 text-rose-400 hover:text-white font-bold py-2.5 rounded-xl border border-rose-500/20 transition-all flex items-center justify-center gap-2 cursor-pointer active:scale-95 text-xs shadow-sm"
              >
                <LogOut size={15} />
                Logout Account
              </button>
            </div>
          </div>

          {/* Supabase Cloud Sync Card */}
          <div className="bg-white dark:bg-[#070e1b] p-6 rounded-3xl border border-slate-200 dark:border-[#162744] shadow-sm">
            <h3 className="text-base font-bold text-slate-900 dark:text-white mb-3 flex items-center justify-between">
              <span className="flex items-center gap-2">
                <Cloud size={17} className="text-[#00e5ff]" />
                Supabase Cloud Database
              </span>
              <span className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded-md ${isSupabaseConfigured ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' : 'bg-amber-500/10 text-amber-400 border border-amber-500/20'}`}>
                {isSupabaseConfigured ? 'Connected' : 'Offline Mode'}
              </span>
            </h3>

            <p className="text-xs text-slate-400 mb-4 leading-relaxed">
              Target Project: <span className="font-mono text-[11px] text-[#00e5ff]">pqeqlayphewbrktaxsqc</span>
            </p>

            <div className="space-y-2.5">
              <button
                type="button"
                onClick={handleSyncToSupabase}
                disabled={isSyncingCloud}
                className="w-full p-3 bg-gradient-to-r from-[#00b4d8]/20 to-[#0077b6]/20 hover:from-[#00b4d8]/30 hover:to-[#0077b6]/30 border border-[#00d2ff]/40 rounded-xl text-left flex items-center justify-between cursor-pointer transition-all disabled:opacity-60"
              >
                <div className="flex items-center gap-2.5">
                  <UploadCloud size={17} className="text-[#00e5ff]" />
                  <div>
                    <div className="text-xs font-bold text-slate-900 dark:text-white">
                      {isSyncingCloud ? 'Syncing to Supabase...' : 'Sync Local Data to Supabase'}
                    </div>
                    <div className="text-[9px] text-slate-400">Push all products, sales & records to cloud</div>
                  </div>
                </div>
                <span className="text-[10px] font-bold text-[#00e5ff] uppercase px-2 py-0.5 bg-[#050b14] rounded-md border border-[#00d2ff]/20">
                  {isSyncingCloud ? 'Syncing...' : 'Sync Now'}
                </span>
              </button>

              <button
                type="button"
                onClick={handleTestConnection}
                disabled={isTestingConn}
                className="w-full p-2.5 bg-slate-50 dark:bg-[#0a1527] hover:border-[#00e5ff]/50 border border-slate-200 dark:border-[#162744] rounded-xl text-left flex items-center justify-between cursor-pointer transition-all text-xs disabled:opacity-60"
              >
                <div className="flex items-center gap-2">
                  <Activity size={15} className="text-[#00e5ff]" />
                  <span className="text-slate-600 dark:text-slate-300 font-semibold text-xs">
                    {isTestingConn ? 'Checking Supabase...' : 'Test Connection & Schema'}
                  </span>
                </div>
                <span className="text-[10px] font-bold text-[#00e5ff] flex items-center gap-1 hover:text-white">
                  Run Diagnostic
                </span>
              </button>

              <button
                type="button"
                onClick={handleCopySchemaSql}
                className="w-full p-2.5 bg-slate-50 dark:bg-[#0a1527] hover:border-[#00e5ff]/50 border border-slate-200 dark:border-[#162744] rounded-xl text-left flex items-center justify-between cursor-pointer transition-all text-xs"
              >
                <div className="flex items-center gap-2">
                  <Database size={15} className="text-slate-400" />
                  <span className="text-slate-600 dark:text-slate-300 font-semibold text-xs">Copy Full <code className="font-mono text-[10px] text-[#00e5ff]">setup_schema.sql</code></span>
                </div>
                <span className="text-[10px] font-bold text-slate-400 flex items-center gap-1 hover:text-white">
                  <Copy size={12} /> Copy SQL
                </span>
              </button>

              <button
                type="button"
                onClick={() => {
                  setActiveAdminTab('sync-logs');
                  window.scrollTo({ top: 0, behavior: 'smooth' });
                }}
                className="w-full p-2.5 bg-[#00e5ff]/10 hover:bg-[#00e5ff]/20 text-[#00e5ff] border border-[#00e5ff]/30 rounded-xl text-left flex items-center justify-between cursor-pointer transition-all text-xs font-bold"
              >
                <div className="flex items-center gap-2">
                  <Activity size={15} />
                  <span>View Sync Logs & Diagnostics (সিঙ্ক লগ দেখুন)</span>
                </div>
                <span>→</span>
              </button>
            </div>
          </div>

          {/* Backup & Restore Card */}
          <div className="bg-white dark:bg-[#070e1b] p-6 rounded-3xl border border-slate-200 dark:border-[#162744] shadow-sm">
            <h3 className="text-base font-bold text-slate-900 dark:text-white mb-4 flex items-center gap-2">
              <HardDrive size={17} className="text-[#00e5ff]" />
              Store Backup & Reset
            </h3>

            <div className="space-y-2.5">
              <button 
                type="button"
                onClick={() => (window as any).exportData()}
                className="w-full p-3 bg-slate-50 dark:bg-[#0a1527] hover:border-[#00e5ff]/50 border border-slate-200 dark:border-[#162744] rounded-xl text-left flex items-center justify-between cursor-pointer transition-all"
              >
                <div className="flex items-center gap-2.5">
                  <HardDrive size={16} className="text-[#00e5ff]" />
                  <div>
                    <div className="text-xs font-bold text-slate-900 dark:text-white">Export Store Data</div>
                    <div className="text-[9px] text-slate-400">Save JSON backup file</div>
                  </div>
                </div>
                <span className="text-[10px] font-bold text-[#00e5ff] uppercase px-2 py-0.5 bg-[#050b14] rounded-md border border-[#00d2ff]/20">Backup</span>
              </button>

              <label className="w-full p-3 bg-slate-50 dark:bg-[#0a1527] hover:border-emerald-500/50 border border-slate-200 dark:border-[#162744] rounded-xl text-left flex items-center justify-between cursor-pointer transition-all block">
                <input 
                  type="file" 
                  className="hidden" 
                  accept=".json" 
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) {
                      const reader = new FileReader();
                      reader.onload = (event) => {
                        const content = event.target?.result as string;
                        (window as any).importData(content);
                      };
                      reader.readAsText(file);
                    }
                  }} 
                />
                <div className="flex items-center gap-2.5">
                  <RefreshCw size={16} className="text-emerald-400" />
                  <div>
                    <div className="text-xs font-bold text-slate-900 dark:text-white">Restore Store Data</div>
                    <div className="text-[9px] text-slate-400">Load from JSON backup</div>
                  </div>
                </div>
                <span className="text-[10px] font-bold text-emerald-400 uppercase px-2 py-0.5 bg-[#050b14] rounded-md border border-emerald-500/20">Import</span>
              </label>

              <button 
                onClick={onReset}
                className="w-full mt-2 bg-amber-500/10 hover:bg-amber-500/20 text-amber-400 font-bold py-2.5 rounded-xl border border-amber-500/20 transition-all flex items-center justify-center gap-2 cursor-pointer text-xs"
              >
                <Trash2 size={15} />
                Reset Store Data (This Account Only)
              </button>
            </div>
          </div>

        </div>
      </div>

      {/* Usage Summary Metric Badges */}
      <div className="bg-white dark:bg-[#070e1b] p-6 sm:p-8 rounded-3xl border border-slate-200 dark:border-[#162744] shadow-sm">
        <h3 className="text-base font-bold text-slate-900 dark:text-white mb-4 flex items-center gap-2">
          <Shield size={17} className="text-[#00e5ff]" />
          Active Account Database Usage
        </h3>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3.5">
          <div className="p-4 bg-slate-50 dark:bg-[#0a1527] rounded-2xl border border-slate-200 dark:border-[#162744] text-center">
            <div className="text-2xl font-black text-slate-900 dark:text-white mb-0.5">{stats.products}</div>
            <div className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">Products</div>
          </div>
          <div className="p-4 bg-slate-50 dark:bg-[#0a1527] rounded-2xl border border-slate-200 dark:border-[#162744] text-center">
            <div className="text-2xl font-black text-slate-900 dark:text-white mb-0.5">{stats.sales}</div>
            <div className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">Sales</div>
          </div>
          <div className="p-4 bg-slate-50 dark:bg-[#0a1527] rounded-2xl border border-slate-200 dark:border-[#162744] text-center">
            <div className="text-2xl font-black text-slate-900 dark:text-white mb-0.5">{stats.expenses}</div>
            <div className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">Expenses</div>
          </div>
          <div className="p-4 bg-slate-50 dark:bg-[#0a1527] rounded-2xl border border-slate-200 dark:border-[#162744] text-center">
            <div className="text-2xl font-black text-[#00e5ff] mb-0.5">
              {stats.storageSize > 1024 ? (stats.storageSize / 1024).toFixed(2) + 'MB' : stats.storageSize + 'KB'}
            </div>
            <div className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">Isolated Storage</div>
          </div>
        </div>
      </div>
      </>
      )}

    </div>
  );
};

export default ManagerView;
