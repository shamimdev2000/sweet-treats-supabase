
import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { toast } from 'sonner';
import { Product, Sale, Expense, View, Staff, Attendance, DailyClosing, Deduction, Wastage, MonthlyClosing, Production, DailyNote, UserProfile } from './types';
import { generateId } from './services/idGenerator';
import Dashboard from './components/Dashboard';
import Inventory from './components/Inventory';
import SalesView from './components/SalesView';
import ExpensesView from './components/ExpensesView';
import StaffView from './components/StaffView';
import ManagerView from './components/ManagerView';
import DailyClosingView from './components/DailyClosingView';
import MonthlyClosingView from './components/MonthlyClosingView';
import DuesView from './components/DuesView';
import WastageView from './components/WastageView';
import ProductionView from './components/ProductionView';
import DailyNotesView from './components/DailyNotesView';
import Login from './components/Login';
import { OfflineIndicator, NetworkStatusBadge } from './components/OfflineIndicator';
import { PWAInstallButton } from './components/PWAInstallButton';
import { storageService } from './services/storageService';
import { supabase, isSupabaseConfigured } from './services/supabaseClient';
import { 
  LayoutDashboard, 
  Package, 
  ShoppingCart, 
  ReceiptIndianRupee, 
  Users,
  UserCheck,
  Moon,
  Sun,
  UtensilsCrossed,
  Lock,
  Wallet,
  Menu,
  X,
  Trash2,
  RefreshCw,
  LogOut,
  HardDrive,
  Check,
  AlertCircle,
  Calendar,
  StickyNote,
  Shield,
  ChevronDown
} from 'lucide-react';

