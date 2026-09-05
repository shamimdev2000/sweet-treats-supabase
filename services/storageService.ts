import { Product, Sale, Expense, Wastage, Staff, Attendance, DailyClosing, Deduction, MonthlyClosing, Production, DailyNote, UserProfile } from '../types';
import { generateId } from './idGenerator';

const STORAGE_KEYS = {
  PRODUCTS: 'sweetBakery_products',
  SALES: 'sweetBakery_sales',
  EXPENSES: 'sweetBakery_expenses',
  WASTAGE: 'sweetBakery_wastage',
  STAFF: 'sweetBakery_staff',
  ATTENDANCE: 'sweetBakery_attendance',
  CLOSINGS: 'sweetBakery_daily_closings',
  DEDUCTIONS: 'sweetBakery_deductions',
  MONTHLY_CLOSINGS: 'sweetBakery_monthly_closings',
  PRODUCTION: 'sweetBakery_production',
  NOTES: 'sweetBakery_daily_notes',
  PROFILE: 'sweetBakery_business_profile'
};

const PROFILES_KEY = 'sweetBakery_profiles';
const DB_NAME = 'SweetBakeryDB';
const DB_VERSION = 3;
const STORE_NAME = 'key_value_store';

let dbInstance: IDBDatabase | null = null;
let dbPromise: Promise<IDBDatabase> | null = null;
let isIDBAvailable = typeof window !== 'undefined' && !!window.indexedDB;

function getDB(): Promise<IDBDatabase> {
  if (dbInstance) return Promise.resolve(dbInstance);
  if (dbPromise) return dbPromise;

  dbPromise = new Promise((resolve, reject) => {
    const timeoutId = setTimeout(() => {
      console.warn("IndexedDB open request timed out. Disabling IndexedDB for this session.");
      isIDBAvailable = false;
      dbPromise = null;
      reject(new Error("IndexedDB open timeout"));
    }, 1500);

    try {
      if (!isIDBAvailable) {
        clearTimeout(timeoutId);
        dbPromise = null;
        return reject(new Error("IndexedDB is marked unavailable"));
      }

      const request = indexedDB.open(DB_NAME, DB_VERSION);
      
      request.onblocked = () => {
        console.warn("IndexedDB open blocked by a pending connection.");
        clearTimeout(timeoutId);
        isIDBAvailable = false;
        dbPromise = null;
        reject(new Error("IndexedDB blocked"));
      };

      request.onerror = () => {
        clearTimeout(timeoutId);
        dbPromise = null;
        console.error("IndexedDB open error:", request.error);
        reject(request.error || new Error("Unknown IndexedDB open error"));
      };
      
      request.onsuccess = () => {
        clearTimeout(timeoutId);
        dbInstance = request.result;
        dbInstance.onversionchange = () => {
          dbInstance?.close();
          dbInstance = null;
          dbPromise = null;
        };
        resolve(dbInstance);
      };
      
      request.onupgradeneeded = () => {
        const db = request.result;
        if (!db.objectStoreNames.contains(STORE_NAME)) {
          db.createObjectStore(STORE_NAME);
        }
      };
    } catch (e) {
      clearTimeout(timeoutId);
      dbPromise = null;
      console.error("IndexedDB synchronous open exception:", e);
      reject(e);
    }
  });

  return dbPromise;
}

const idbGet = <T>(key: string): Promise<T | null> => {
  return getDB().then((db) => {
    return new Promise<T | null>((resolve, reject) => {
      try {
        const transaction = db.transaction(STORE_NAME, 'readonly');
        const store = transaction.objectStore(STORE_NAME);
        const request = store.get(key);
        
        request.onerror = () => reject(request.error);
        request.onsuccess = () => resolve(request.result !== undefined ? request.result as T : null);
      } catch (err) {
        reject(err);
      }
    });
  });
};

const idbSet = <T>(key: string, value: T): Promise<void> => {
  return getDB().then((db) => {
    return new Promise<void>((resolve, reject) => {
      try {
        const transaction = db.transaction(STORE_NAME, 'readwrite');
        const store = transaction.objectStore(STORE_NAME);
        const request = store.put(value, key);
        
        transaction.oncomplete = () => resolve();
        transaction.onerror = () => reject(transaction.error);
        request.onerror = () => reject(request.error);
      } catch (err) {
        reject(err);
      }
    });
  });
};

