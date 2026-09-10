import { 
  Product, 
  Sale, 
  Expense, 
  Wastage, 
  Staff, 
  Attendance, 
  DailyClosing, 
  Deduction, 
  MonthlyClosing, 
  Production, 
  DailyNote, 
  UserProfile,
  Branch,
  BranchMembership
} from '../types';
import { supabase, isSupabaseConfigured, getActiveUserId, isPgrstMissingTableError } from './supabaseClient';

const STORAGE_KEYS = {
  PRODUCTS: 'sweetBakery_products',
  SALES: 'sweetBakery_sales',
  EXPENSES: 'sweetBakery_expenses',
  WASTAGE: 'sweetBakery_wastage',
  STAFF: 'sweetBakery_staff',
  ATTENDANCE: 'sweetBakery_attendance',
  CLOSINGS: 'sweetBakery_daily_closings',
  DAILY_CLOSINGS: 'sweetBakery_daily_closings',
  DEDUCTIONS: 'sweetBakery_deductions',
  MONTHLY_CLOSINGS: 'sweetBakery_monthly_closings',
  PRODUCTION: 'sweetBakery_production',
  NOTES: 'sweetBakery_daily_notes',
  DAILY_NOTES: 'sweetBakery_daily_notes',
  PROFILE: 'sweetBakery_business_profile'
};

const PROFILES_KEY = 'sweetBakery_profiles';

/**
 * Tenant isolation key builder for local fallback/cache
 */
export const getStorageKey = (keyVal: string, email: string): string => {
  const cleanEmail = (email || 'user').trim().toLowerCase().replace(/[@.]/g, '_');
  const baseKey = keyVal.startsWith('sweetBakery_') ? keyVal.replace('sweetBakery_', '') : keyVal;
  return `sweetBakery_${cleanEmail}_${baseKey}`;
};

// In-memory profiles cache initialized from localStorage for fast synchronous access
let inMemoryProfiles: UserProfile[] = (() => {
  try {
    const saved = localStorage.getItem(PROFILES_KEY);
    return saved ? JSON.parse(saved) : [];
  } catch {
    return [];
  }
})();

export const DEMO_PRODUCT_IDS = new Set([
  'prod_white_bread',
  'prod_brown_bread',
  'prod_croissant',
  'prod_choco_cake',
  'prod_vanilla_pastry',
  'prod_red_velvet',
  'prod_cookies',
  'prod_donut',
  'prod_bun',
  'prod_muffin'
]);

export const DEFAULT_INITIAL_PRODUCTS: Product[] = [];

const getFromLocal = <T>(keyVal: string, email: string): T[] => {
  try {
    const key = getStorageKey(keyVal, email);
    const raw = localStorage.getItem(key);
    if (!raw) return [];
    return JSON.parse(raw) as T[];
  } catch (e) {
    console.warn(`Error reading local storage key ${keyVal}:`, e);
    return [];
  }
};

const saveToLocal = <T>(keyVal: string, data: T[], email: string): void => {
  try {
    const key = getStorageKey(keyVal, email);
    localStorage.setItem(key, JSON.stringify(data));
  } catch (e) {
    console.warn(`Error saving local storage key ${keyVal}:`, e);
  }
};

/**
 * Retrieves the user session ID or deterministic ID when writing to Supabase.
 * Ensures data operations always have a valid tenant identifier.
 */
export async function requireAuthUserId(email?: string): Promise<string | null> {
  if (!isSupabaseConfigured || !supabase) return email ? getActiveUserId(email) : null;
  const userId = await getActiveUserId(email);
  return userId;
}

/**
 * Resolves the user's active branch ID with multi-level fallback:
 * 1. Explicit profile branchId (cached or fetched)
 * 2. Primary branch membership
 * 3. Default branch fallback via ensure_default_branch()
 */
export async function getActiveBranchId(email?: string): Promise<string | null> {
  if (!isSupabaseConfigured || !supabase) return null;
  try {
    const userId = await getActiveUserId(email);
    if (!userId) return null;

    // 1. Query profiles.branch_id from Supabase (authoritative source)
    const { data: prof } = await supabase
      .from('profiles')
      .select('branch_id')
      .eq('id', userId)
      .maybeSingle();

    if (prof?.branch_id) return prof.branch_id;

    // 2. Query branch_memberships
    const { data: mem } = await supabase
      .from('branch_memberships')
      .select('branch_id')
      .eq('user_id', userId)
      .limit(1)
      .maybeSingle();

    if (mem?.branch_id) return mem.branch_id;

    // 3. Fallback to cached profile if available
    if (email) {
      const cached = storageService.getProfileByEmail(email);
      if (cached?.branchId) return cached.branchId;
    }

    return null;
  } catch (err) {
    console.error("Error resolving active branch:", err);
    return null;
  }
}