const App: React.FC = () => {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [userEmail, setUserEmail] = useState('');
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [currentView, setCurrentView] = useState<View>(View.SALES);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isManagerAuthenticated, setIsManagerAuthenticated] = useState(false);
  const [managerPassword, setManagerPassword] = useState('');
  const [showLockModal, setShowLockModal] = useState(false);
  const [lockInput, setLockInput] = useState('');
  const [lockError, setLockError] = useState(false);
  const [pendingView, setPendingView] = useState<View | null>(null);
  const [pendingAction, setPendingAction] = useState<(() => void) | null>(null);

  // 2-Minute Inactivity Auto-Lock for Admin
  useEffect(() => {
    if (!isManagerAuthenticated) return;

    let timeoutId: NodeJS.Timeout;

    const resetTimer = () => {
      if (timeoutId) clearTimeout(timeoutId);
      // 2 minutes = 120,000 milliseconds
      timeoutId = setTimeout(() => {
        setIsManagerAuthenticated(false);
        setIsAdminPanelOpen(false);
        setCurrentView(View.SALES);
        toast.error('Session timed out. Admin panel locked.');
      }, 120000);
    };

    const events = ['mousedown', 'mousemove', 'keypress', 'scroll', 'touchstart'];
    events.forEach(event => {
      window.addEventListener(event, resetTimer);
    });

    resetTimer();

    return () => {
      if (timeoutId) clearTimeout(timeoutId);
      events.forEach(event => {
        window.removeEventListener(event, resetTimer);
      });
    };
  }, [isManagerAuthenticated]);
  
  const [theme, setTheme] = useState<'dark' | 'light'>(() => {
    try {
      const saved = localStorage.getItem('sweetBakery_theme');
      return (saved as 'dark' | 'light') || 'dark';
    } catch {
      return 'dark';
    }
  });

  // Sync theme with document.documentElement and localStorage
  useEffect(() => {
    try {
      localStorage.setItem('sweetBakery_theme', theme);
    } catch (e) {
      console.warn('Failed to save theme in localStorage:', e);
    }
    const root = document.documentElement;
    if (theme === 'dark') {
      root.classList.add('dark');
      root.classList.remove('light');
    } else {
      root.classList.remove('dark');
      root.classList.add('light');
    }
  }, [theme]);

  const [isSyncing, setIsSyncing] = useState(false);
  const [syncStatus, setSyncStatus] = useState<'saving' | 'saved' | 'error' | null>(null);
  const [isDataLoaded, setIsDataLoaded] = useState(false);
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [isStandalone, setIsStandalone] = useState(false);
  const [isAdminPanelOpen, setIsAdminPanelOpen] = useState(false);

  useEffect(() => {
    let unsubscribeAuth: (() => void) | undefined;

    if (isSupabaseConfigured && supabase) {
      // Check active Supabase Auth session
      supabase.auth.getSession().then(async ({ data: { session } }) => {
        if (session?.user?.email) {
          const cleanEmail = session.user.email.toLowerCase();
          setUserEmail(cleanEmail);
          const remoteProf = await storageService.fetchRemoteProfile(session.user.id);
          const prof = remoteProf || storageService.getProfileByEmail(cleanEmail);
          setUserProfile(prof);
          const pin = prof?.managerPin || storageService.getManagerPin(cleanEmail);
          setManagerPassword(pin);
          setIsAuthenticated(true);
          setCurrentView(View.SALES);
        }
        setIsDataLoaded(true);
      });

      const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
        if (event === 'SIGNED_IN' && session?.user?.email) {
          const cleanEmail = session.user.email.toLowerCase();
          setUserEmail(cleanEmail);
          const remoteProf = await storageService.fetchRemoteProfile(session.user.id);
          const prof = remoteProf || storageService.getProfileByEmail(cleanEmail);
          setUserProfile(prof);
          const pin = prof?.managerPin || storageService.getManagerPin(cleanEmail);
          setManagerPassword(pin);
          setIsAuthenticated(true);
        } else if (event === 'SIGNED_OUT') {
          setIsAuthenticated(false);
          setUserEmail('');
          setUserProfile(null);
        }
      });
      unsubscribeAuth = () => subscription.unsubscribe();
    } else {
      const savedEmail = localStorage.getItem('sweetBakery_email');
      if (savedEmail) {
        const cleanEmail = savedEmail.toLowerCase();
        setUserEmail(cleanEmail);
        const prof = storageService.getProfileByEmail(cleanEmail);
        setUserProfile(prof);
        const pin = storageService.getManagerPin(cleanEmail);
        setManagerPassword(pin);
        setIsAuthenticated(true);
        setCurrentView(View.SALES);
      }
      setIsDataLoaded(true);
    }

    return () => {
      if (unsubscribeAuth) unsubscribeAuth();
    };
  }, []);

  useEffect(() => {
    // Check if app is running in standalone mode
    if (window.matchMedia('(display-mode: standalone)').matches || (window.navigator as any).standalone) {
      setIsStandalone(true);
    }

    const handleBeforeInstallPrompt = (e: any) => {
      e.preventDefault();
      setDeferredPrompt(e);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    return () => window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
  }, []);

  const handleInstallApp = async () => {
    if (!deferredPrompt) return;
    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === 'accepted') {
      setDeferredPrompt(null);
    }
  };

  const [confirmModal, setConfirmModal] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    onConfirm: () => void;
    confirmText?: string;
    type?: 'danger' | 'warning' | 'info';
  }>({
    isOpen: false,
    title: '',
    message: '',
    onConfirm: () => {},
  });

  const [products, setProducts] = useState<Product[]>([]);
  const [sales, setSales] = useState<Sale[]>([]);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [wastage, setWastage] = useState<Wastage[]>([]);
  const [staff, setStaff] = useState<Staff[]>([]);
  const [attendance, setAttendance] = useState<Attendance[]>([]);
  const [dailyClosings, setDailyClosings] = useState<DailyClosing[]>([]);
  const [monthlyClosings, setMonthlyClosings] = useState<MonthlyClosing[]>([]);
  const [deductions, setDeductions] = useState<Deduction[]>([]);
  const [production, setProduction] = useState<Production[]>([]);
  const [notes, setNotes] = useState<DailyNote[]>([]);

  useEffect(() => {
    if (theme === 'dark') document.documentElement.classList.add('dark');
    else document.documentElement.classList.remove('dark');
    localStorage.setItem('sweetBakery_theme', theme);
  }, [theme]);

  useEffect(() => {
    // Initial loading state handled by onAuthStateChanged
    // Old localStorage auth removed to prevent conflicts
  }, []);

  const fetchData = useCallback(async (email: string) => {
    if (!email) {
      setIsDataLoaded(true);
      return;
    }

    setIsSyncing(true);
    const safeFetch = async <T,>(tableName: string, fetchFn: () => Promise<T[]>) => {
      try {
        const data = await fetchFn();
        return data || [];
      } catch (err: any) {
        console.error(`Error fetching ${tableName}:`, err);
        return [] as T[];
      }
    };

    try {
      const results = await Promise.allSettled([
        safeFetch('products', () => storageService.getProducts(email)),
        safeFetch('sales', () => storageService.getSales(email)),
        safeFetch('expenses', () => storageService.getExpenses(email)),
        safeFetch('wastage', () => storageService.getWastage(email)),
        safeFetch('staff', () => storageService.getStaff(email)),
        safeFetch('attendance', () => storageService.getAttendance(email)),
        safeFetch('daily_closings', () => storageService.getClosings(email)),
        safeFetch('monthly_closings', () => storageService.getMonthlyClosings(email)),
        safeFetch('deductions', () => storageService.getDeductions(email)),
        safeFetch('production', () => storageService.getProduction(email)),
        safeFetch('notes', () => storageService.getNotes(email))
      ]);

      const getData = (index: number) => {
        const res = results[index];
        return res.status === 'fulfilled' ? res.value : [];
      };

      setProducts(getData(0));
      setSales(getData(1));
      setExpenses(getData(2));
      setWastage(getData(3));
      setStaff(getData(4));
      setAttendance(getData(5));
      setDailyClosings(getData(6));
      setMonthlyClosings(getData(7));
      setDeductions(getData(8));
      setProduction(getData(9));
      setNotes(getData(10));
    } catch (err: any) {
      console.error("Critical fetch error:", err);
    } finally {
      setIsDataLoaded(true);
      setIsSyncing(false);
    }
  }, []);

  useEffect(() => {
    if (isAuthenticated && userEmail) {
      fetchData(userEmail);
    }
  }, [isAuthenticated, userEmail, fetchData]);

  const handleLogin = (email: string) => {
    const normalizedEmail = email.toLowerCase().trim();
    setUserEmail(normalizedEmail);
    const prof = storageService.getProfileByEmail(normalizedEmail);
    setUserProfile(prof);
    const pin = storageService.getManagerPin(normalizedEmail);
    setManagerPassword(pin);
    setIsAuthenticated(true);
    setCurrentView(View.SALES);
    localStorage.setItem('sweetBakery_email', normalizedEmail);
  };

  const handleUpdateProfile = async (updates: Partial<UserProfile>) => {
    const updated = await storageService.updateProfile(userEmail, updates);
    if (updated) {
      setUserProfile(updated);
      if (updates.managerPin) {
        setManagerPassword(updates.managerPin);
      }
    }
  };

  const handleLogout = useCallback(async () => {
    console.log('Logging out...');
    localStorage.removeItem('sweetBakery_email');
    
    if (isSupabaseConfigured && supabase) {
      try {
        await supabase.auth.signOut();
      } catch (err) {
        console.error("Supabase signOut error:", err);
      }
    }

    setIsAuthenticated(false);
    setUserEmail('');
    setIsMobileMenuOpen(false);
    
    setTimeout(() => {
      window.location.href = window.location.origin;
    }, 100);
  }, []);

  const withSync = async (fn: () => Promise<void>) => {
    setIsSyncing(true);
    setSyncStatus('saving');
    try {
      await fn();
      setSyncStatus('saved');
      setTimeout(() => setSyncStatus(null), 2000);
    } catch (e: any) {
      console.error("Storage error:", e);
      setSyncStatus('error');
      toast.error(`Database persistence error: ${e.message || 'Failed to sync with Supabase'}`, { duration: 5000 });
      setTimeout(() => setSyncStatus(null), 4000);
    } finally {
      setIsSyncing(false);
    }
  };

  const addSale = (newSale: Sale) => {
    console.log("Processing sale:", newSale);
    setSales(prev => [...prev, newSale]);
    
    let updatedProducts: Product[] = [];
    setProducts(prevProducts => {
      updatedProducts = prevProducts.map(p => {
        const saleItem = newSale.items.find(item => item.productId === p.id);
        if (saleItem) {
          console.log(`Updating product ${p.name}: oldStock=${p.stock}, quantity=${saleItem.quantity}, newStock=${p.stock - saleItem.quantity}`);
          return { ...p, stock: p.stock - saleItem.quantity };
        }
        return p;
      });
      return updatedProducts;
    });
    
    withSync(async () => {
      await storageService.addSale(userEmail, newSale);
      for (const item of newSale.items) {
        const product = updatedProducts.find(p => p.id === item.productId);
        if (product) await storageService.upsertProduct(userEmail, product);
      }
    });
  };

  const cancelSale = (saleId: string) => {
    setConfirmModal({
      isOpen: true,
      title: "Cancel Sale?",
      message: "Do you want to cancel this sale? This will restore stock.",
      confirmText: "Cancel Sale",
      type: 'danger',
      onConfirm: () => {
        const sale = sales.find(s => s.id === saleId);
        if (!sale) return;

        withSync(async () => {
          await storageService.deleteSale(userEmail, saleId);
          setSales(prev => prev.filter(s => s.id !== saleId));
          const refreshedProducts = await storageService.getProducts(userEmail);
          setProducts(refreshedProducts);
        });
        setConfirmModal(prev => ({ ...prev, isOpen: false }));
      }
    });
  };

  const addProduct = (product: Product, productionQty?: number) => {
    setProducts(prev => {
      const existing = prev.find(p => p.id === product.id);
      if (existing) return prev.map(p => p.id === product.id ? product : p);
      return [product, ...prev];
    });
    
    if (productionQty && productionQty > 0) {
      const newProduction: Production = {
        id: generateId('prod_rec'),
        productId: product.id,
        productName: product.name,
        quantity: productionQty,
        unit: product.unit,
        unitPrice: product.price,
        totalValue: product.price * productionQty,
        date: new Date().toISOString()
      };
      setProduction(prev => [...prev, newProduction]);
      withSync(async () => {
        await storageService.upsertProduct(userEmail, product);
        await storageService.addProduction(userEmail, newProduction);
      });
    } else {
      withSync(async () => {
        await storageService.upsertProduct(userEmail, product);
      });
    }
  };

  const deleteProduct = (id: string) => {
    const targetProduct = products.find(p => p.id === id);
    const prodName = targetProduct?.name || 'this product';
    setConfirmModal({
      isOpen: true,
      title: "Delete Product Permanently?",
      message: `Are you sure you want to permanently delete "${prodName}" from inventory? This action cannot be undone and will delete it from database and local storage.`,
      confirmText: "Delete Permanently",
      type: 'danger',
      onConfirm: () => {
        setProducts(prev => prev.filter(p => p.id !== id));
        withSync(async () => {
          await storageService.deleteProduct(userEmail, id);
        });
        toast.success(`"${prodName}" has been permanently deleted.`);
        setConfirmModal(prev => ({ ...prev, isOpen: false }));
      }
    });
  };

  const addExpense = (expense: Expense) => {
    setExpenses(prev => [...prev, expense]);
    withSync(async () => {
      await storageService.addExpense(userEmail, expense);
    });
  };

  const markWastage = (w: Wastage) => {
    setWastage(prev => [...prev, w]);
    let updatedProducts: Product[] = [];
    setProducts(prev => {
      updatedProducts = prev.map(p => p.id === w.productId ? { ...p, stock: p.stock - w.quantity } : p);
      return updatedProducts;
    });
    
    withSync(async () => {
      await storageService.addWastage(userEmail, w);
      const product = updatedProducts.find(p => p.id === w.productId);
      if (product) await storageService.upsertProduct(userEmail, product);
    });
  };

  const deleteWastage = (id: string) => {
    setConfirmModal({
      isOpen: true,
      title: "Delete Wastage Record?",
      message: "Do you want to delete this wastage record?",
      confirmText: "Delete",
      type: 'danger',
      onConfirm: () => {
        const record = wastage.find(w => w.id === id);
        setWastage(prev => prev.filter(w => w.id !== id));
        if (record) {
          const updatedProducts = products.map(p => p.id === record.productId ? { ...p, stock: p.stock + record.quantity } : p);
          setProducts(updatedProducts);
          withSync(async () => {
            await storageService.deleteWastage(userEmail, id);
            const product = updatedProducts.find(p => p.id === record.productId);
            if (product) await storageService.upsertProduct(userEmail, product);
          });
        } else {
          withSync(async () => await storageService.deleteWastage(userEmail, id));
        }
        setConfirmModal(prev => ({ ...prev, isOpen: false }));
      }
    });
  };

  const addStaff = (s: Staff) => {
    setStaff(prev => [...prev, s]);
    withSync(async () => {
      await storageService.addStaff(userEmail, s);
    });
  };

  const updateAttendance = (a: Attendance) => {
    setAttendance(prev => {
      const existingIdx = prev.findIndex(item => item.staffId === a.staffId && item.date === a.date);
      if (existingIdx > -1) {
        const newArr = [...prev];
        newArr[existingIdx] = a;
        return newArr;
      }
      return [...prev, a];
    });
    withSync(async () => {
      await storageService.upsertAttendance(userEmail, a);
    });
  };

  const addDeduction = (d: Deduction) => {
    setDeductions(prev => [...prev, d]);
    withSync(async () => {
      await storageService.addDeduction(userEmail, d);
    });
  };

  const paySalary = (staffId: string, amount: number) => {
    const staffMember = staff.find(s => s.id === staffId);
    if (!staffMember) return;
    const currentMonth = new Date().toLocaleString('default', { month: 'long' });
    const currentYear = new Date().getFullYear();
    const salaryExpense: Expense = {
      id: generateId('sal_exp'),
      description: `Salary Payment: ${staffMember.name} (${currentMonth} ${currentYear})`,
      amount: amount,
      category: 'Salary',
      date: new Date().toISOString()
    };
    addExpense(salaryExpense);
  };

  const closeDay = (closing: DailyClosing) => {
    setDailyClosings(prev => [...prev, closing]);
    withSync(async () => {
      await storageService.addClosing(userEmail, closing);
    });
  };

  const deleteClosing = (id: string) => {
    setConfirmModal({
      isOpen: true,
      title: "Delete Closing Record?",
      message: "Do you want to delete this closing record?",
      confirmText: "Delete",
      type: 'danger',
      onConfirm: () => {
        setDailyClosings(prev => prev.filter(c => c.id !== id));
        withSync(async () => {
          await storageService.deleteClosing(userEmail, id);
        });
        setConfirmModal(prev => ({ ...prev, isOpen: false }));
      }
    });
  };

  const updateClosing = (updated: DailyClosing) => {
    setDailyClosings(prev => prev.map(c => c.id === updated.id ? updated : c));
    withSync(async () => {
      await storageService.updateClosing(userEmail, updated);
    });
  };

  const addMonthlyClosing = (closing: MonthlyClosing) => {
    setMonthlyClosings(prev => [...prev, closing]);
    withSync(async () => {
      await storageService.addMonthlyClosing(userEmail, closing);
    });
  };

  const deleteMonthlyClosing = (id: string) => {
    setConfirmModal({
      isOpen: true,
      title: "Delete Monthly Record?",
      message: "Do you want to delete this monthly closing record?",
      confirmText: "Delete",
      type: 'danger',
      onConfirm: () => {
        setMonthlyClosings(prev => prev.filter(c => c.id !== id));
        withSync(async () => {
          await storageService.deleteMonthlyClosing(userEmail, id);
        });
        setConfirmModal(prev => ({ ...prev, isOpen: false }));
      }
    });
  };

  const deleteProduction = (id: string) => {
    setConfirmModal({
      isOpen: true,
      title: "Delete Production Record?",
      message: "Do you want to delete this production record?",
      confirmText: "Delete",
      type: 'danger',
      onConfirm: () => {
        setProduction(prev => prev.filter(p => p.id !== id));
        withSync(async () => {
          await storageService.deleteProduction(userEmail, id);
        });
        setConfirmModal(prev => ({ ...prev, isOpen: false }));
      }
    });
  };

  const addNote = (note: DailyNote) => {
    setNotes(prev => [note, ...prev]);
    withSync(async () => {
      await storageService.addNote(userEmail, note);
    });
  };

  const updateNote = (updatedNote: DailyNote) => {
    setNotes(prev => prev.map(n => n.id === updatedNote.id ? updatedNote : n));
    withSync(async () => {
      await storageService.updateNote(userEmail, updatedNote);
    });
  };

  const deleteNote = (id: string) => {
    setConfirmModal({
      isOpen: true,
      title: "Delete Note?",
      message: "Do you want to delete this note?",
      confirmText: "Delete",
      type: 'danger',
      onConfirm: () => {
        setNotes(prev => prev.filter(n => n.id !== id));
        withSync(async () => {
          await storageService.deleteNote(userEmail, id);
        });
        setConfirmModal(prev => ({ ...prev, isOpen: false }));
      }
    });
  };

  const handleReset = () => {
    setConfirmModal({
      isOpen: true,
      title: "Reset Database Storage?",
      message: "Do you want to delete all data? This will delete all records (except user profile).",
      confirmText: "Reset All Data",
      type: 'danger',
      onConfirm: async () => {
        try {
          await storageService.clearAllDataForUser(userEmail);
        } catch (err) {
          console.error("Failed to clear DB during reset:", err);
        }
        const profiles = localStorage.getItem('sweetBakery_profiles');
        localStorage.clear();
        if (profiles) {
          localStorage.setItem('sweetBakery_profiles', profiles);
        }
        window.location.reload();
      }
    });
  };

  const updateBulkSales = (updatedSales: Sale[]) => {
    const updatedSalesMap = new Map(updatedSales.map(s => [s.id, s]));
    setSales(prev => prev.map(s => updatedSalesMap.get(s.id) || s));
    withSync(async () => {
      for (const sale of updatedSales) {
        await storageService.updateSale(userEmail, sale);
      }
    });
  };

  const lowStockCount = useMemo(() => products.filter(p => p.unit === 'kg' ? p.stock <= 1 : p.stock < 10).length, [products]);
  const urgentNotesCount = useMemo(() => notes.filter(n => n.priority === 'urgent' && n.status !== 'completed').length, [notes]);

  const storageSize = useMemo(() => {
    try {
      const activeDataPayload = {
        products,
        sales,
        expenses,
        wastage,
        staff,
        attendance,
        dailyClosings,
        monthlyClosings,
        deductions,
        production,
        notes
      };
      const stringifiedData = JSON.stringify(activeDataPayload);
      const calculatedBytes = stringifiedData.length * 2;
      return (calculatedBytes / 1024).toFixed(2); // In-memory size approximation of IndexedDB payload in KB
    } catch (e) {
      return "0.00";
    }
  }, [products, sales, expenses, wastage, staff, attendance, dailyClosings, monthlyClosings, deductions, production, notes]);

  const handleViewChange = (view: View) => {
    const adminViews = [View.DASHBOARD, View.INVENTORY, View.PRODUCTION, View.WASTAGE, View.EXPENSES, View.STAFF, View.DAILY_CLOSING, View.MONTHLY_CLOSING, View.MANAGER];
    if (adminViews.includes(view) && !isManagerAuthenticated) {
      setPendingView(view);
      setShowLockModal(true);
      setLockInput('');
      setLockError(false);
    } else {
      setCurrentView(view);
    }
    setIsMobileMenuOpen(false);
  };

  const handleLockAdmin = (showToast = true) => {
    setIsManagerAuthenticated(false);
    setIsAdminPanelOpen(false);
    setCurrentView(View.SALES);
    setIsMobileMenuOpen(false);
    if (showToast) {
      toast.success('Admin panel locked. Switched to Sales (POS).');
    }
  };

  const handleUnlock = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (lockInput === managerPassword) {
      setIsManagerAuthenticated(true);
      if (pendingView) setCurrentView(pendingView);
      if (pendingAction) pendingAction();
      setShowLockModal(false);
      setPendingView(null);
      setPendingAction(null);
      setLockInput('');
    } else {
      setLockError(true);
      setTimeout(() => setLockError(false), 2000);
    }
  };

  const updateManagerPassword = (newPass: string) => {
    setManagerPassword(newPass);
    if (userEmail) {
      storageService.setManagerPin(userEmail, newPass);
    } else {
      localStorage.setItem('sweetBakery_managerPass', newPass);
    }
  };

  const handleExportData = useCallback(async () => {
    const jsonData = await storageService.exportAllData(userEmail);
    const blob = new Blob([jsonData], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `sweet_treats_backup_${new Date().toISOString().split('T')[0]}.json`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }, [userEmail]);

  const handleImportData = useCallback(async (jsonData: string) => {
    setConfirmModal({
      isOpen: true,
      title: "Import Data?",
      message: "Do you want to restore data from backup? This will overwrite all current data.",
      confirmText: "Restore Data",
      type: 'warning',
      onConfirm: async () => {
        const success = await storageService.importAllData(userEmail, jsonData);
        if (success) {
          window.location.reload();
        } else {
          alert("Error restoring data. Please select a valid backup file.");
        }
      }
    });
  }, [userEmail]);

  useEffect(() => {
    (window as any).navigateToView = (view: View) => handleViewChange(view);
    (window as any).exportData = handleExportData;
    (window as any).importData = handleImportData;
  }, [handleExportData, handleImportData]);

  const topNavItems = [
    { id: View.SALES, label: 'Sales (POS)', icon: <ShoppingCart size={20} /> },
    { id: View.DUES, label: 'Dues', icon: <Wallet size={20} /> },
    { id: View.NOTES, label: 'Daily Notes', icon: <StickyNote size={20} />, notification: urgentNotesCount },
  ];

  const adminNavItems = [
    { id: View.DASHBOARD, label: 'Dashboard', icon: <LayoutDashboard size={19} /> },
    { id: View.INVENTORY, label: 'Inventory', icon: <Package size={19} />, notification: lowStockCount },
    { id: View.PRODUCTION, label: 'Production', icon: <RefreshCw size={19} /> },
    { id: View.WASTAGE, label: 'Wastage', icon: <Trash2 size={19} /> },
    { id: View.EXPENSES, label: 'Expenses', icon: <ReceiptIndianRupee size={19} /> },
    { id: View.STAFF, label: 'Staff & Salary', icon: <Users size={19} /> },
    { id: View.DAILY_CLOSING, label: 'Daily Closing', icon: <Lock size={19} /> },
    { id: View.MONTHLY_CLOSING, label: 'Monthly Closing', icon: <Calendar size={19} /> },
    { id: View.MANAGER, label: 'Manager Profile', icon: <UserCheck size={19} /> },
  ];

  // Close mobile menu on Escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setIsMobileMenuOpen(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  const isAdminViewActive = adminNavItems.some(item => item.id === currentView);
  const totalAdminNotification = adminNavItems.reduce((acc, item) => acc + (item.notification || 0), 0);

  // Auto-expand admin panel if an admin view is active and manager is authenticated
  useEffect(() => {
    if (isAdminViewActive && isManagerAuthenticated) {
      setIsAdminPanelOpen(true);
    }
  }, [currentView, isAdminViewActive, isManagerAuthenticated]);

  if (!isAuthenticated) return <Login onLogin={handleLogin} theme={theme} />;

  return (
    <div className={`min-h-screen flex bg-slate-50 dark:bg-dark-bg text-slate-900 dark:text-white transition-all ${isMobileMenuOpen || currentView === View.SALES ? 'overflow-hidden' : ''} ${currentView === View.SALES ? 'h-screen' : ''}`}>
      {isMobileMenuOpen && (
        <div 
          className="fixed inset-0 bg-slate-900/80 dark:bg-black/80 backdrop-blur-sm z-[80] transition-opacity duration-300 animate-in fade-in cursor-pointer" 
          onClick={() => setIsMobileMenuOpen(false)} 
        />
      )}
      
      {/* Sidebar: In Sales/POS view, sidebar is hidden by default and acts as an overlay drawer when MENU is clicked */}
      <aside className={`w-[280px] sm:w-72 max-w-[85vw] bg-white dark:bg-[#070d19] border-r border-slate-200 dark:border-[#162744] flex flex-col fixed inset-y-0 left-0 h-full z-[90] shadow-2xl lg:shadow-none transition-transform duration-300 ease-in-out overscroll-contain ${
        currentView === View.SALES
          ? (isMobileMenuOpen ? 'translate-x-0 shadow-[0_0_50px_rgba(0,0,0,0.85)]' : '-translate-x-full')
          : (isMobileMenuOpen ? 'translate-x-0 shadow-[0_0_50px_rgba(0,0,0,0.85)]' : '-translate-x-full lg:translate-x-0')
      }`}>
        <div className="p-4 sm:p-6 pb-4 flex items-center justify-between border-b border-slate-100 dark:border-[#162744]/60 shrink-0">
          <div className="flex items-center gap-2.5 sm:gap-3 min-w-0">
            <div className="w-10 h-10 sm:w-11 sm:h-11 bg-[#0a1527] border border-[#00d2ff]/40 rounded-2xl flex items-center justify-center shadow-[0_0_15px_rgba(0,210,255,0.3)] shrink-0">
              <UtensilsCrossed size={20} className="text-[#00e5ff]" />
            </div>
            <div className="min-w-0">
              <h1 className="text-sm sm:text-base font-black text-slate-900 dark:text-white truncate tracking-tight">
                {userProfile?.businessName || 'Sweet Bakery'}
              </h1>
            </div>
          </div>
          <button 
            onClick={() => setIsMobileMenuOpen(false)} 
            className={`${currentView === View.SALES ? '' : 'lg:hidden'} p-2 rounded-xl bg-slate-100 dark:bg-[#0e1a2f] border border-slate-200 dark:border-[#162744] text-slate-400 hover:text-white transition-colors cursor-pointer active:scale-95 shrink-0`}
            aria-label="Close sidebar"
          >
            <X size={20} />
          </button>
        </div>
        
        <nav className="flex-1 px-3 sm:px-4 mt-3 sm:mt-4 space-y-2 overflow-y-auto custom-scrollbar touch-pan-y">
          {/* Admin Panel Collapsible Section (Placed at the very top) */}
          <div className="pb-2">
            <button
              onClick={() => {
                if (!isManagerAuthenticated) {
                  setShowLockModal(true);
                  setLockInput('');
                  setLockError(false);
                  setPendingAction(() => () => setIsAdminPanelOpen(true));
                } else {
                  setIsAdminPanelOpen(!isAdminPanelOpen);
                }
              }}
              className={`w-full flex items-center justify-between px-4 py-3.5 rounded-2xl transition-all duration-200 cursor-pointer border ${
                isAdminViewActive && isManagerAuthenticated
                  ? 'bg-cyan-50 dark:bg-[#09172c] border-cyan-400 dark:border-[#00d2ff]/40 text-slate-900 dark:text-white shadow-sm dark:shadow-[0_0_15px_rgba(0,210,255,0.2)]'
                  : 'bg-slate-50 hover:bg-slate-100 dark:bg-[#060e1c] dark:hover:bg-[#0c1c33] border-slate-200 dark:border-[#162744] text-slate-700 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              <div className="flex items-center gap-3">
                <div className={`w-8 h-8 rounded-xl flex items-center justify-center ${
                  isAdminViewActive && isManagerAuthenticated ? 'bg-[#00e5ff] text-black shadow-[0_0_10px_#00e5ff]' : 'bg-slate-100 dark:bg-[#0c182b] text-[#00e5ff]'
                }`}>
                  <Shield size={18} />
                </div>
                <div className="text-left">
                  <div className="text-sm font-extrabold tracking-wide text-slate-900 dark:text-white">Admin Panel</div>
                  <div className="text-[10px] font-bold text-slate-500 dark:text-[#577b9f]">
                    {adminNavItems.length} Management Tools
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-2">
                {totalAdminNotification > 0 && isManagerAuthenticated && (
                  <span className="bg-red-500 text-white text-[10px] px-2 py-0.5 rounded-full font-black animate-pulse shadow-sm">
                    {totalAdminNotification}
                  </span>
                )}
                <div className={`p-1 rounded-lg text-slate-400 transition-transform duration-200 ${
                  isAdminPanelOpen && isManagerAuthenticated ? 'rotate-180 text-[#00e5ff]' : ''
                }`}>
                  <ChevronDown size={18} />
                </div>
              </div>
            </button>

            {/* Admin Panel Sub Items (Strictly hidden until authenticated and expanded) */}
            {isAdminPanelOpen && isManagerAuthenticated && (
              <div className="mt-2 ml-2 pl-3 border-l-2 border-slate-200 dark:border-[#162744] space-y-1 animate-in fade-in slide-in-from-top-2 duration-200">
                {adminNavItems.map((item) => {
                  const isActive = currentView === item.id;
                  return (
                    <button 
                      key={item.id} 
                      onClick={() => {
                        handleViewChange(item.id);
                        setIsMobileMenuOpen(false);
                      }} 
                      className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl transition-all duration-150 cursor-pointer ${
                        isActive 
                          ? 'smart-cyan-pill font-bold text-xs tracking-wide shadow-[0_0_12px_rgba(0,229,255,0.3)]' 
                          : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-[#0c1c33] font-medium text-xs border border-transparent'
                      }`}
                    >
                      <span className={isActive ? 'text-white' : 'text-[#00d2ff]'}>{item.icon}</span>
                      <div className="text-left flex-1 font-semibold">{item.label}</div>
                      {item.notification && item.notification > 0 ? (
                        <span className="bg-red-500 text-white text-[9px] px-1.5 py-0.5 rounded-full font-black shadow-sm">
                          {item.notification}
                        </span>
                      ) : null}
                    </button>
                  );
                })}

                <button
                  onClick={() => handleLockAdmin()}
                  className="w-full mt-3 flex items-center justify-center gap-2 py-3 px-4 rounded-xl bg-red-500/10 hover:bg-red-500/20 border border-red-500/30 text-red-600 dark:text-red-400 font-bold text-xs uppercase tracking-wider transition-all shadow-sm active:scale-95 cursor-pointer"
                >
                  <Lock size={16} />
                  <span>Lock Admin Panel</span>
                </button>
              </div>
            )}
          </div>

          {/* Top Primary Items: Sales (POS), Dues, Daily Notes */}
          <div className="space-y-1.5 pt-2 border-t border-slate-200 dark:border-[#162744]/60">
            {topNavItems.map((item) => {
              const isActive = currentView === item.id;
              return (
                <button 
                  key={item.id} 
                  onClick={() => {
                    handleViewChange(item.id);
                    setIsMobileMenuOpen(false);
                  }} 
                  className={`w-full flex items-center gap-3.5 px-4 py-3 rounded-full transition-all duration-200 cursor-pointer ${
                    isActive 
                      ? 'smart-cyan-pill font-bold tracking-wide' 
                      : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-[#0e1b32] font-semibold border border-transparent'
                  }`}
                >
                  <span className={isActive ? 'text-white' : 'text-[#00d2ff]'}>{item.icon}</span>
                  <div className="text-left flex-1 text-[15px]">{item.label}</div>
                  {item.notification && item.notification > 0 ? (
                    <span className="bg-red-500 text-white text-[10px] px-2 py-0.5 rounded-full font-black shadow-sm">
                      {item.notification}
                    </span>
                  ) : null}
                </button>
              );
            })}
          </div>
          
          <button 
            onClick={handleLogout}
            className="w-full mt-4 flex items-center gap-3.5 px-4 py-3.5 rounded-full text-red-400 hover:bg-red-500/10 border border-transparent hover:border-red-500/30 transition-all active:scale-95 group cursor-pointer"
          >
            <LogOut size={20} className="group-hover:translate-x-1 transition-transform" />
            <div className="text-left flex-1 font-bold text-sm">
              Logout
            </div>
          </button>
        </nav>
        
        <div className="p-4 space-y-3">
          {!isStandalone && deferredPrompt && (
            <button 
              onClick={handleInstallApp}
              className="w-full flex items-center justify-center gap-2.5 px-4 py-3.5 smart-cyan-pill uppercase tracking-widest text-[11px]"
            >
              <HardDrive size={16} />
              Install Mobile App
            </button>
          )}
          
          <div className="p-3.5 bg-slate-50 dark:bg-[#0a1424] rounded-2xl border border-slate-200 dark:border-[#162744] space-y-2.5">
            <div className="flex items-center justify-between">
              <div className="text-[10px] font-black uppercase text-[#00e5ff]">App Status</div>
              <NetworkStatusBadge compact />
            </div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-black text-slate-900 dark:text-white">v3.4.0</span>
              <span className={`w-1.5 h-1.5 rounded-full ${isStandalone ? 'bg-emerald-400' : 'bg-cyan-400 shadow-[0_0_6px_#00e5ff]'}`}></span>
              <span className={`text-[10px] font-bold uppercase ${isStandalone ? 'text-emerald-400' : 'text-cyan-400'}`}>
                {isStandalone ? 'Offline PWA Active' : 'Smart POS'}
              </span>
            </div>
            <PWAInstallButton variant="sidebar" />
            <p className="text-[9px] text-slate-500 font-bold mt-1">User: <span className="capitalize text-slate-600 dark:text-slate-400">{userEmail.split('@')[0]}</span></p>
            <div className="flex items-center justify-between pt-2 mt-2 border-t border-slate-200 dark:border-[#162744]">
              <span className="text-[10px] font-bold text-slate-500 dark:text-slate-400">Theme</span>
              <button
                type="button"
                onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
                className="flex items-center gap-1.5 px-2.5 py-1 rounded-xl bg-slate-200/80 dark:bg-[#060c18] border border-slate-300 dark:border-[#162744] text-[11px] font-bold text-slate-800 dark:text-[#00e5ff] hover:bg-slate-300 dark:hover:bg-[#0c182b] transition-all cursor-pointer"
                title="Toggle Dark/Light Mode"
              >
                {theme === 'dark' ? (
                  <>
                    <Sun size={12} className="text-amber-400" />
                    <span>Light Mode</span>
                  </>
                ) : (
                  <>
                    <Moon size={12} className="text-cyan-600" />
                    <span>Dark Mode</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      </aside>

      <main className={`${currentView === View.SALES ? 'ml-0 h-screen overflow-hidden' : 'lg:ml-72 min-h-screen'} flex-1 flex flex-col relative transition-all duration-300`}>
        {syncStatus && (
          <div className={`fixed top-6 right-6 z-[100] flex items-center gap-3 px-6 py-3 rounded-2xl shadow-2xl text-xs font-black uppercase tracking-widest animate-in slide-in-from-right-10 duration-300 ${
            syncStatus === 'saving' ? 'bg-gradient-to-r from-[#0092d6] to-[#00c8ff] text-white shadow-[0_0_20px_rgba(0,200,255,0.5)]' : 
            syncStatus === 'saved' ? 'bg-emerald-500 text-white shadow-emerald-500/30' : 
            'bg-red-500 text-white shadow-red-500/30'
          }`}>
            {syncStatus === 'saving' && <RefreshCw size={16} className="animate-spin" />}
            {syncStatus === 'saved' && <Check size={16} />}
            {syncStatus === 'error' && <AlertCircle size={16} />}
            {syncStatus === 'saving' ? 'Saving...' : syncStatus === 'saved' ? 'Saved Locally' : 'Error Saving'}
          </div>
        )}
        
        {/* Workbox Offline and Connectivity Banner */}
        <OfflineIndicator />
        
        {currentView !== View.SALES && (
          <header className="px-3.5 sm:px-6 py-3 sm:py-4 bg-white/80 dark:bg-[#050b14]/90 backdrop-blur-xl sticky top-0 z-40 flex justify-between items-center border-b border-slate-200 dark:border-[#162744]">
            <div className="flex items-center gap-2.5 sm:gap-4 min-w-0">
              <button 
                onClick={() => setIsMobileMenuOpen(true)} 
                className="lg:hidden p-2 sm:p-2.5 bg-white dark:bg-[#0e1a2f] border border-slate-200 dark:border-[#162744] rounded-xl shadow-sm active:scale-95 cursor-pointer shrink-0"
                title="Open Navigation Menu"
              >
                <Menu size={20} className="text-[#00e5ff]" />
              </button>
              <div className="flex items-center gap-2 min-w-0">
                <span className="w-2 h-2 rounded-full bg-[#00e5ff] shadow-[0_0_8px_#00e5ff] shrink-0"></span>
                <h2 className="text-base sm:text-xl md:text-2xl font-black uppercase tracking-tight text-slate-900 dark:text-white truncate">
                  {currentView.replace('_', ' ')}
                </h2>
              </div>
            </div>
            <div className="flex items-center gap-1.5 sm:gap-3 shrink-0">
              <NetworkStatusBadge />
              <PWAInstallButton variant="header" />
              <button 
                onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')} 
                className="p-2 sm:p-3 bg-white dark:bg-[#0e1a2f] border border-slate-200 dark:border-[#162744] rounded-xl sm:rounded-2xl text-[#00e5ff] shadow-sm transition-all active:scale-95 cursor-pointer"
                title="Toggle Theme"
              >
                {theme === 'dark' ? <Sun size={18} /> : <Moon size={18} />}
              </button>
              {isManagerAuthenticated && (
                <button 
                  onClick={() => handleLockAdmin()} 
                  className="flex items-center gap-1.5 px-3 py-2 sm:px-4 sm:py-3 bg-amber-500/10 border border-amber-500/30 rounded-xl sm:rounded-2xl text-amber-400 font-bold text-xs shadow-sm hover:bg-amber-500/20 transition-all active:scale-95 cursor-pointer uppercase tracking-wider"
                  title="Lock Admin Panel"
                >
                  <Lock size={15} />
                  <span className="hidden sm:inline">Lock Admin</span>
                </button>
              )}
              <button 
                onClick={handleLogout} 
                className="p-2 sm:p-3 bg-white dark:bg-[#0e1a2f] border border-slate-200 dark:border-[#162744] rounded-xl sm:rounded-2xl text-red-400 shadow-sm hover:bg-red-50 dark:hover:bg-red-500/10 transition-all active:scale-95 cursor-pointer" 
                title="Logout"
              >
                <LogOut size={18} />
              </button>
            </div>
          </header>
        )}

        <div className={`${currentView === View.SALES ? 'p-2 sm:p-3.5 h-full overflow-hidden flex flex-col' : 'p-3 sm:p-5 md:p-6 pb-24 lg:pb-6 flex-1'}`}>
          {!isDataLoaded ? (
            <div className="flex flex-col items-center justify-center h-[60vh]"><div className="w-12 h-12 border-4 border-orange-500/20 border-t-orange-500 rounded-full animate-spin"></div><p className="mt-6 font-black text-slate-400 animate-pulse uppercase text-xs tracking-[0.3em]">Loading Bakery Data...</p></div>
          ) : (
            <div className={`animate-in fade-in duration-700 ${currentView === View.SALES ? 'h-full flex flex-col overflow-hidden' : ''}`}>
              {currentView === View.DASHBOARD && <Dashboard products={products} sales={sales} expenses={expenses} wastage={wastage} closings={dailyClosings} production={production} />}
              {currentView === View.INVENTORY && (
                <Inventory 
                  products={products} 
                  onAdd={addProduct} 
                  onUpdate={addProduct} 
                  onDelete={deleteProduct} 
                  isManagerAuthenticated={isManagerAuthenticated}
                  onRequireAuth={(action) => {
                    setPendingAction(() => action);
                    setShowLockModal(true);
                    setLockInput('');
                    setLockError(false);
                  }}
                  onMarkWastage={(p, qty, reason) => markWastage({ id: generateId('wst'), productId: p.id, productName: p.name, quantity: qty, unit: p.unit, lossValue: p.price * qty, reason, date: new Date().toISOString() })} 
                />
              )}
              {currentView === View.SALES && (
                <SalesView 
                  products={products} 
                  sales={sales} 
                  businessProfile={userProfile}
                  onAddSale={addSale} 
                  onCancelSale={cancelSale} 
                  onNavigateToView={(view) => handleViewChange(view)}
                  onOpenMobileMenu={() => setIsMobileMenuOpen(true)}
                  theme={theme}
                  onToggleTheme={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
                />
              )}
              {currentView === View.DUES && <DuesView sales={sales} onUpdateSales={updateBulkSales} />}
              {currentView === View.PRODUCTION && <ProductionView production={production} products={products} sales={sales} wastage={wastage} onDelete={deleteProduction} />}
              {currentView === View.NOTES && (
                <DailyNotesView 
                  notes={notes} 
                  staff={staff} 
                  currentUser={userEmail} 
                  onAddNote={addNote} 
                  onUpdateNote={updateNote} 
                  onDeleteNote={deleteNote} 
                />
              )}
              {currentView === View.WASTAGE && <WastageView wastage={wastage} products={products} onAdd={markWastage} onDelete={deleteWastage} closings={dailyClosings} />}
              {currentView === View.EXPENSES && <ExpensesView expenses={expenses} onAdd={addExpense} closings={dailyClosings} />}
              {currentView === View.DAILY_CLOSING && <DailyClosingView sales={sales} expenses={expenses} wastage={wastage} closings={dailyClosings} onCloseDay={closeDay} onDeleteClosing={deleteClosing} onUpdateClosing={updateClosing} currentUser={userEmail} />}
              {currentView === View.MONTHLY_CLOSING && <MonthlyClosingView dailyClosings={dailyClosings} monthlyClosings={monthlyClosings} onCloseMonth={addMonthlyClosing} onDeleteMonthlyClosing={deleteMonthlyClosing} currentUser={userEmail} managerPassword={managerPassword} />}
              {currentView === View.STAFF && <StaffView staff={staff} attendance={attendance} expenses={expenses} deductions={deductions} sales={sales} onAddStaff={addStaff} onUpdateAttendance={updateAttendance} onAddDeduction={addDeduction} onPaySalary={paySalary} />}
              {currentView === View.MANAGER && (
                <ManagerView 
                  username={userEmail} 
                  profile={userProfile}
                  onLogout={handleLogout} 
                  onReset={handleReset} 
                  stats={{ products: products.length, sales: sales.length, expenses: expenses.length, staff: staff.length, storageSize: Number(storageSize) }} 
                  onUpdatePassword={updateManagerPassword} 
                  onUpdateProfile={handleUpdateProfile}
                  onLock={() => handleLockAdmin()} 
                  currentPassword={managerPassword} 
                />
              )}
            </div>
          )}
        </div>

        {/* Mobile Bottom Navigation Bar (Shown on mobile screens for quick navigation across core views) */}
        {currentView !== View.SALES && (
          <nav className="lg:hidden fixed bottom-0 left-0 right-0 z-40 bg-white/95 dark:bg-[#070d19]/95 backdrop-blur-xl border-t border-slate-200 dark:border-[#162744] px-2 py-1.5 flex items-center justify-around shadow-[0_-5px_25px_rgba(0,0,0,0.15)] dark:shadow-[0_-5px_25px_rgba(0,0,0,0.5)]">
            <button
              onClick={() => handleViewChange(View.SALES)}
              className={`flex flex-col items-center justify-center py-1 px-2 rounded-xl transition-all cursor-pointer ${
                currentView === View.SALES ? 'text-cyan-600 dark:text-[#00e5ff] font-bold' : 'text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              <div className={`p-1.5 rounded-lg ${currentView === View.SALES ? 'bg-cyan-500/20 shadow-[0_0_10px_rgba(0,210,255,0.4)]' : ''}`}>
                <ShoppingCart size={18} />
              </div>
              <span className="text-[10px] tracking-tight mt-0.5 font-bold">POS Sale</span>
            </button>

            <button
              onClick={() => handleViewChange(View.INVENTORY)}
              className={`flex flex-col items-center justify-center py-1 px-2 rounded-xl transition-all cursor-pointer ${
                currentView === View.INVENTORY ? 'text-cyan-600 dark:text-[#00e5ff] font-bold' : 'text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              <div className={`p-1.5 rounded-lg ${currentView === View.INVENTORY ? 'bg-cyan-500/20 shadow-[0_0_10px_rgba(0,210,255,0.4)]' : ''}`}>
                <Package size={18} />
              </div>
              <span className="text-[10px] tracking-tight mt-0.5 font-bold">Stock</span>
            </button>

            <button
              onClick={() => handleViewChange(View.DUES)}
              className={`flex flex-col items-center justify-center py-1 px-2 rounded-xl transition-all relative cursor-pointer ${
                currentView === View.DUES ? 'text-cyan-600 dark:text-[#00e5ff] font-bold' : 'text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              <div className={`p-1.5 rounded-lg ${currentView === View.DUES ? 'bg-cyan-500/20 shadow-[0_0_10px_rgba(0,210,255,0.4)]' : ''}`}>
                <Wallet size={18} />
              </div>
              <span className="text-[10px] tracking-tight mt-0.5 font-bold">Dues</span>
              {sales.filter(s => s.dueAmount > 0).length > 0 && (
                <span className="absolute top-1 right-2 w-2 h-2 rounded-full bg-red-500 animate-pulse"></span>
              )}
            </button>

            <button
              onClick={() => handleViewChange(View.NOTES)}
              className={`flex flex-col items-center justify-center py-1 px-2 rounded-xl transition-all relative cursor-pointer ${
                currentView === View.NOTES ? 'text-cyan-600 dark:text-[#00e5ff] font-bold' : 'text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              <div className={`p-1.5 rounded-lg ${currentView === View.NOTES ? 'bg-cyan-500/20 shadow-[0_0_10px_rgba(0,210,255,0.4)]' : ''}`}>
                <StickyNote size={18} />
              </div>
              <span className="text-[10px] tracking-tight mt-0.5 font-bold">Notes</span>
              {notes.filter(n => n.status === 'active' && n.priority === 'urgent').length > 0 && (
                <span className="absolute top-1 right-2 w-2 h-2 rounded-full bg-red-500 animate-pulse"></span>
              )}
            </button>

            <button
              onClick={() => handleViewChange(View.DASHBOARD)}
              className={`flex flex-col items-center justify-center py-1 px-2 rounded-xl transition-all cursor-pointer ${
                currentView === View.DASHBOARD ? 'text-cyan-600 dark:text-[#00e5ff] font-bold' : 'text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              <div className={`p-1.5 rounded-lg ${currentView === View.DASHBOARD ? 'bg-cyan-500/20 shadow-[0_0_10px_rgba(0,210,255,0.4)]' : ''}`}>
                <LayoutDashboard size={18} />
              </div>
              <span className="text-[10px] tracking-tight mt-0.5 font-bold">Dashboard</span>
            </button>

            <button
              onClick={() => setIsMobileMenuOpen(true)}
              className="flex flex-col items-center justify-center py-1 px-2 rounded-xl text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white transition-all cursor-pointer"
            >
              <div className="p-1.5 rounded-lg bg-slate-100 dark:bg-[#0c182b] text-cyan-600 dark:text-[#00d2ff]">
                <Menu size={18} />
              </div>
              <span className="text-[10px] tracking-tight mt-0.5 font-bold">More</span>
            </button>
          </nav>
        )}

        {/* Manager Lock Modal */}
        {showLockModal && (
          <div className="fixed inset-0 z-[300] flex items-center justify-center p-6 bg-black/60 dark:bg-black/85 backdrop-blur-xl animate-in fade-in duration-300">
            <div className="bg-white dark:bg-[#0a1220] p-8 sm:p-10 rounded-[2.5rem] border border-slate-200 dark:border-[#162744] shadow-2xl dark:shadow-[0_20px_60px_rgba(0,0,0,0.9)] w-full max-w-md animate-in zoom-in duration-300">
              <div className="w-20 h-20 bg-cyan-50 dark:bg-[#071324] border border-cyan-500/30 dark:border-[#00d2ff]/40 rounded-3xl flex items-center justify-center mx-auto mb-6 text-cyan-600 dark:text-[#00e5ff] shadow-md dark:shadow-[0_0_25px_rgba(0,210,255,0.3)]">
                <Lock size={38} className="drop-shadow-sm dark:drop-shadow-[0_0_10px_rgba(0,229,255,0.8)]" />
              </div>
              <h3 className="text-2xl font-black text-slate-900 dark:text-white text-center mb-1 uppercase tracking-tight">Admin Lock</h3>
              <p className="text-cyan-600 dark:text-[#00d2ff] text-center mb-8 text-xs font-bold uppercase tracking-widest">Enter 6-Digit Security PIN</p>
              
              <form onSubmit={handleUnlock} className="space-y-6">
                <div className="space-y-2">
                  <input 
                    type="password" 
                    maxLength={6}
                    autoFocus
                    className={`w-full bg-slate-50 dark:bg-[#050b14] border-2 rounded-2xl p-4 text-center text-3xl font-black tracking-[0.5em] outline-none text-slate-900 dark:text-white transition-all ${lockError ? 'border-red-500 animate-shake' : 'border-slate-200 dark:border-[#162a45] focus:border-cyan-500 dark:focus:border-[#00d2ff] focus:shadow-[0_0_20px_rgba(0,210,255,0.35)]'}`}
                    placeholder="••••••"
                    value={lockInput}
                    onChange={e => setLockInput(e.target.value)}
                  />
                  {lockError && <p className="text-red-500 dark:text-red-400 text-[11px] font-black text-center uppercase tracking-widest mt-2">Wrong password! Try again.</p>}
                </div>
                
                <div className="flex flex-col gap-3 pt-2">
                  <button 
                    type="submit" 
                    className="w-full smart-cyan-pill py-4 uppercase tracking-widest text-sm cursor-pointer"
                  >
                    Unlock Admin Panel
                  </button>
                  <button 
                    type="button"
                    onClick={() => setShowLockModal(false)}
                    className="w-full text-slate-500 dark:text-slate-400 font-bold py-2.5 hover:text-slate-900 dark:hover:text-white transition-all text-xs uppercase tracking-widest cursor-pointer text-center"
                  >
                    Cancel
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Global Confirmation Modal */}
        {confirmModal.isOpen && (
          <div className="fixed inset-0 z-[200] flex items-center justify-center p-6 bg-black/80 backdrop-blur-md animate-in fade-in duration-300">
            <div className="bg-white dark:bg-[#161d31] p-10 rounded-[2.5rem] border border-slate-200 dark:border-slate-800 shadow-2xl w-full max-w-md animate-in zoom-in duration-300 text-center">
              <div className={`w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-6 ${
                confirmModal.type === 'danger' ? 'bg-red-500/10 text-red-500' : 
                confirmModal.type === 'warning' ? 'bg-amber-500/10 text-amber-500' : 
                'bg-blue-500/10 text-blue-500'
              }`}>
                {confirmModal.type === 'danger' ? <Trash2 size={40} /> : <AlertCircle size={40} />}
              </div>
              <h3 className="text-2xl font-black text-slate-900 dark:text-white mb-2">{confirmModal.title}</h3>
              <p className="text-slate-500 dark:text-slate-400 mb-8">{confirmModal.message}</p>
              <div className="flex flex-col gap-3">
                <button 
                  onClick={confirmModal.onConfirm} 
                  className={`w-full text-white font-bold py-4 rounded-2xl shadow-lg active:scale-95 transition-all ${
                    confirmModal.type === 'danger' ? 'bg-red-500 shadow-red-500/20' : 
                    confirmModal.type === 'warning' ? 'bg-amber-500 shadow-amber-500/20' : 
                    'bg-blue-500 shadow-blue-500/20'
                  }`}
                >
                  {confirmModal.confirmText || 'Confirm'}
                </button>
                <button 
                  onClick={() => setConfirmModal(prev => ({ ...prev, isOpen: false }))} 
                  className="w-full bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 font-bold py-4 rounded-2xl hover:text-slate-900 dark:hover:text-white transition-all"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
};

export default App;