const idbDelete = (key: string): Promise<void> => {
  return getDB().then((db) => {
    return new Promise<void>((resolve, reject) => {
      try {
        const transaction = db.transaction(STORE_NAME, 'readwrite');
        const store = transaction.objectStore(STORE_NAME);
        const request = store.delete(key);
        
        transaction.oncomplete = () => resolve();
        transaction.onerror = () => reject(transaction.error);
        request.onerror = () => reject(request.error);
      } catch (err) {
        reject(err);
      }
    });
  });
};

/**
 * Strict tenant isolation key builder
 */
export const getStorageKey = (keyVal: string, email: string): string => {
  const cleanEmail = (email || 'demo@bakery.com').trim().toLowerCase().replace(/[@.]/g, '_');
  const baseKey = keyVal.startsWith('sweetBakery_') ? keyVal.replace('sweetBakery_', '') : keyVal;
  return `sweetBakery_${cleanEmail}_${baseKey}`;
};

const getFromStorage = async <T>(keyVal: string, email: string): Promise<T[]> => {
  const fullKey = getStorageKey(keyVal, email);
  
  // 1. Try LocalStorage FIRST
  try {
    const backup = localStorage.getItem(fullKey);
    if (backup) {
      return JSON.parse(backup);
    }
  } catch (err) {
    console.error(`localStorage read failed for ${fullKey}:`, err);
  }

  // 2. Fallback to IndexedDB
  if (isIDBAvailable) {
    try {
      const data = await idbGet<T[]>(fullKey);
      if (data && Array.isArray(data)) {
        localStorage.setItem(fullKey, JSON.stringify(data));
        return data;
      }
    } catch (e) {
      console.warn(`IndexedDB read failed for ${fullKey}:`, e);
    }
  }

  return [];
};

const saveToStorage = async <T>(keyVal: string, data: T[], email: string): Promise<void> => {
  const fullKey = getStorageKey(keyVal, email);
  
  // 1. Save to LocalStorage
  try {
    localStorage.setItem(fullKey, JSON.stringify(data));
  } catch (err) {
    console.error(`localStorage write failed for ${fullKey}:`, err);
  }

  // 2. Sync to IndexedDB
  if (isIDBAvailable) {
    try {
      await idbSet<T[]>(fullKey, data);
    } catch (e) {
      console.warn(`IndexedDB write failed for ${fullKey}:`, e);
    }
  }
};

/**
 * Starter sample products for users who opt into a Starter Pack or Demo Account
 */
export const createStarterPackProducts = (): Product[] => [
  { id: generateId('prod'), name: 'Black Forest Special Cake (1kg)', category: 'Cakes', price: 950, stock: 15, unit: 'pcs', barcode: '1001' },
  { id: generateId('prod'), name: 'Butter Croissant Premium', category: 'Pastry', price: 80, stock: 45, unit: 'pcs', barcode: '1002' },
  { id: generateId('prod'), name: 'Whole Wheat Milk Bread', category: 'Bread', price: 65, stock: 60, unit: 'pkt', barcode: '1003' },
  { id: generateId('prod'), name: 'Dark Chocolate Donut', category: 'Snacks', price: 60, stock: 35, unit: 'pcs', barcode: '1004' },
  { id: generateId('prod'), name: 'Chicken Puff Pastry', category: 'Fast Food', price: 50, stock: 40, unit: 'pcs', barcode: '1005' },
  { id: generateId('prod'), name: 'Gulab Jamun Sweet Box (500g)', category: 'Sweets', price: 280, stock: 25, unit: 'box', barcode: '1006' },
  { id: generateId('prod'), name: 'Vanilla Cream Roll', category: 'Bakery', price: 35, stock: 50, unit: 'pcs', barcode: '1007' },
  { id: generateId('prod'), name: 'Cold Brew Iced Coffee', category: 'Beverage', price: 120, stock: 30, unit: 'pcs', barcode: '1008' }
];