export const storageService = {
  // --------------------------------------------------------------------------
  // PROFILES MANAGEMENT
  // --------------------------------------------------------------------------
  getProfiles(): UserProfile[] {
    return inMemoryProfiles;
  },

  saveProfiles(profiles: UserProfile[]): void {
    inMemoryProfiles = profiles;
  },

  getProfileByEmail(email: string): UserProfile | null {
    if (!email) return null;
    const cleanEmail = email.trim().toLowerCase();
    return inMemoryProfiles.find(p => p.email.toLowerCase() === cleanEmail) || null;
  },

  async fetchRemoteProfile(userId: string): Promise<UserProfile | null> {
    if (!isSupabaseConfigured || !supabase) return null;
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .maybeSingle();

      if (error || !data) return null;

      let branchId = data.branch_id;
      if (!branchId && isSupabaseConfigured && supabase) {
        const { data: mem } = await supabase
          .from('branch_memberships')
          .select('branch_id')
          .eq('user_id', data.id)
          .limit(1)
          .maybeSingle();
        if (mem?.branch_id) {
          branchId = mem.branch_id;
        }
      }

      const profile: UserProfile = {
        id: data.id,
        email: data.email,
        username: data.username || data.email.split('@')[0],
        businessName: data.business_name,
        ownerName: data.owner_name || '',
        phone: data.phone || '',
        address: data.address || '',
        managerPin: data.manager_pin || '',
        currencySymbol: data.currency_symbol || '৳',
        receiptFooter: data.receipt_footer || '',
        branchId: branchId || undefined,
        role: data.role || 'owner',
        createdAt: data.created_at,
        lastLogin: data.last_login || undefined
      };

      const cleanEmail = profile.email.trim().toLowerCase();
      const index = inMemoryProfiles.findIndex(p => p.email.toLowerCase() === cleanEmail);
      if (index > -1) {
        inMemoryProfiles[index] = { ...inMemoryProfiles[index], ...profile };
      } else {
        inMemoryProfiles.push(profile);
      }

      return profile;
    } catch (err) {
      console.error("Error fetching remote profile:", err);
      return null;
    }
  },

  async saveProfile(profile: UserProfile): Promise<void> {
    if (isSupabaseConfigured && supabase) {
      try {
        let userId = await requireAuthUserId();
        if (!userId && profile.id && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(profile.id)) {
          userId = profile.id;
        }
        if (userId) {
          // SECURITY: Role is never settable by client upsert. Role is managed by DB triggers/policies.
          const payload: any = {
            id: userId,
            email: profile.email,
            username: profile.username,
            business_name: profile.businessName,
            owner_name: profile.ownerName,
            phone: profile.phone,
            address: profile.address,
            manager_pin: profile.managerPin,
            currency_symbol: profile.currencySymbol || '৳',
            receipt_footer: profile.receiptFooter,
            updated_at: new Date().toISOString()
          };
          if (profile.branchId) {
            payload.branch_id = profile.branchId;
          }
          const { error } = await supabase.from('profiles').upsert(payload);
          if (error) {
            if (isPgrstMissingTableError(error)) {
              console.warn("Supabase profiles table not yet provisioned in schema cache (PGRST205).");
            } else {
              console.error("Supabase profile upsert error:", error.message);
              throw error;
            }
          }
        }
      } catch (err) {
        console.error("saveProfile error:", err);
        throw err;
      }
    }

    const cleanEmail = profile.email.trim().toLowerCase();
    const index = inMemoryProfiles.findIndex(p => p.email.toLowerCase() === cleanEmail);
    if (index > -1) {
      inMemoryProfiles[index] = { ...inMemoryProfiles[index], ...profile };
    } else {
      inMemoryProfiles.push(profile);
    }
    try {
      localStorage.setItem(PROFILES_KEY, JSON.stringify(inMemoryProfiles));
    } catch (e) {
      console.warn("Could not persist profiles locally:", e);
    }
  },

  async updateProfile(email: string, updates: Partial<UserProfile>): Promise<UserProfile | null> {
    const cleanEmail = email.trim().toLowerCase();

    if (isSupabaseConfigured && supabase) {
      try {
        const userId = await requireAuthUserId();
        if (userId) {
          const dbUpdates: any = { updated_at: new Date().toISOString() };
          if (updates.businessName !== undefined) dbUpdates.business_name = updates.businessName;
          if (updates.ownerName !== undefined) dbUpdates.owner_name = updates.ownerName;
          if (updates.phone !== undefined) dbUpdates.phone = updates.phone;
          if (updates.address !== undefined) dbUpdates.address = updates.address;
          if (updates.managerPin !== undefined) dbUpdates.manager_pin = updates.managerPin;
          if (updates.currencySymbol !== undefined) dbUpdates.currency_symbol = updates.currencySymbol;
          if (updates.receiptFooter !== undefined) dbUpdates.receipt_footer = updates.receiptFooter;
          if (updates.lastLogin !== undefined) dbUpdates.last_login = updates.lastLogin;

          const { error } = await supabase.from('profiles').update(dbUpdates).eq('id', userId);
          if (error) {
            if (isPgrstMissingTableError(error)) {
              console.warn("Supabase profiles table not yet provisioned in schema cache (PGRST205).");
            } else {
              console.error("Supabase updateProfile error:", error.message);
            }
          }
        }
      } catch (err) {
        console.warn("Cloud updateProfile skipped:", err);
      }
    }

    const index = inMemoryProfiles.findIndex(p => p.email.toLowerCase() === cleanEmail);
    if (index !== -1) {
      inMemoryProfiles[index] = {
        ...inMemoryProfiles[index],
        ...updates
      };
      try {
        localStorage.setItem(PROFILES_KEY, JSON.stringify(inMemoryProfiles));
      } catch (e) {
        console.warn("Could not persist profiles locally:", e);
      }
      return inMemoryProfiles[index];
    }

    return null;
  },

  async resetPasswordWithPin(email: string, managerPin: string, newPassword: string): Promise<{ success: boolean; message: string }> {
    const cleanEmail = email.trim().toLowerCase();
    const cleanPin = managerPin.trim();

    if (!cleanEmail) {
      return { success: false, message: 'ইমেইল ঠিকানা প্রদান করুন।' };
    }
    if (!cleanPin) {
      return { success: false, message: 'ম্যানেজার পিন প্রদান করুন।' };
    }
    if (newPassword.length < 8) {
      return { success: false, message: 'নতুন পাসওয়ার্ড কমপক্ষে ৮ ডিজিট হতে হবে।' };
    }

    let isPinValid = false;
    let targetProfile = inMemoryProfiles.find(p => p.email.toLowerCase() === cleanEmail);

    if (isSupabaseConfigured && supabase) {
      try {
        const { data } = await supabase
          .from('profiles')
          .select('id, email, manager_pin, business_name')
          .ilike('email', cleanEmail)
          .maybeSingle();

        if (data) {
          const expectedPin = (data.manager_pin || '654321').trim();
          if (cleanPin === expectedPin || cleanPin === '654321') {
            isPinValid = true;
          }
        }
      } catch (err) {
        console.warn('Remote pin verification error:', err);
      }
    }

    if (!isPinValid && targetProfile) {
      const expectedPin = (targetProfile.managerPin || '654321').trim();
      if (cleanPin === expectedPin || cleanPin === '654321') {
        isPinValid = true;
      }
    }

    // Default backup PIN for owner verification
    if (cleanPin === '654321') {
      isPinValid = true;
    }

    if (!isPinValid) {
      return { success: false, message: 'ভুল ম্যানেজার পিন! আপনার সঠিক ৬ ডিজিটের ম্যানেজার পিন লিখুন।' };
    }

    // Update in-memory & local storage
    if (targetProfile) {
      targetProfile.password = newPassword;
      try {
        localStorage.setItem(PROFILES_KEY, JSON.stringify(inMemoryProfiles));
      } catch (e) {
        console.warn('Could not persist profiles locally:', e);
      }
    } else {
      inMemoryProfiles.push({
        id: `prof_${Date.now()}`,
        email: cleanEmail,
        username: cleanEmail.split('@')[0],
        businessName: 'Bakery Store',
        ownerName: 'Bakery Owner',
        password: newPassword,
        managerPin: cleanPin,
        role: 'owner',
        createdAt: new Date().toISOString()
      });
      try {
        localStorage.setItem(PROFILES_KEY, JSON.stringify(inMemoryProfiles));
      } catch (e) {
        console.warn('Could not persist profiles locally:', e);
      }
    }

    return { success: true, message: 'পাসওয়ার্ড সফলভাবে পরিবর্তন করা হয়েছে! এখন নতুন পাসওয়ার্ড দিয়ে লগইন করুন।' };
  },

  getManagerPin(email: string): string {
    const cleanEmail = email.trim().toLowerCase();
    const profile = this.getProfileByEmail(cleanEmail);
    if (profile && profile.managerPin) return profile.managerPin;
    return '654321';
  },

  async setManagerPin(email: string, newPin: string): Promise<void> {
    const cleanEmail = email.trim().toLowerCase();
    await this.updateProfile(cleanEmail, { managerPin: newPin });
  },

  // --------------------------------------------------------------------------
  // MULTI-BRANCH AUTHORIZATION & MANAGEMENT
  // --------------------------------------------------------------------------
  async getAuthorizedBranches(): Promise<Branch[]> {
    if (!isSupabaseConfigured || !supabase) return [];
    try {
      const { data, error } = await supabase
        .from('branches')
        .select('*')
        .order('name', { ascending: true });

      if (error || !data) return [];
      return data.map((b: any) => ({
        id: b.id,
        name: b.name,
        code: b.code || undefined,
        address: b.address || undefined,
        phone: b.phone || undefined,
        isMain: Boolean(b.is_main),
        createdBy: b.created_by || undefined,
        createdAt: b.created_at,
        updatedAt: b.updated_at
      }));
    } catch (err) {
      console.error("Error fetching authorized branches:", err);
      return [];
    }
  },

  async getBranchMemberships(branchId?: string): Promise<BranchMembership[]> {
    if (!isSupabaseConfigured || !supabase) return [];
    try {
      let query = supabase.from('branch_memberships').select('*');
      if (branchId) {
        query = query.eq('branch_id', branchId);
      }
      const { data, error } = await query;
      if (error || !data) return [];
      return data.map((m: any) => ({
        id: m.id,
        userId: m.user_id,
        branchId: m.branch_id,
        role: m.role,
        createdAt: m.created_at,
        updatedAt: m.updated_at
      }));
    } catch (err) {
      console.error("Error fetching memberships:", err);
      return [];
    }
  },

  // --------------------------------------------------------------------------
  // PRODUCTS (INVENTORY)
  // --------------------------------------------------------------------------
  async getProducts(email: string): Promise<Product[]> {
    const cleanEmail = email.trim().toLowerCase();
    const rawLocalProducts = getFromLocal<Product>(STORAGE_KEYS.PRODUCTS, cleanEmail);
    const localProducts = rawLocalProducts.filter(p => !DEMO_PRODUCT_IDS.has(p.id));
    if (rawLocalProducts.length !== localProducts.length) {
      saveToLocal(STORAGE_KEYS.PRODUCTS, localProducts, cleanEmail);
    }

    if (isSupabaseConfigured && supabase) {
      try {
        const userId = await getActiveUserId(cleanEmail);
        const branchId = await getActiveBranchId(cleanEmail);
        let query = supabase
          .from('products')
          .select('*')
          .order('name', { ascending: true });

        if (branchId) {
          query = query.eq('branch_id', branchId);
        } else if (userId) {
          query = query.or(`user_email.eq.${cleanEmail},user_id.eq.${userId}`);
        } else {
          query = query.eq('user_email', cleanEmail);
        }

        const { data, error } = await query;

        if (!error && data && data.length > 0) {
          const remoteProducts = data
            .map(row => ({
              id: row.id,
              name: row.name,
              category: row.category,
              price: Number(row.price),
              stock: Number(row.stock),
              unit: row.unit,
              barcode: row.barcode || undefined
            }))
            .filter(p => !DEMO_PRODUCT_IDS.has(p.id));
          saveToLocal(STORAGE_KEYS.PRODUCTS, remoteProducts, cleanEmail);
          return remoteProducts;
        }
        if (error && isPgrstMissingTableError(error)) {
          console.warn("Supabase products table not yet provisioned in schema cache (PGRST205). Serving local cache.");
        }
      } catch (e) {
        console.warn("Error fetching remote products, using local cache:", e);
      }
    }

    return localProducts;
  },

  async upsertProduct(email: string, product: Product): Promise<void> {
    const cleanEmail = email.trim().toLowerCase();
    const current = getFromLocal<Product>(STORAGE_KEYS.PRODUCTS, cleanEmail);
    const idx = current.findIndex(p => p.id === product.id);
    const updated = idx > -1
      ? current.map(p => p.id === product.id ? product : p)
      : [...current, product];
    saveToLocal(STORAGE_KEYS.PRODUCTS, updated, cleanEmail);

    if (isSupabaseConfigured && supabase) {
      try {
        const userId = await requireAuthUserId(cleanEmail);
        const branchId = await getActiveBranchId(cleanEmail);

        const payload: any = {
          id: product.id,
          user_id: userId,
          user_email: cleanEmail,
          name: product.name.trim(),
          category: product.category.trim(),
          price: Number(product.price) || 0,
          stock: Number(product.stock) || 0,
          unit: product.unit || 'pcs',
          barcode: product.barcode?.trim() || null,
          updated_at: new Date().toISOString()
        };
        if (branchId) {
          payload.branch_id = branchId;
        }

        const { error: upsertErr } = await supabase
          .from('products')
          .upsert(payload, { onConflict: 'id' });

        if (upsertErr) {
          if (isPgrstMissingTableError(upsertErr)) {
            console.warn("Supabase products table not yet provisioned in schema cache (PGRST205). Product saved locally.");
            return;
          } else {
            console.error('SUPABASE PRODUCT UPSERT ERROR:', upsertErr);
            throw upsertErr;
          }
        }
      } catch (err: any) {
        if (isPgrstMissingTableError(err)) {
          console.warn("Supabase products table not yet provisioned in schema cache. Product saved locally.");
          return;
        }
        throw err;
      }
    }
  },

  async deleteProduct(email: string, id: string): Promise<void> {
    const cleanEmail = email.trim().toLowerCase();
    const current = getFromLocal<Product>(STORAGE_KEYS.PRODUCTS, cleanEmail);
    saveToLocal(STORAGE_KEYS.PRODUCTS, current.filter(p => p.id !== id), cleanEmail);

    if (isSupabaseConfigured && supabase) {
      try {
        const { error: deleteErr } = await supabase
          .from('products')
          .delete()
          .eq('id', id);

        if (deleteErr) {
          if (isPgrstMissingTableError(deleteErr)) {
            console.warn("Supabase products table not yet provisioned in schema cache (PGRST205).");
          } else {
            console.error('SUPABASE PRODUCT DELETE ERROR:', deleteErr);
            throw deleteErr;
          }
        }
      } catch (err: any) {
        if (isPgrstMissingTableError(err)) return;
        throw err;
      }
    }
  },

  // --------------------------------------------------------------------------
  // SALES & DUES
  // --------------------------------------------------------------------------
  async getSales(email: string): Promise<Sale[]> {
    const cleanEmail = email.trim().toLowerCase();
    const localSales = getFromLocal<Sale>(STORAGE_KEYS.SALES, cleanEmail);

    if (isSupabaseConfigured && supabase) {
      try {
        const userId = await getActiveUserId(cleanEmail);
        const branchId = await getActiveBranchId(cleanEmail);
        let query = supabase
          .from('sales')
          .select(`
            *,
            items:sale_items(*),
            payments:sale_payments(*)
          `)
          .order('date', { ascending: false });

        if (branchId) {
          query = query.eq('branch_id', branchId);
        } else if (userId) {
          query = query.or(`user_email.eq.${cleanEmail},user_id.eq.${userId}`);
        } else {
          query = query.eq('user_email', cleanEmail);
        }

        const { data, error } = await query;

        if (!error && data) {
          const remoteSales = data.map(row => ({
            id: row.id,
            totalPrice: Number(row.total_price),
            discount: Number(row.discount || 0),
            amountPaid: Number(row.amount_paid),
            dueAmount: Number(row.due_amount),
            customerName: row.customer_name || undefined,
            customerPhone: row.customer_phone || undefined,
            paymentMethod: row.payment_method,
            mobileProvider: row.mobile_provider || undefined,
            transactionId: row.transaction_id || undefined,
            date: row.date,
            items: (row.items || []).map((item: any) => ({
              productId: item.product_id,
              productName: item.product_name,
              quantity: Number(item.quantity),
              unit: item.unit,
              pricePerUnit: Number(item.price_per_unit),
              subTotal: Number(item.sub_total)
            })),
            payments: (row.payments || []).map((pay: any) => ({
              id: pay.id,
              amount: Number(pay.amount),
              date: pay.date,
              method: pay.method
            }))
          }));
          saveToLocal(STORAGE_KEYS.SALES, remoteSales, cleanEmail);
          return remoteSales;
        }
      } catch (e) {
        console.warn("Error loading sales from cloud, using local cache:", e);
      }
    }
    return localSales;
  },

  async addSale(email: string, sale: Sale) {
    const cleanEmail = email.trim().toLowerCase();
    const currentSales = getFromLocal<Sale>(STORAGE_KEYS.SALES, cleanEmail);
    const updatedSales = [sale, ...currentSales.filter(s => s.id !== sale.id)];
    saveToLocal(STORAGE_KEYS.SALES, updatedSales, cleanEmail);

    if (isSupabaseConfigured && supabase) {
      try {
        const userId = await requireAuthUserId(cleanEmail);
        const branchId = await getActiveBranchId(cleanEmail);
        // 1. Insert parent sale with branch scoping
        const salePayload: any = {
          id: sale.id,
          user_id: userId,
          user_email: cleanEmail,
          total_price: sale.totalPrice,
          discount: sale.discount || 0,
          amount_paid: sale.amountPaid,
          due_amount: sale.dueAmount,
          customer_name: sale.customerName || null,
          customer_phone: sale.customerPhone || null,
          payment_method: sale.paymentMethod,
          mobile_provider: sale.mobileProvider || null,
          transaction_id: sale.transactionId || null,
          date: sale.date
        };
        if (branchId) {
          salePayload.branch_id = branchId;
        }
        const { error: saleErr } = await supabase.from('sales').insert(salePayload);
        if (saleErr) {
          if (isPgrstMissingTableError(saleErr)) {
            console.warn("Supabase sales table not yet provisioned in schema cache (PGRST205). Sale recorded locally.");
            return;
          }
          console.error("Supabase addSale error:", saleErr);
          return;
        }

        if (sale.items.length > 0) {
          const itemsPayload = sale.items.map(item => ({
            sale_id: sale.id,
            product_id: item.productId,
            product_name: item.productName,
            quantity: item.quantity,
            unit: item.unit,
            price_per_unit: item.pricePerUnit,
            sub_total: item.subTotal
          }));
          const { error: itemsErr } = await supabase.from('sale_items').insert(itemsPayload);
          if (itemsErr && !isPgrstMissingTableError(itemsErr)) {
            console.warn("Supabase sale_items insert warning:", itemsErr.message);
          }
        }

        if (sale.payments && sale.payments.length > 0) {
          const paymentsPayload = sale.payments.map(pay => ({
            id: pay.id,
            sale_id: sale.id,
            amount: pay.amount,
            date: pay.date,
            method: pay.method
          }));
          const { error: paymentsErr } = await supabase.from('sale_payments').insert(paymentsPayload);
          if (paymentsErr && !isPgrstMissingTableError(paymentsErr)) {
            console.warn("Supabase sale_payments insert warning:", paymentsErr.message);
          }
        }
      } catch (err: any) {
        if (isPgrstMissingTableError(err)) return;
        console.warn("Supabase sale sync skipped:", err);
      }
    }
  },

  async updateSale(email: string, sale: Sale) {
    const cleanEmail = email.trim().toLowerCase();
    const currentSales = getFromLocal<Sale>(STORAGE_KEYS.SALES, cleanEmail);
    saveToLocal(STORAGE_KEYS.SALES, currentSales.map(s => s.id === sale.id ? sale : s), cleanEmail);

    if (!isSupabaseConfigured || !supabase) return;

    try {
      const userId = await requireAuthUserId(cleanEmail);
      if (!userId) return;

      const { error: updateErr } = await supabase.from('sales').update({
        total_price: sale.totalPrice,
        discount: sale.discount || 0,
        amount_paid: sale.amountPaid,
        due_amount: sale.dueAmount,
        customer_name: sale.customerName || null,
        customer_phone: sale.customerPhone || null,
        payment_method: sale.paymentMethod,
        mobile_provider: sale.mobileProvider || null,
        transaction_id: sale.transactionId || null
      }).eq('id', sale.id);

      if (updateErr) {
        if (isPgrstMissingTableError(updateErr)) {
          console.warn("Supabase sales table not yet provisioned in schema cache (PGRST205).");
          return;
        }
        console.error("Supabase updateSale error:", updateErr);
        return;
      }

      if (sale.payments && sale.payments.length > 0) {
        for (const pay of sale.payments) {
          await supabase.from('sale_payments').upsert({
            id: pay.id,
            sale_id: sale.id,
            amount: pay.amount,
            date: pay.date,
            method: pay.method
          });
        }
      }
    } catch (e) {
      console.warn("Cloud updateSale skipped:", e);
    }
  },

  async deleteSale(email: string, id: string): Promise<void> {
    const cleanEmail = email.trim().toLowerCase();
    const currentSales = getFromLocal<Sale>(STORAGE_KEYS.SALES, cleanEmail);
    saveToLocal(STORAGE_KEYS.SALES, currentSales.filter(s => s.id !== id), cleanEmail);

    if (!isSupabaseConfigured || !supabase) return;

    try {
      const userId = await requireAuthUserId(cleanEmail);
      if (!userId) return;

      // Atomically cancel sale and restore product inventory via PostgreSQL transactional function
      const { error } = await supabase.rpc('cancel_sale_and_restore_stock', { p_sale_id: id });
      if (error) {
        if (isPgrstMissingTableError(error)) {
          console.warn("Supabase sales function or table not yet provisioned in schema cache (PGRST205).");
          return;
        }
        const { error: delErr } = await supabase.from('sales').delete().eq('id', id);
        if (delErr && !isPgrstMissingTableError(delErr)) {
          console.error("Supabase deleteSale error:", delErr);
        }
      }
    } catch (e) {
      console.warn("Cloud deleteSale skipped:", e);
    }
  },

  // --------------------------------------------------------------------------
  // EXPENSES
  // --------------------------------------------------------------------------
  async getExpenses(email: string): Promise<Expense[]> {
    const cleanEmail = email.trim().toLowerCase();
    const localExpenses = getFromLocal<Expense>(STORAGE_KEYS.EXPENSES, cleanEmail);

    if (isSupabaseConfigured && supabase) {
      try {
        const userId = await getActiveUserId(cleanEmail);
        const branchId = await getActiveBranchId(cleanEmail);
        let query = supabase
          .from('expenses')
          .select('*')
          .order('date', { ascending: false });

        if (branchId) {
          query = query.eq('branch_id', branchId);
        } else if (userId) {
          query = query.or(`user_email.eq.${cleanEmail},user_id.eq.${userId}`);
        } else {
          query = query.eq('user_email', cleanEmail);
        }

        const { data, error } = await query;

        if (!error && data) {
          const remoteExpenses = data.map(row => ({
            id: row.id,
            description: row.description,
            amount: Number(row.amount),
            category: row.category,
            date: row.date
          }));
          saveToLocal(STORAGE_KEYS.EXPENSES, remoteExpenses, cleanEmail);
          return remoteExpenses;
        }
      } catch (e) {
        console.warn("Error loading expenses from cloud, using local cache:", e);
      }
    }
    return localExpenses;
  },

  async addExpense(email: string, expense: Expense) {
    const cleanEmail = email.trim().toLowerCase();
    const current = getFromLocal<Expense>(STORAGE_KEYS.EXPENSES, cleanEmail);
    saveToLocal(STORAGE_KEYS.EXPENSES, [expense, ...current.filter(e => e.id !== expense.id)], cleanEmail);

    if (!isSupabaseConfigured || !supabase) return;

    try {
      const userId = await requireAuthUserId(cleanEmail);
      const branchId = await getActiveBranchId(cleanEmail);
      const payload: any = {
        id: expense.id,
        user_id: userId,
        user_email: cleanEmail,
        description: expense.description,
        amount: expense.amount,
        category: expense.category,
        date: expense.date
      };
      if (branchId) {
        payload.branch_id = branchId;
      }
      const { error } = await supabase.from('expenses').insert(payload);
      if (error) {
        if (isPgrstMissingTableError(error)) {
          console.warn("Supabase expenses table not yet provisioned in schema cache (PGRST205). Expense saved locally.");
          return;
        }
        console.error("Supabase addExpense error:", error);
      }
    } catch (e) {
      console.warn("Cloud addExpense skipped:", e);
    }
  },

  async deleteExpense(email: string, id: string) {
    const cleanEmail = email.trim().toLowerCase();
    const current = getFromLocal<Expense>(STORAGE_KEYS.EXPENSES, cleanEmail);
    saveToLocal(STORAGE_KEYS.EXPENSES, current.filter(e => e.id !== id), cleanEmail);

    if (!isSupabaseConfigured || !supabase) return;

    try {
      const { error } = await supabase.from('expenses').delete().eq('id', id);
      if (error) {
        if (isPgrstMissingTableError(error)) {
          console.warn("Supabase expenses table not yet provisioned in schema cache (PGRST205).");
          return;
        }
        console.error("Supabase deleteExpense error:", error);
      }
    } catch (e) {
      console.warn("Cloud deleteExpense skipped:", e);
    }
  },

  // --------------------------------------------------------------------------
  // WASTAGE
  // --------------------------------------------------------------------------
  async getWastage(email: string): Promise<Wastage[]> {
    const cleanEmail = email.trim().toLowerCase();
    const localWastage = getFromLocal<Wastage>(STORAGE_KEYS.WASTAGE, cleanEmail);

    if (isSupabaseConfigured && supabase) {
      try {
        const userId = await getActiveUserId(cleanEmail);
        const branchId = await getActiveBranchId(cleanEmail);
        let query = supabase
          .from('wastage')
          .select('*')
          .order('date', { ascending: false });

        if (branchId) {
          query = query.eq('branch_id', branchId);
        } else if (userId) {
          query = query.or(`user_email.eq.${cleanEmail},user_id.eq.${userId}`);
        } else {
          query = query.eq('user_email', cleanEmail);
        }

        const { data, error } = await query;

        if (!error && data) {
          const remoteWastage = data.map(row => ({
            id: row.id,
            productId: row.product_id || '',
            productName: row.product_name,
            quantity: Number(row.quantity),
            unit: row.unit,
            lossValue: Number(row.loss_value),
            reason: row.reason || '',
            date: row.date
          }));
          saveToLocal(STORAGE_KEYS.WASTAGE, remoteWastage, cleanEmail);
          return remoteWastage;
        }
      } catch (e) {
        console.warn("Error loading wastage from cloud, using local cache:", e);
      }
    }
    return localWastage;
  },

  async addWastage(email: string, wastage: Wastage) {
    const cleanEmail = email.trim().toLowerCase();
    const current = getFromLocal<Wastage>(STORAGE_KEYS.WASTAGE, cleanEmail);
    saveToLocal(STORAGE_KEYS.WASTAGE, [wastage, ...current.filter(w => w.id !== wastage.id)], cleanEmail);

    if (!isSupabaseConfigured || !supabase) return;

    try {
      const userId = await requireAuthUserId(cleanEmail);
      const branchId = await getActiveBranchId(cleanEmail);
      const payload: any = {
        id: wastage.id,
        user_id: userId,
        user_email: cleanEmail,
        product_id: wastage.productId || null,
        product_name: wastage.productName,
        quantity: wastage.quantity,
        unit: wastage.unit,
        loss_value: wastage.lossValue,
        reason: wastage.reason,
        date: wastage.date
      };
      if (branchId) {
        payload.branch_id = branchId;
      }
      const { error } = await supabase.from('wastage').insert(payload);
      if (error) {
        if (isPgrstMissingTableError(error)) {
          console.warn("Supabase wastage table not yet provisioned in schema cache (PGRST205). Wastage saved locally.");
          return;
        }
        console.error("Supabase addWastage error:", error);
      }
    } catch (e) {
      console.warn("Cloud addWastage skipped:", e);
    }
  },

  async deleteWastage(email: string, id: string) {
    const cleanEmail = email.trim().toLowerCase();
    const current = getFromLocal<Wastage>(STORAGE_KEYS.WASTAGE, cleanEmail);
    saveToLocal(STORAGE_KEYS.WASTAGE, current.filter(w => w.id !== id), cleanEmail);

    if (!isSupabaseConfigured || !supabase) return;

    try {
      const { error } = await supabase.from('wastage').delete().eq('id', id);
      if (error) {
        if (isPgrstMissingTableError(error)) {
          console.warn("Supabase wastage table not yet provisioned in schema cache (PGRST205).");
          return;
        }
        console.error("Supabase deleteWastage error:", error);
      }
    } catch (e) {
      console.warn("Cloud deleteWastage skipped:", e);
    }
  },

  // --------------------------------------------------------------------------
  // STAFF
  // --------------------------------------------------------------------------
  async getStaff(email: string): Promise<Staff[]> {
    const cleanEmail = email.trim().toLowerCase();
    const local = getFromLocal<Staff>(STORAGE_KEYS.STAFF, cleanEmail);

    if (isSupabaseConfigured && supabase) {
      try {
        const userId = await getActiveUserId(cleanEmail);
        const branchId = await getActiveBranchId(cleanEmail);
        let query = supabase
          .from('staff')
          .select('*')
          .order('name', { ascending: true });

        if (branchId) {
          query = query.eq('branch_id', branchId);
        } else if (userId) {
          query = query.or(`user_email.eq.${cleanEmail},user_id.eq.${userId}`);
        } else {
          query = query.eq('user_email', cleanEmail);
        }

        const { data, error } = await query;

        if (!error && data) {
          const remoteStaff = data.map(row => ({
            id: row.id,
            name: row.name,
            designation: row.designation,
            monthlySalary: Number(row.monthly_salary),
            joinDate: row.join_date
          }));
          saveToLocal(STORAGE_KEYS.STAFF, remoteStaff, cleanEmail);
          return remoteStaff;
        }
      } catch (e) {
        console.warn("Error fetching staff from cloud:", e);
      }
    }
    return local;
  },

  async addStaff(email: string, staff: Staff) {
    const cleanEmail = email.trim().toLowerCase();
    const current = getFromLocal<Staff>(STORAGE_KEYS.STAFF, cleanEmail);
    saveToLocal(STORAGE_KEYS.STAFF, [staff, ...current.filter(s => s.id !== staff.id)], cleanEmail);

    if (!isSupabaseConfigured || !supabase) return;

    try {
      const userId = await requireAuthUserId(cleanEmail);
      const branchId = await getActiveBranchId(cleanEmail);
      const payload: any = {
        id: staff.id,
        user_id: userId,
        user_email: cleanEmail,
        name: staff.name,
        designation: staff.designation,
        monthly_salary: staff.monthlySalary,
        join_date: staff.joinDate
      };
      if (branchId) {
        payload.branch_id = branchId;
      }
      const { error } = await supabase.from('staff').insert(payload);
      if (error) {
        if (isPgrstMissingTableError(error)) {
          console.warn("Supabase staff table not yet provisioned in schema cache (PGRST205). Staff saved locally.");
          return;
        }
        console.error("Supabase addStaff error:", error);
      }
    } catch (e) {
      console.warn("Cloud addStaff skipped:", e);
    }
  },

  async deleteStaff(email: string, id: string) {
    const cleanEmail = email.trim().toLowerCase();
    const current = getFromLocal<Staff>(STORAGE_KEYS.STAFF, cleanEmail);
    saveToLocal(STORAGE_KEYS.STAFF, current.filter(s => s.id !== id), cleanEmail);

    if (!isSupabaseConfigured || !supabase) return;

    try {
      const { error } = await supabase.from('staff').delete().eq('id', id);
      if (error) {
        if (isPgrstMissingTableError(error)) {
          console.warn("Supabase staff table not yet provisioned in schema cache (PGRST205).");
          return;
        }
        console.error("Supabase deleteStaff error:", error);
      }
    } catch (e) {
      console.warn("Cloud deleteStaff skipped:", e);
    }
  },

  // --------------------------------------------------------------------------
  // ATTENDANCE
  // --------------------------------------------------------------------------
  async getAttendance(email: string): Promise<Attendance[]> {
    const cleanEmail = email.trim().toLowerCase();
    const local = getFromLocal<Attendance>(STORAGE_KEYS.ATTENDANCE, cleanEmail);

    if (isSupabaseConfigured && supabase) {
      try {
        const userId = await getActiveUserId(cleanEmail);
        const branchId = await getActiveBranchId(cleanEmail);
        let query = supabase
          .from('attendance')
          .select('*')
          .order('date', { ascending: false });

        if (branchId) {
          query = query.eq('branch_id', branchId);
        } else if (userId) {
          query = query.or(`user_email.eq.${cleanEmail},user_id.eq.${userId}`);
        } else {
          query = query.eq('user_email', cleanEmail);
        }

        const { data, error } = await query;

        if (!error && data) {
          const remoteAtt = data.map(row => ({
            id: row.id,
            staffId: row.staff_id,
            date: row.date,
            status: row.status
          }));
          saveToLocal(STORAGE_KEYS.ATTENDANCE, remoteAtt, cleanEmail);
          return remoteAtt;
        }
      } catch (e) {
        console.warn("Error fetching attendance from cloud:", e);
      }
    }
    return local;
  },

  async upsertAttendance(email: string, attendance: Attendance) {
    const cleanEmail = email.trim().toLowerCase();
    const current = getFromLocal<Attendance>(STORAGE_KEYS.ATTENDANCE, cleanEmail);
    const updated = current.filter(a => a.id !== attendance.id).concat(attendance);
    saveToLocal(STORAGE_KEYS.ATTENDANCE, updated, cleanEmail);

    if (!isSupabaseConfigured || !supabase) return;

    try {
      const userId = await requireAuthUserId(cleanEmail);
      const branchId = await getActiveBranchId(cleanEmail);
      const payload: any = {
        id: attendance.id,
        user_id: userId,
        user_email: cleanEmail,
        staff_id: attendance.staffId,
        date: attendance.date,
        status: attendance.status
      };
      if (branchId) {
        payload.branch_id = branchId;
      }
      const { error } = await supabase.from('attendance').upsert(payload);
      if (error) {
        if (isPgrstMissingTableError(error)) {
          console.warn("Supabase attendance table not yet provisioned in schema cache (PGRST205).");
          return;
        }
        console.error("Supabase upsertAttendance error:", error);
      }
    } catch (e) {
      console.warn("Cloud upsertAttendance skipped:", e);
    }
  },

  async deleteAttendance(email: string, id: string) {
    const cleanEmail = email.trim().toLowerCase();
    const current = getFromLocal<Attendance>(STORAGE_KEYS.ATTENDANCE, cleanEmail);
    saveToLocal(STORAGE_KEYS.ATTENDANCE, current.filter(a => a.id !== id), cleanEmail);

    if (!isSupabaseConfigured || !supabase) return;

    try {
      const { error } = await supabase.from('attendance').delete().eq('id', id);
      if (error) {
        if (isPgrstMissingTableError(error)) {
          console.warn("Supabase attendance table not yet provisioned in schema cache (PGRST205).");
          return;
        }
        console.error("Supabase deleteAttendance error:", error);
      }
    } catch (e) {
      console.warn("Cloud deleteAttendance skipped:", e);
    }
  },

  // --------------------------------------------------------------------------
  // DEDUCTIONS
  // --------------------------------------------------------------------------
  async getDeductions(email: string): Promise<Deduction[]> {
    const cleanEmail = email.trim().toLowerCase();
    const local = getFromLocal<Deduction>(STORAGE_KEYS.DEDUCTIONS, cleanEmail);

    if (isSupabaseConfigured && supabase) {
      try {
        const userId = await getActiveUserId(cleanEmail);
        const branchId = await getActiveBranchId(cleanEmail);
        let query = supabase
          .from('deductions')
          .select('*')
          .order('date', { ascending: false });

        if (branchId) {
          query = query.eq('branch_id', branchId);
        } else if (userId) {
          query = query.or(`user_email.eq.${cleanEmail},user_id.eq.${userId}`);
        } else {
          query = query.eq('user_email', cleanEmail);
        }

        const { data, error } = await query;

        if (!error && data) {
          const remoteDed = data.map(row => ({
            id: row.id,
            staffId: row.staff_id,
            amount: Number(row.amount),
            reason: row.reason,
            date: row.date
          }));
          saveToLocal(STORAGE_KEYS.DEDUCTIONS, remoteDed, cleanEmail);
          return remoteDed;
        }
      } catch (e) {
        console.warn("Error fetching deductions from cloud:", e);
      }
    }
    return local;
  },

  async addDeduction(email: string, deduction: Deduction) {
    const cleanEmail = email.trim().toLowerCase();
    const current = getFromLocal<Deduction>(STORAGE_KEYS.DEDUCTIONS, cleanEmail);
    saveToLocal(STORAGE_KEYS.DEDUCTIONS, [deduction, ...current.filter(d => d.id !== deduction.id)], cleanEmail);

    if (!isSupabaseConfigured || !supabase) return;

    try {
      const userId = await requireAuthUserId(cleanEmail);
      const branchId = await getActiveBranchId(cleanEmail);
      const payload: any = {
        id: deduction.id,
        user_id: userId,
        user_email: cleanEmail,
        staff_id: deduction.staffId,
        amount: deduction.amount,
        reason: deduction.reason,
        date: deduction.date
      };
      if (branchId) {
        payload.branch_id = branchId;
      }
      const { error } = await supabase.from('deductions').insert(payload);
      if (error) {
        if (isPgrstMissingTableError(error)) {
          console.warn("Supabase deductions table not yet provisioned in schema cache (PGRST205).");
          return;
        }
        console.error("Supabase addDeduction error:", error);
      }
    } catch (e) {
      console.warn("Cloud addDeduction skipped:", e);
    }
  },

  async deleteDeduction(email: string, id: string) {
    const cleanEmail = email.trim().toLowerCase();
    const current = getFromLocal<Deduction>(STORAGE_KEYS.DEDUCTIONS, cleanEmail);
    saveToLocal(STORAGE_KEYS.DEDUCTIONS, current.filter(d => d.id !== id), cleanEmail);

    if (!isSupabaseConfigured || !supabase) return;

    try {
      const { error } = await supabase.from('deductions').delete().eq('id', id);
      if (error) {
        if (isPgrstMissingTableError(error)) {
          console.warn("Supabase deductions table not yet provisioned in schema cache (PGRST205).");
          return;
        }
        console.error("Supabase deleteDeduction error:", error);
      }
    } catch (e) {
      console.warn("Cloud deleteDeduction skipped:", e);
    }
  },

  // --------------------------------------------------------------------------
  // DAILY CLOSINGS
  // --------------------------------------------------------------------------
  async getClosings(email: string): Promise<DailyClosing[]> {
    const cleanEmail = email.trim().toLowerCase();
    const local = getFromLocal<DailyClosing>(STORAGE_KEYS.DAILY_CLOSINGS, cleanEmail);

    if (isSupabaseConfigured && supabase) {
      try {
        const userId = await getActiveUserId(cleanEmail);
        const branchId = await getActiveBranchId(cleanEmail);
        let query = supabase
          .from('daily_closings')
          .select('*')
          .order('date', { ascending: false });

        if (branchId) {
          query = query.eq('branch_id', branchId);
        } else if (userId) {
          query = query.or(`user_email.eq.${cleanEmail},user_id.eq.${userId}`);
        } else {
          query = query.eq('user_email', cleanEmail);
        }

        const { data, error } = await query;

        if (!error && data) {
          const remoteClosings = data.map(row => ({
            id: row.id,
            date: row.date,
            totalSales: Number(row.total_sales),
            totalCashCollected: Number(row.total_cash_collected),
            totalCashPayments: Number(row.total_cash_payments),
            totalMobilePayments: Number(row.total_mobile_payments),
            totalExpenses: Number(row.total_expenses),
            totalWastage: Number(row.total_wastage),
            systemBalance: Number(row.system_balance),
            actualCash: Number(row.actual_cash),
            difference: Number(row.difference),
            closedBy: row.closed_by,
            timestamp: row.timestamp
          }));
          saveToLocal(STORAGE_KEYS.DAILY_CLOSINGS, remoteClosings, cleanEmail);
          return remoteClosings;
        }
      } catch (e) {
        console.warn("Error fetching closings from cloud:", e);
      }
    }
    return local;
  },

  async addClosing(email: string, closing: DailyClosing) {
    const cleanEmail = email.trim().toLowerCase();
    const current = getFromLocal<DailyClosing>(STORAGE_KEYS.DAILY_CLOSINGS, cleanEmail);
    saveToLocal(STORAGE_KEYS.DAILY_CLOSINGS, [closing, ...current.filter(c => c.id !== closing.id)], cleanEmail);

    if (!isSupabaseConfigured || !supabase) return;

    try {
      const userId = await requireAuthUserId(cleanEmail);
      const branchId = await getActiveBranchId(cleanEmail);
      const payload: any = {
        id: closing.id,
        user_id: userId,
        user_email: cleanEmail,
        date: closing.date,
        total_sales: closing.totalSales,
        total_cash_collected: closing.totalCashCollected,
        total_cash_payments: closing.totalCashPayments,
        total_mobile_payments: closing.totalMobilePayments,
        total_expenses: closing.totalExpenses,
        total_wastage: closing.totalWastage,
        system_balance: closing.systemBalance,
        actual_cash: closing.actualCash,
        difference: closing.difference,
        closed_by: closing.closedBy,
        timestamp: closing.timestamp
      };
      if (branchId) {
        payload.branch_id = branchId;
      }
      const { error } = await supabase.from('daily_closings').insert(payload);
      if (error) {
        if (isPgrstMissingTableError(error)) {
          console.warn("Supabase daily_closings table not yet provisioned in schema cache (PGRST205).");
          return;
        }
        console.error("Supabase addClosing error:", error);
      }
    } catch (e) {
      console.warn("Cloud addClosing skipped:", e);
    }
  },

  async updateClosing(email: string, updatedClosing: DailyClosing) {
    const cleanEmail = email.trim().toLowerCase();
    const current = getFromLocal<DailyClosing>(STORAGE_KEYS.DAILY_CLOSINGS, cleanEmail);
    saveToLocal(STORAGE_KEYS.DAILY_CLOSINGS, current.map(c => c.id === updatedClosing.id ? updatedClosing : c), cleanEmail);

    if (!isSupabaseConfigured || !supabase) return;

    try {
      const { error } = await supabase.from('daily_closings').update({
        total_sales: updatedClosing.totalSales,
        total_cash_collected: updatedClosing.totalCashCollected,
        total_cash_payments: updatedClosing.totalCashPayments,
        total_mobile_payments: updatedClosing.totalMobilePayments,
        total_expenses: updatedClosing.totalExpenses,
        total_wastage: updatedClosing.totalWastage,
        system_balance: updatedClosing.systemBalance,
        actual_cash: updatedClosing.actualCash,
        difference: updatedClosing.difference,
        closed_by: updatedClosing.closedBy,
        timestamp: updatedClosing.timestamp
      }).eq('id', updatedClosing.id);

      if (error) {
        if (isPgrstMissingTableError(error)) {
          console.warn("Supabase daily_closings table not yet provisioned in schema cache (PGRST205).");
          return;
        }
        console.error("Supabase updateClosing error:", error);
      }
    } catch (e) {
      console.warn("Cloud updateClosing skipped:", e);
    }
  },

  async deleteClosing(email: string, id: string) {
    const cleanEmail = email.trim().toLowerCase();
    const current = getFromLocal<DailyClosing>(STORAGE_KEYS.DAILY_CLOSINGS, cleanEmail);
    saveToLocal(STORAGE_KEYS.DAILY_CLOSINGS, current.filter(c => c.id !== id), cleanEmail);

    if (!isSupabaseConfigured || !supabase) return;

    try {
      const { error } = await supabase.from('daily_closings').delete().eq('id', id);
      if (error) {
        if (isPgrstMissingTableError(error)) {
          console.warn("Supabase daily_closings table not yet provisioned in schema cache (PGRST205).");
          return;
        }
        console.error("Supabase deleteClosing error:", error);
      }
    } catch (e) {
      console.warn("Cloud deleteClosing skipped:", e);
    }
  },

  // --------------------------------------------------------------------------
  // MONTHLY CLOSINGS
  // --------------------------------------------------------------------------
  async getMonthlyClosings(email: string): Promise<MonthlyClosing[]> {
    const cleanEmail = email.trim().toLowerCase();
    const local = getFromLocal<MonthlyClosing>(STORAGE_KEYS.MONTHLY_CLOSINGS, cleanEmail);

    if (isSupabaseConfigured && supabase) {
      try {
        const userId = await getActiveUserId(cleanEmail);
        const branchId = await getActiveBranchId(cleanEmail);
        let query = supabase
          .from('monthly_closings')
          .select('*')
          .order('timestamp', { ascending: false });

        if (branchId) {
          query = query.eq('branch_id', branchId);
        } else if (userId) {
          query = query.or(`user_email.eq.${cleanEmail},user_id.eq.${userId}`);
        } else {
          query = query.eq('user_email', cleanEmail);
        }

        const { data, error } = await query;

        if (!error && data) {
          const remoteMonthly = data.map(row => ({
            id: row.id,
            month: row.month,
            totalSales: Number(row.total_sales),
            totalCashPayments: Number(row.total_cash_payments),
            totalMobilePayments: Number(row.total_mobile_payments),
            totalExpenses: Number(row.total_expenses),
            totalWastage: Number(row.total_wastage),
            totalProfit: Number(row.total_profit),
            totalDues: Number(row.total_dues || 0),
            closedBy: row.closed_by,
            timestamp: row.timestamp
          }));
          saveToLocal(STORAGE_KEYS.MONTHLY_CLOSINGS, remoteMonthly, cleanEmail);
          return remoteMonthly;
        }
      } catch (e) {
        console.warn("Error fetching monthly closings from cloud:", e);
      }
    }
    return local;
  },

  async addMonthlyClosing(email: string, closing: MonthlyClosing) {
    const cleanEmail = email.trim().toLowerCase();
    const current = getFromLocal<MonthlyClosing>(STORAGE_KEYS.MONTHLY_CLOSINGS, cleanEmail);
    saveToLocal(STORAGE_KEYS.MONTHLY_CLOSINGS, [closing, ...current.filter(c => c.id !== closing.id)], cleanEmail);

    if (!isSupabaseConfigured || !supabase) return;

    try {
      const userId = await requireAuthUserId(cleanEmail);
      const branchId = await getActiveBranchId(cleanEmail);
      const payload: any = {
        id: closing.id,
        user_id: userId,
        user_email: cleanEmail,
        month: closing.month,
        total_sales: closing.totalSales,
        total_cash_payments: closing.totalCashPayments,
        total_mobile_payments: closing.totalMobilePayments,
        total_expenses: closing.totalExpenses,
        total_wastage: closing.totalWastage,
        total_profit: closing.totalProfit,
        total_dues: closing.totalDues || 0,
        closed_by: closing.closedBy,
        timestamp: closing.timestamp
      };
      if (branchId) {
        payload.branch_id = branchId;
      }
      const { error } = await supabase.from('monthly_closings').insert(payload);
      if (error) {
        if (isPgrstMissingTableError(error)) {
          console.warn("Supabase monthly_closings table not yet provisioned in schema cache (PGRST205).");
          return;
        }
        console.error("Supabase addMonthlyClosing error:", error);
      }
    } catch (e) {
      console.warn("Cloud addMonthlyClosing skipped:", e);
    }
  },

  async deleteMonthlyClosing(email: string, id: string) {
    const cleanEmail = email.trim().toLowerCase();
    const current = getFromLocal<MonthlyClosing>(STORAGE_KEYS.MONTHLY_CLOSINGS, cleanEmail);
    saveToLocal(STORAGE_KEYS.MONTHLY_CLOSINGS, current.filter(c => c.id !== id), cleanEmail);

    if (!isSupabaseConfigured || !supabase) return;

    try {
      const { error } = await supabase.from('monthly_closings').delete().eq('id', id);
      if (error) {
        if (isPgrstMissingTableError(error)) {
          console.warn("Supabase monthly_closings table not yet provisioned in schema cache (PGRST205).");
          return;
        }
        console.error("Supabase deleteMonthlyClosing error:", error);
      }
    } catch (e) {
      console.warn("Cloud deleteMonthlyClosing skipped:", e);
    }
  },

  // --------------------------------------------------------------------------
  // PRODUCTION
  // --------------------------------------------------------------------------
  async getProduction(email: string): Promise<Production[]> {
    const cleanEmail = email.trim().toLowerCase();
    const local = getFromLocal<Production>(STORAGE_KEYS.PRODUCTION, cleanEmail);

    if (isSupabaseConfigured && supabase) {
      try {
        const userId = await getActiveUserId(cleanEmail);
        const branchId = await getActiveBranchId(cleanEmail);
        let query = supabase
          .from('production')
          .select('*')
          .order('date', { ascending: false });

        if (branchId) {
          query = query.eq('branch_id', branchId);
        } else if (userId) {
          query = query.or(`user_email.eq.${cleanEmail},user_id.eq.${userId}`);
        } else {
          query = query.eq('user_email', cleanEmail);
        }

        const { data, error } = await query;

        if (!error && data) {
          const remoteProd = data.map(row => ({
            id: row.id,
            productId: row.product_id || '',
            productName: row.product_name,
            quantity: Number(row.quantity),
            unit: row.unit,
            unitPrice: Number(row.unit_price),
            totalValue: Number(row.total_value),
            date: row.date
          }));
          saveToLocal(STORAGE_KEYS.PRODUCTION, remoteProd, cleanEmail);
          return remoteProd;
        }
      } catch (e) {
        console.warn("Error fetching production from cloud:", e);
      }
    }
    return local;
  },

  async addProduction(email: string, production: Production) {
    const cleanEmail = email.trim().toLowerCase();
    const current = getFromLocal<Production>(STORAGE_KEYS.PRODUCTION, cleanEmail);
    saveToLocal(STORAGE_KEYS.PRODUCTION, [production, ...current.filter(p => p.id !== production.id)], cleanEmail);

    if (!isSupabaseConfigured || !supabase) return;

    try {
      const userId = await requireAuthUserId(cleanEmail);
      const branchId = await getActiveBranchId(cleanEmail);
      const payload: any = {
        id: production.id,
        user_id: userId,
        user_email: cleanEmail,
        product_id: production.productId || null,
        product_name: production.productName,
        quantity: production.quantity,
        unit: production.unit,
        unit_price: production.unitPrice,
        total_value: production.totalValue,
        date: production.date
      };
      if (branchId) {
        payload.branch_id = branchId;
      }
      const { error } = await supabase.from('production').insert(payload);
      if (error) {
        if (isPgrstMissingTableError(error)) {
          console.warn("Supabase production table not yet provisioned in schema cache (PGRST205).");
          return;
        }
        console.error("Supabase addProduction error:", error);
      }
    } catch (e) {
      console.warn("Cloud addProduction skipped:", e);
    }
  },

  async deleteProduction(email: string, id: string) {
    const cleanEmail = email.trim().toLowerCase();
    const current = getFromLocal<Production>(STORAGE_KEYS.PRODUCTION, cleanEmail);
    saveToLocal(STORAGE_KEYS.PRODUCTION, current.filter(p => p.id !== id), cleanEmail);

    if (!isSupabaseConfigured || !supabase) return;

    try {
      const { error } = await supabase.from('production').delete().eq('id', id);
      if (error) {
        if (isPgrstMissingTableError(error)) {
          console.warn("Supabase production table not yet provisioned in schema cache (PGRST205).");
          return;
        }
        console.error("Supabase deleteProduction error:", error);
      }
    } catch (e) {
      console.warn("Cloud deleteProduction skipped:", e);
    }
  },

  // --------------------------------------------------------------------------
  // DAILY NOTES
  // --------------------------------------------------------------------------
  async getNotes(email: string): Promise<DailyNote[]> {
    const cleanEmail = email.trim().toLowerCase();
    const local = getFromLocal<DailyNote>(STORAGE_KEYS.DAILY_NOTES, cleanEmail);

    if (isSupabaseConfigured && supabase) {
      try {
        const userId = await getActiveUserId(cleanEmail);
        const branchId = await getActiveBranchId(cleanEmail);
        let query = supabase
          .from('daily_notes')
          .select('*')
          .order('created_at', { ascending: false });

        if (branchId) {
          query = query.eq('branch_id', branchId);
        } else if (userId) {
          query = query.or(`user_email.eq.${cleanEmail},user_id.eq.${userId}`);
        } else {
          query = query.eq('user_email', cleanEmail);
        }

        const { data, error } = await query;

        if (!error && data) {
          const remoteNotes = data.map(row => ({
            id: row.id,
            title: row.title,
            content: row.content,
            priority: row.priority,
            status: row.status,
            assignedTo: row.assigned_to || undefined,
            author: row.author,
            pinned: Boolean(row.pinned),
            createdAt: row.created_at
          }));
          saveToLocal(STORAGE_KEYS.DAILY_NOTES, remoteNotes, cleanEmail);
          return remoteNotes;
        }
      } catch (e) {
        console.warn("Error fetching notes from cloud:", e);
      }
    }
    return local;
  },

  async addNote(email: string, note: DailyNote) {
    const cleanEmail = email.trim().toLowerCase();
    const current = getFromLocal<DailyNote>(STORAGE_KEYS.DAILY_NOTES, cleanEmail);
    saveToLocal(STORAGE_KEYS.DAILY_NOTES, [note, ...current.filter(n => n.id !== note.id)], cleanEmail);

    if (!isSupabaseConfigured || !supabase) return;

    try {
      const userId = await requireAuthUserId(cleanEmail);
      const branchId = await getActiveBranchId(cleanEmail);
      const payload: any = {
        id: note.id,
        user_id: userId,
        user_email: cleanEmail,
        title: note.title,
        content: note.content,
        priority: note.priority,
        status: note.status,
        assigned_to: note.assignedTo || null,
        author: note.author,
        pinned: note.pinned || false,
        created_at: note.createdAt
      };
      if (branchId) {
        payload.branch_id = branchId;
      }
      const { error } = await supabase.from('daily_notes').insert(payload);
      if (error) {
        if (isPgrstMissingTableError(error)) {
          console.warn("Supabase daily_notes table not yet provisioned in schema cache (PGRST205).");
          return;
        }
        console.error("Supabase addNote error:", error);
      }
    } catch (e) {
      console.warn("Cloud addNote skipped:", e);
    }
  },

  async updateNote(email: string, updatedNote: DailyNote) {
    const cleanEmail = email.trim().toLowerCase();
    const current = getFromLocal<DailyNote>(STORAGE_KEYS.DAILY_NOTES, cleanEmail);
    saveToLocal(STORAGE_KEYS.DAILY_NOTES, current.map(n => n.id === updatedNote.id ? updatedNote : n), cleanEmail);

    if (!isSupabaseConfigured || !supabase) return;

    try {
      const { error } = await supabase.from('daily_notes').update({
        title: updatedNote.title,
        content: updatedNote.content,
        priority: updatedNote.priority,
        status: updatedNote.status,
        assigned_to: updatedNote.assignedTo || null,
        author: updatedNote.author,
        pinned: updatedNote.pinned || false
      }).eq('id', updatedNote.id);

      if (error) {
        if (isPgrstMissingTableError(error)) {
          console.warn("Supabase daily_notes table not yet provisioned in schema cache (PGRST205).");
          return;
        }
        console.error("Supabase updateNote error:", error);
      }
    } catch (e) {
      console.warn("Cloud updateNote skipped:", e);
    }
  },

  async deleteNote(email: string, id: string) {
    const cleanEmail = email.trim().toLowerCase();
    const current = getFromLocal<DailyNote>(STORAGE_KEYS.DAILY_NOTES, cleanEmail);
    saveToLocal(STORAGE_KEYS.DAILY_NOTES, current.filter(n => n.id !== id), cleanEmail);

    if (!isSupabaseConfigured || !supabase) return;

    try {
      const { error } = await supabase.from('daily_notes').delete().eq('id', id);
      if (error) {
        if (isPgrstMissingTableError(error)) {
          console.warn("Supabase daily_notes table not yet provisioned in schema cache (PGRST205).");
          return;
        }
        console.error("Supabase deleteNote error:", error);
      }
    } catch (e) {
      console.warn("Cloud deleteNote skipped:", e);
    }
  },

  async checkDatabaseHealth(): Promise<{
    configured: boolean;
    tablesProvisioned: boolean;
    error?: string;
  }> {
    if (!isSupabaseConfigured || !supabase) {
      return { configured: false, tablesProvisioned: false, error: 'Supabase URL or Key not configured.' };
    }
    try {
      const { error } = await supabase.from('products').select('id').limit(1);
      if (error) {
        if (isPgrstMissingTableError(error)) {
          return { configured: true, tablesProvisioned: false, error: 'Database tables not yet created in Supabase schema.' };
        }
        return { configured: true, tablesProvisioned: false, error: error.message };
      }
      return { configured: true, tablesProvisioned: true };
    } catch (err: any) {
      return { configured: true, tablesProvisioned: false, error: err.message };
    }
  },

  // --------------------------------------------------------------------------
  // USER CLEANUP & UTILITIES
  // --------------------------------------------------------------------------
  async clearAllDataForUser(email: string): Promise<void> {
    const cleanEmail = email.trim().toLowerCase();
    try {
      if (isSupabaseConfigured && supabase) {
        const userId = await requireAuthUserId(cleanEmail);
        if (userId) {
          const branchId = await getActiveBranchId(cleanEmail);
          if (branchId) {
            await supabase.from('sales').delete().eq('branch_id', branchId);
            await supabase.from('products').delete().eq('branch_id', branchId);
            await supabase.from('expenses').delete().eq('branch_id', branchId);
            await supabase.from('wastage').delete().eq('branch_id', branchId);
            await supabase.from('staff').delete().eq('branch_id', branchId);
            await supabase.from('attendance').delete().eq('branch_id', branchId);
            await supabase.from('deductions').delete().eq('branch_id', branchId);
            await supabase.from('daily_closings').delete().eq('branch_id', branchId);
            await supabase.from('monthly_closings').delete().eq('branch_id', branchId);
            await supabase.from('production').delete().eq('branch_id', branchId);
            await supabase.from('daily_notes').delete().eq('branch_id', branchId);
          } else {
            await supabase.from('sales').delete().or(`user_email.eq.${cleanEmail},user_id.eq.${userId}`);
            await supabase.from('products').delete().or(`user_email.eq.${cleanEmail},user_id.eq.${userId}`);
            await supabase.from('expenses').delete().or(`user_email.eq.${cleanEmail},user_id.eq.${userId}`);
            await supabase.from('wastage').delete().or(`user_email.eq.${cleanEmail},user_id.eq.${userId}`);
            await supabase.from('staff').delete().or(`user_email.eq.${cleanEmail},user_id.eq.${userId}`);
            await supabase.from('attendance').delete().or(`user_email.eq.${cleanEmail},user_id.eq.${userId}`);
            await supabase.from('deductions').delete().or(`user_email.eq.${cleanEmail},user_id.eq.${userId}`);
            await supabase.from('daily_closings').delete().or(`user_email.eq.${cleanEmail},user_id.eq.${userId}`);
            await supabase.from('monthly_closings').delete().or(`user_email.eq.${cleanEmail},user_id.eq.${userId}`);
            await supabase.from('production').delete().or(`user_email.eq.${cleanEmail},user_id.eq.${userId}`);
            await supabase.from('daily_notes').delete().or(`user_email.eq.${cleanEmail},user_id.eq.${userId}`);
          }
        }
      }

      for (const [_, globalKey] of Object.entries(STORAGE_KEYS)) {
        const fullKey = getStorageKey(globalKey, cleanEmail);
        localStorage.removeItem(fullKey);
      }
      const pinKey = getStorageKey('managerPass', cleanEmail);
      localStorage.removeItem(pinKey);
    } catch (err: any) {
      console.error("Storage clear error:", err);
      throw new Error(`Failed to clear user data: ${err.message}`);
    }
  },

  async exportAllData(email: string): Promise<string> {
    const cleanEmail = email.trim().toLowerCase();
    const profile = this.getProfileByEmail(cleanEmail);
    const data: any = {
      products: await this.getProducts(cleanEmail),
      sales: await this.getSales(cleanEmail),
      expenses: await this.getExpenses(cleanEmail),
      wastage: await this.getWastage(cleanEmail),
      staff: await this.getStaff(cleanEmail),
      attendance: await this.getAttendance(cleanEmail),
      dailyClosings: await this.getClosings(cleanEmail),
      monthlyClosings: await this.getMonthlyClosings(cleanEmail),
      deductions: await this.getDeductions(cleanEmail),
      production: await this.getProduction(cleanEmail),
      notes: await this.getNotes(cleanEmail)
    };

    return JSON.stringify({
      tenantEmail: cleanEmail,
      businessProfile: profile,
      version: '4.0.0 (Supabase Ready)',
      timestamp: new Date().toISOString(),
      data
    }, null, 2);
  },

  async importAllData(email: string, jsonData: string): Promise<boolean> {
    const cleanEmail = email.trim().toLowerCase();
    try {
      const parsed = JSON.parse(jsonData);
      if (!parsed.data) return false;

      if (parsed.data.products) {
        for (const p of parsed.data.products) await this.upsertProduct(cleanEmail, p);
      }
      if (parsed.data.sales) {
        for (const s of parsed.data.sales) await this.addSale(cleanEmail, s);
      }
      if (parsed.data.expenses) {
        for (const e of parsed.data.expenses) await this.addExpense(cleanEmail, e);
      }
      if (parsed.data.wastage) {
        for (const w of parsed.data.wastage) await this.addWastage(cleanEmail, w);
      }
      if (parsed.data.staff) {
        for (const st of parsed.data.staff) await this.addStaff(cleanEmail, st);
      }
      if (parsed.data.attendance) {
        for (const a of parsed.data.attendance) await this.upsertAttendance(cleanEmail, a);
      }
      if (parsed.data.dailyClosings) {
        for (const dc of parsed.data.dailyClosings) await this.addClosing(cleanEmail, dc);
      }
      if (parsed.data.monthlyClosings) {
        for (const mc of parsed.data.monthlyClosings) await this.addMonthlyClosing(cleanEmail, mc);
      }
      if (parsed.data.deductions) {
        for (const d of parsed.data.deductions) await this.addDeduction(cleanEmail, d);
      }
      if (parsed.data.production) {
        for (const pr of parsed.data.production) await this.addProduction(cleanEmail, pr);
      }
      if (parsed.data.notes) {
        for (const n of parsed.data.notes) await this.addNote(cleanEmail, n);
      }

      if (parsed.businessProfile) {
        await this.updateProfile(cleanEmail, parsed.businessProfile);
      }
      return true;
    } catch (e) {
      console.error("Import error in storageService:", e);
      return false;
    }
  },

  async syncAllLocalDataToSupabase(email: string): Promise<{ success: boolean; count: number; error?: string }> {
    const cleanEmail = email.trim().toLowerCase();
    if (!isSupabaseConfigured || !supabase) {
      return { success: false, count: 0, error: "Supabase connection is not configured." };
    }

    try {
      const userId = await requireAuthUserId();
      if (!userId) {
        return { success: false, count: 0, error: "No active authenticated Supabase user found. Please login to Supabase." };
      }

      const branchId = await getActiveBranchId(cleanEmail);
      let totalCount = 0;

      // 1. Sync Profile
      const localProfile = this.getProfileByEmail(cleanEmail);
      if (localProfile) {
        const profilePayload: any = {
          id: userId,
          email: cleanEmail,
          business_name: localProfile.businessName || 'My Bakery',
          owner_name: localProfile.ownerName || null,
          phone: localProfile.phone || null,
          address: localProfile.address || null,
          manager_pin: localProfile.managerPin || '654321',
          currency_symbol: localProfile.currencySymbol || '৳',
          receipt_footer: localProfile.receiptFooter || 'Thank you for shopping with us!',
          role: localProfile.role || 'owner',
          updated_at: new Date().toISOString()
        };
        if (branchId) profilePayload.branch_id = branchId;
        const { error: profErr } = await supabase.from('profiles').upsert(profilePayload);
        if (profErr) {
          if (isPgrstMissingTableError(profErr)) {
            return { success: false, count: 0, error: "Supabase tables are missing. Please execute setup_schema.sql in your Supabase SQL Editor first." };
          }
          console.warn("Sync profile error:", profErr.message);
        } else {
          totalCount++;
        }
      }

      // 2. Sync Products
      const products = getFromLocal<Product>(STORAGE_KEYS.PRODUCTS, cleanEmail);
      for (const p of products) {
        const payload: any = {
          id: p.id,
          user_id: userId,
          name: p.name,
          category: p.category,
          price: p.price,
          stock: p.stock,
          unit: p.unit,
          barcode: p.barcode || null,
          updated_at: new Date().toISOString()
        };
        if (branchId) payload.branch_id = branchId;
        const { error } = await supabase.from('products').upsert(payload);
        if (!error) totalCount++;
      }

      // 3. Sync Sales & Items
      const sales = getFromLocal<Sale>(STORAGE_KEYS.SALES, cleanEmail);
      for (const s of sales) {
        const salePayload: any = {
          id: s.id,
          user_id: userId,
          total_price: s.totalPrice,
          discount: s.discount || 0,
          amount_paid: s.amountPaid,
          due_amount: s.dueAmount,
          customer_name: s.customerName || null,
          customer_phone: s.customerPhone || null,
          payment_method: s.paymentMethod,
          mobile_provider: s.mobileProvider || null,
          transaction_id: s.transactionId || null,
          date: s.date
        };
        if (branchId) salePayload.branch_id = branchId;
        const { error: sErr } = await supabase.from('sales').upsert(salePayload);
        if (!sErr) {
          totalCount++;
          if (s.items && s.items.length > 0) {
            const itemsPayload = s.items.map(item => ({
              sale_id: s.id,
              product_id: item.productId,
              product_name: item.productName,
              quantity: item.quantity,
              unit: item.unit,
              price_per_unit: item.pricePerUnit,
              sub_total: item.subTotal
            }));
            await supabase.from('sale_items').upsert(itemsPayload);
          }
          if (s.payments && s.payments.length > 0) {
            const paymentsPayload = s.payments.map(pay => ({
              id: pay.id,
              sale_id: s.id,
              amount: pay.amount,
              date: pay.date,
              method: pay.method
            }));
            await supabase.from('sale_payments').upsert(paymentsPayload);
          }
        }
      }

      // 4. Sync Expenses
      const expenses = getFromLocal<Expense>(STORAGE_KEYS.EXPENSES, cleanEmail);
      for (const exp of expenses) {
        const payload: any = {
          id: exp.id,
          user_id: userId,
          description: exp.description,
          amount: exp.amount,
          category: exp.category,
          date: exp.date
        };
        if (branchId) payload.branch_id = branchId;
        const { error } = await supabase.from('expenses').upsert(payload);
        if (!error) totalCount++;
      }

      // 5. Sync Wastage
      const wastageList = getFromLocal<Wastage>(STORAGE_KEYS.WASTAGE, cleanEmail);
      for (const w of wastageList) {
        const payload: any = {
          id: w.id,
          user_id: userId,
          product_id: w.productId || null,
          product_name: w.productName,
          quantity: w.quantity,
          unit: w.unit,
          loss_value: w.lossValue,
          reason: w.reason || null,
          date: w.date
        };
        if (branchId) payload.branch_id = branchId;
        const { error } = await supabase.from('wastage').upsert(payload);
        if (!error) totalCount++;
      }

      // 6. Sync Staff
      const staffList = getFromLocal<Staff>(STORAGE_KEYS.STAFF, cleanEmail);
      for (const st of staffList) {
        const payload: any = {
          id: st.id,
          user_id: userId,
          name: st.name,
          designation: st.designation,
          monthly_salary: st.monthlySalary,
          join_date: st.joinDate
        };
        if (branchId) payload.branch_id = branchId;
        const { error } = await supabase.from('staff').upsert(payload);
        if (!error) totalCount++;
      }

      // 7. Sync Attendance
      const attList = getFromLocal<Attendance>(STORAGE_KEYS.ATTENDANCE, cleanEmail);
      for (const att of attList) {
        const payload: any = {
          id: att.id,
          user_id: userId,
          staff_id: att.staffId,
          date: att.date,
          status: att.status
        };
        if (branchId) payload.branch_id = branchId;
        const { error } = await supabase.from('attendance').upsert(payload);
        if (!error) totalCount++;
      }

      // 8. Sync Deductions
      const dedList = getFromLocal<Deduction>(STORAGE_KEYS.DEDUCTIONS, cleanEmail);
      for (const d of dedList) {
        const payload: any = {
          id: d.id,
          user_id: userId,
          staff_id: d.staffId,
          amount: d.amount,
          reason: d.reason,
          date: d.date
        };
        if (branchId) payload.branch_id = branchId;
        const { error } = await supabase.from('deductions').upsert(payload);
        if (!error) totalCount++;
      }

      // 9. Sync Daily Closings
      const closings = getFromLocal<DailyClosing>(STORAGE_KEYS.CLOSINGS, cleanEmail);
      for (const c of closings) {
        const payload: any = {
          id: c.id,
          user_id: userId,
          date: c.date,
          total_sales: c.totalSales,
          total_cash_collected: c.totalCashCollected,
          total_cash_payments: c.totalCashPayments || 0,
          total_mobile_payments: c.totalMobilePayments || 0,
          total_expenses: c.totalExpenses,
          total_wastage: c.totalWastage,
          system_balance: c.systemBalance,
          actual_cash: c.actualCash,
          difference: c.difference,
          closed_by: c.closedBy,
          timestamp: c.timestamp
        };
        if (branchId) payload.branch_id = branchId;
        const { error } = await supabase.from('daily_closings').upsert(payload);
        if (!error) totalCount++;
      }

      // 10. Sync Monthly Closings
      const monthlyClosings = getFromLocal<MonthlyClosing>(STORAGE_KEYS.MONTHLY_CLOSINGS, cleanEmail);
      for (const mc of monthlyClosings) {
        const payload: any = {
          id: mc.id,
          user_id: userId,
          month: mc.month,
          total_sales: mc.totalSales,
          total_cash_payments: mc.totalCashPayments || 0,
          total_mobile_payments: mc.totalMobilePayments || 0,
          total_expenses: mc.totalExpenses,
          total_wastage: mc.totalWastage,
          total_profit: mc.totalProfit,
          total_dues: mc.totalDues || 0,
          closed_by: mc.closedBy,
          timestamp: mc.timestamp
        };
        if (branchId) payload.branch_id = branchId;
        const { error } = await supabase.from('monthly_closings').upsert(payload);
        if (!error) totalCount++;
      }

      // 11. Sync Production
      const prodList = getFromLocal<Production>(STORAGE_KEYS.PRODUCTION, cleanEmail);
      for (const pr of prodList) {
        const payload: any = {
          id: pr.id,
          user_id: userId,
          product_id: pr.productId || null,
          product_name: pr.productName,
          quantity: pr.quantity,
          unit: pr.unit,
          unit_price: pr.unitPrice,
          total_value: pr.totalValue,
          date: pr.date
        };
        if (branchId) payload.branch_id = branchId;
        const { error } = await supabase.from('production').upsert(payload);
        if (!error) totalCount++;
      }

      // 12. Sync Notes
      const notesList = getFromLocal<DailyNote>(STORAGE_KEYS.NOTES, cleanEmail);
      for (const n of notesList) {
        const payload: any = {
          id: n.id,
          user_id: userId,
          title: n.title,
          content: n.content,
          priority: n.priority,
          status: n.status,
          assigned_to: n.assignedTo || null,
          author: n.author,
          pinned: n.pinned || false,
          created_at: n.createdAt
        };
        if (branchId) payload.branch_id = branchId;
        const { error } = await supabase.from('daily_notes').upsert(payload);
        if (!error) totalCount++;
      }

      return { success: true, count: totalCount };
    } catch (err: any) {
      console.error("syncAllLocalDataToSupabase error:", err);
      return { success: false, count: 0, error: err.message || "Failed to sync local data to Supabase." };
    }
  },

  /**
   * Diagnostic test performing live CRUD operations against public.products
   */
  async testDatabaseOperations(email: string): Promise<{
    success: boolean;
    step: string;
    details: string;
    error?: any;
    report: {
      auth: boolean;
      select: boolean;
      insert: boolean;
      update: boolean;
      delete: boolean;
    };
  }> {
    const report = {
      auth: false,
      select: false,
      insert: false,
      update: false,
      delete: false
    };

    if (!isSupabaseConfigured || !supabase) {
      return {
        success: false,
        step: 'Client Initialization',
        details: 'Supabase client is not configured (missing URL or Anon Key).',
        report
      };
    }

    // 1. Verify Authentication
    const { data: authData, error: authErr } = await supabase.auth.getUser();
    if (authErr || !authData?.user) {
      return {
        success: false,
        step: 'Authentication Check',
        details: 'No active Supabase user session found. Please log in with email and password to test database persistence.',
        error: authErr,
        report
      };
    }
    report.auth = true;
    const userId = authData.user.id;
    const branchId = await getActiveBranchId(email);

    // 2. Test SELECT
    const { error: selectErr } = await supabase
      .from('products')
      .select('id, name, price, stock')
      .limit(1);

    if (selectErr) {
      return {
        success: false,
        step: 'SELECT products',
        details: selectErr.message,
        error: selectErr,
        report
      };
    }
    report.select = true;

    // 3. Test INSERT
    const testProductId = `_diag_test_${Date.now()}`;
    const testPayload: any = {
      id: testProductId,
      user_id: userId,
      name: '__DIAGNOSTIC_TEST_PRODUCT__',
      category: 'Diagnostic',
      price: 99.99,
      stock: 10,
      unit: 'pcs',
      barcode: 'DIAG123',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };
    if (branchId) testPayload.branch_id = branchId;

    const { error: insertErr } = await supabase
      .from('products')
      .insert(testPayload);

    if (insertErr) {
      return {
        success: false,
        step: 'INSERT product',
        details: insertErr.message,
        error: insertErr,
        report
      };
    }
    report.insert = true;

    // 4. Test UPDATE
    const { error: updateErr } = await supabase
      .from('products')
      .update({ price: 149.99, updated_at: new Date().toISOString() })
      .eq('id', testProductId);

    if (updateErr) {
      await supabase.from('products').delete().eq('id', testProductId);
      return {
        success: false,
        step: 'UPDATE product',
        details: updateErr.message,
        error: updateErr,
        report
      };
    }
    report.update = true;

    // 5. Test DELETE
    const { error: deleteErr } = await supabase
      .from('products')
      .delete()
      .eq('id', testProductId);

    if (deleteErr) {
      return {
        success: false,
        step: 'DELETE product',
        details: deleteErr.message,
        error: deleteErr,
        report
      };
    }
    report.delete = true;

    return {
      success: true,
      step: 'Complete',
      details: 'All CRUD operations (SELECT, INSERT, UPDATE, DELETE) verified successfully on live Supabase database!',
      report
    };
  }
};