export const storageService = {
  // Profiles Management (Multi-tenant User Accounts)
  getProfiles(): UserProfile[] {
    try {
      const data = localStorage.getItem(PROFILES_KEY);
      if (data) return JSON.parse(data);
    } catch (e) {
      console.error("Error reading profiles:", e);
    }
    
    // Seed default demo profile if empty
    const demoProfile: UserProfile = {
      id: 'usr_demo_bakery',
      email: 'demo@bakery.com',
      username: 'demobakery',
      businessName: 'Sweet Treats Corporation',
      ownerName: 'Demo Bakery Manager',
      phone: '+880 1700-000000',
      address: 'Shop 104, Baker Street Avenue',
      password: 'password123',
      managerPin: '123456',
      currencySymbol: '৳',
      receiptFooter: 'Thank you for shopping with us! Freshly baked every morning.',
      createdAt: new Date().toISOString(),
      starterPack: true
    };
    
    try {
      localStorage.setItem(PROFILES_KEY, JSON.stringify([demoProfile]));
    } catch {
      // Ignore
    }
    return [demoProfile];
  },

  saveProfiles(profiles: UserProfile[]): void {
    try {
      localStorage.setItem(PROFILES_KEY, JSON.stringify(profiles));
    } catch (e) {
      console.error("Error saving profiles:", e);
    }
  },

  getProfileByEmail(email: string): UserProfile | null {
    const cleanEmail = email.trim().toLowerCase();
    const profiles = this.getProfiles();
    return profiles.find(p => p.email.toLowerCase() === cleanEmail) || null;
  },

  saveProfile(profile: UserProfile): void {
    const profiles = this.getProfiles();
    const cleanEmail = profile.email.trim().toLowerCase();
    const index = profiles.findIndex(p => p.email.toLowerCase() === cleanEmail);
    if (index > -1) {
      profiles[index] = { ...profiles[index], ...profile };
    } else {
      profiles.push(profile);
    }
    this.saveProfiles(profiles);

    // Also mirror to scoped profile storage
    const fullKey = getStorageKey(STORAGE_KEYS.PROFILE, cleanEmail);
    try {
      localStorage.setItem(fullKey, JSON.stringify(profile));
    } catch (e) {
      console.error("Failed to save scoped profile:", e);
    }
  },

  async updateProfile(email: string, updates: Partial<UserProfile>): Promise<UserProfile | null> {
    const cleanEmail = email.trim().toLowerCase();
    const profiles = this.getProfiles();
    const index = profiles.findIndex(p => p.email.toLowerCase() === cleanEmail);
    if (index === -1) return null;

    profiles[index] = {
      ...profiles[index],
      ...updates
    };
    this.saveProfiles(profiles);

    // Also sync manager password key if manager PIN updated
    if (updates.managerPin) {
      const pinKey = getStorageKey('managerPass', cleanEmail);
      localStorage.setItem(pinKey, updates.managerPin);
    }

    const fullKey = getStorageKey(STORAGE_KEYS.PROFILE, cleanEmail);
    try {
      localStorage.setItem(fullKey, JSON.stringify(profiles[index]));
    } catch (e) {
      console.error("Failed to update scoped profile:", e);
    }

    return profiles[index];
  },

  getManagerPin(email: string): string {
    const cleanEmail = email.trim().toLowerCase();
    const pinKey = getStorageKey('managerPass', cleanEmail);
    const savedPin = localStorage.getItem(pinKey);
    if (savedPin) return savedPin;

    const profile = this.getProfileByEmail(cleanEmail);
    if (profile && profile.managerPin) return profile.managerPin;

    return '123456';
  },

  setManagerPin(email: string, newPin: string): void {
    const cleanEmail = email.trim().toLowerCase();
    const pinKey = getStorageKey('managerPass', cleanEmail);
    localStorage.setItem(pinKey, newPin);

    // Update in profile as well
    this.updateProfile(cleanEmail, { managerPin: newPin });
  },

  // Products
  async getProducts(email: string): Promise<Product[]> {
    let prods = await getFromStorage<Product>(STORAGE_KEYS.PRODUCTS, email);
    // If demo account or fresh account with starter pack flag, seed starter products
    if (prods.length === 0) {
      const profile = this.getProfileByEmail(email);
      if (email.toLowerCase() === 'demo@bakery.com' || profile?.starterPack) {
        prods = createStarterPackProducts();
        await saveToStorage(STORAGE_KEYS.PRODUCTS, prods, email);
      }
    }
    return prods;
  },
  async upsertProduct(email: string, product: Product) {
    const products = await getFromStorage<Product>(STORAGE_KEYS.PRODUCTS, email);
    const index = products.findIndex(p => p.id === product.id);
    if (index > -1) {
      products[index] = product;
    } else {
      products.unshift(product);
    }
    await saveToStorage(STORAGE_KEYS.PRODUCTS, products, email);
  },
  async deleteProduct(email: string, id: string) {
    const products = await getFromStorage<Product>(STORAGE_KEYS.PRODUCTS, email);
    await saveToStorage(STORAGE_KEYS.PRODUCTS, products.filter(p => p.id !== id), email);
  },

  // Sales
  async getSales(email: string): Promise<Sale[]> {
    return await getFromStorage<Sale>(STORAGE_KEYS.SALES, email);
  },
  async addSale(email: string, sale: Sale) {
    const sales = await getFromStorage<Sale>(STORAGE_KEYS.SALES, email);
    sales.push(sale);
    await saveToStorage(STORAGE_KEYS.SALES, sales, email);
  },
  async updateSale(email: string, sale: Sale) {
    const sales = await getFromStorage<Sale>(STORAGE_KEYS.SALES, email);
    const index = sales.findIndex(s => s.id === sale.id);
    if (index > -1) {
      sales[index] = sale;
      await saveToStorage(STORAGE_KEYS.SALES, sales, email);
    }
  },
  async deleteSale(email: string, id: string) {
    const sales = await getFromStorage<Sale>(STORAGE_KEYS.SALES, email);
    await saveToStorage(STORAGE_KEYS.SALES, sales.filter(s => s.id !== id), email);
  },

  // Expenses
  async getExpenses(email: string): Promise<Expense[]> {
    return await getFromStorage<Expense>(STORAGE_KEYS.EXPENSES, email);
  },
  async addExpense(email: string, expense: Expense) {
    const expenses = await getFromStorage<Expense>(STORAGE_KEYS.EXPENSES, email);
    expenses.push(expense);
    await saveToStorage(STORAGE_KEYS.EXPENSES, expenses, email);
  },

  // Wastage
  async getWastage(email: string): Promise<Wastage[]> {
    return await getFromStorage<Wastage>(STORAGE_KEYS.WASTAGE, email);
  },
  async addWastage(email: string, wastage: Wastage) {
    const all = await getFromStorage<Wastage>(STORAGE_KEYS.WASTAGE, email);
    all.push(wastage);
    await saveToStorage(STORAGE_KEYS.WASTAGE, all, email);
  },
  async deleteWastage(email: string, id: string) {
    const all = await getFromStorage<Wastage>(STORAGE_KEYS.WASTAGE, email);
    await saveToStorage(STORAGE_KEYS.WASTAGE, all.filter(w => w.id !== id), email);
  },

  // Staff
  async getStaff(email: string): Promise<Staff[]> {
    return await getFromStorage<Staff>(STORAGE_KEYS.STAFF, email);
  },
  async addStaff(email: string, staff: Staff) {
    const all = await getFromStorage<Staff>(STORAGE_KEYS.STAFF, email);
    all.push(staff);
    await saveToStorage(STORAGE_KEYS.STAFF, all, email);
  },

  // Attendance
  async getAttendance(email: string): Promise<Attendance[]> {
    return await getFromStorage<Attendance>(STORAGE_KEYS.ATTENDANCE, email);
  },
  async upsertAttendance(email: string, attendance: Attendance) {
    const all = await getFromStorage<Attendance>(STORAGE_KEYS.ATTENDANCE, email);
    const index = all.findIndex(item => item.staffId === attendance.staffId && item.date === attendance.date);
    if (index > -1) {
      all[index] = attendance;
    } else {
      all.push(attendance);
    }
    await saveToStorage(STORAGE_KEYS.ATTENDANCE, all, email);
  },

  // Closings
  async getClosings(email: string): Promise<DailyClosing[]> {
    return await getFromStorage<DailyClosing>(STORAGE_KEYS.CLOSINGS, email);
  },
  async addClosing(email: string, closing: DailyClosing) {
    const all = await getFromStorage<DailyClosing>(STORAGE_KEYS.CLOSINGS, email);
    all.push(closing);
    await saveToStorage(STORAGE_KEYS.CLOSINGS, all, email);
  },
  async deleteClosing(email: string, id: string) {
    const all = await getFromStorage<DailyClosing>(STORAGE_KEYS.CLOSINGS, email);
    await saveToStorage(STORAGE_KEYS.CLOSINGS, all.filter(c => c.id !== id), email);
  },
  async updateClosing(email: string, updatedClosing: DailyClosing) {
    const all = await getFromStorage<DailyClosing>(STORAGE_KEYS.CLOSINGS, email);
    const updated = all.map(c => c.id === updatedClosing.id ? updatedClosing : c);
    await saveToStorage(STORAGE_KEYS.CLOSINGS, updated, email);
  },

  // Deductions
  async getDeductions(email: string): Promise<Deduction[]> {
    return await getFromStorage<Deduction>(STORAGE_KEYS.DEDUCTIONS, email);
  },
  async addDeduction(email: string, deduction: Deduction) {
    const all = await getFromStorage<Deduction>(STORAGE_KEYS.DEDUCTIONS, email);
    all.push(deduction);
    await saveToStorage(STORAGE_KEYS.DEDUCTIONS, all, email);
  },

  // Monthly Closings
  async getMonthlyClosings(email: string): Promise<MonthlyClosing[]> {
    return await getFromStorage<MonthlyClosing>(STORAGE_KEYS.MONTHLY_CLOSINGS, email);
  },
  async addMonthlyClosing(email: string, closing: MonthlyClosing) {
    const all = await getFromStorage<MonthlyClosing>(STORAGE_KEYS.MONTHLY_CLOSINGS, email);
    all.push(closing);
    await saveToStorage(STORAGE_KEYS.MONTHLY_CLOSINGS, all, email);
  },
  async deleteMonthlyClosing(email: string, id: string) {
    const all = await getFromStorage<MonthlyClosing>(STORAGE_KEYS.MONTHLY_CLOSINGS, email);
    await saveToStorage(STORAGE_KEYS.MONTHLY_CLOSINGS, all.filter(c => c.id !== id), email);
  },

  // Production
  async getProduction(email: string): Promise<Production[]> {
    return await getFromStorage<Production>(STORAGE_KEYS.PRODUCTION, email);
  },
  async addProduction(email: string, production: Production) {
    const all = await getFromStorage<Production>(STORAGE_KEYS.PRODUCTION, email);
    all.push(production);
    await saveToStorage(STORAGE_KEYS.PRODUCTION, all, email);
  },
  async deleteProduction(email: string, id: string) {
    const all = await getFromStorage<Production>(STORAGE_KEYS.PRODUCTION, email);
    await saveToStorage(STORAGE_KEYS.PRODUCTION, all.filter(p => p.id !== id), email);
  },

  // Daily Notes
  async getNotes(email: string): Promise<DailyNote[]> {
    return await getFromStorage<DailyNote>(STORAGE_KEYS.NOTES, email);
  },
  async addNote(email: string, note: DailyNote) {
    const all = await getFromStorage<DailyNote>(STORAGE_KEYS.NOTES, email);
    all.unshift(note);
    await saveToStorage(STORAGE_KEYS.NOTES, all, email);
  },
  async updateNote(email: string, updatedNote: DailyNote) {
    const all = await getFromStorage<DailyNote>(STORAGE_KEYS.NOTES, email);
    const index = all.findIndex(n => n.id === updatedNote.id);
    if (index > -1) {
      all[index] = updatedNote;
      await saveToStorage(STORAGE_KEYS.NOTES, all, email);
    }
  },
  async deleteNote(email: string, id: string) {
    const all = await getFromStorage<DailyNote>(STORAGE_KEYS.NOTES, email);
    await saveToStorage(STORAGE_KEYS.NOTES, all.filter(n => n.id !== id), email);
  },

  // Clear data ONLY for this specific user/tenant without touching other accounts
  async clearAllDataForUser(email: string): Promise<void> {
    const cleanEmail = email.trim().toLowerCase();
    try {
      for (const [_, globalKey] of Object.entries(STORAGE_KEYS)) {
        const fullKey = getStorageKey(globalKey, cleanEmail);
        localStorage.removeItem(fullKey);
        await idbDelete(fullKey);
      }
      const pinKey = getStorageKey('managerPass', cleanEmail);
      localStorage.removeItem(pinKey);
      console.log(`Isolated storage cleared for user: ${cleanEmail}`);
    } catch (err) {
      console.error("Storage clear failed:", err);
    }
  },

  // Backup & Restore for active user/tenant
  async exportAllData(email: string): Promise<string> {
    const cleanEmail = email.trim().toLowerCase();
    const profile = this.getProfileByEmail(cleanEmail);
    const data: any = {};
    for (const [key, storageKey] of Object.entries(STORAGE_KEYS)) {
      data[key.toLowerCase()] = await getFromStorage(storageKey, cleanEmail);
    }
    return JSON.stringify({
      tenantEmail: cleanEmail,
      businessProfile: profile,
      version: '3.5.0 (Multi-Tenant SaaS Storage)',
      timestamp: new Date().toISOString(),
      data
    }, null, 2);
  },

  async importAllData(email: string, jsonData: string): Promise<boolean> {
    const cleanEmail = email.trim().toLowerCase();
    try {
      const parsed = JSON.parse(jsonData);
      if (!parsed.data) return false;
      
      for (const [key, storageKey] of Object.entries(STORAGE_KEYS)) {
        const items = parsed.data[key.toLowerCase()];
        if (Array.isArray(items)) {
          await saveToStorage(storageKey, items, cleanEmail);
        }
      }

      if (parsed.businessProfile) {
        await this.updateProfile(cleanEmail, parsed.businessProfile);
      }
      return true;
    } catch (e) {
      console.error("Import error in storageService:", e);
      return false;
    }
  }
};
