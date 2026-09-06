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
  DEDUCTIONS: 'sweetBakery_deductions',
  MONTHLY_CLOSINGS: 'sweetBakery_monthly_closings',
  PRODUCTION: 'sweetBakery_production',
  NOTES: 'sweetBakery_daily_notes',
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

const getFromLocal = <T>(keyVal: string, email: string): T[] => {
  if (typeof window === 'undefined') return [];
  try {
    const fullKey = getStorageKey(keyVal, email);
    const data = localStorage.getItem(fullKey);
    return data ? JSON.parse(data) : [];
  } catch (err) {
    console.error(`localStorage read failed for ${keyVal}:`, err);
    return [];
  }
};

const saveToLocal = <T>(keyVal: string, data: T[], email: string): void => {
  if (typeof window === 'undefined') return;
  try {
    const fullKey = getStorageKey(keyVal, email);
    localStorage.setItem(fullKey, JSON.stringify(data));
  } catch (err) {
    console.error(`localStorage write failed for ${keyVal}:`, err);
  }
};

/**
 * Retrieves the authenticated user session ID when writing to Supabase.
 * Returns string or null if unauthenticated or offline.
 */
export async function requireAuthUserId(): Promise<string | null> {
  if (!isSupabaseConfigured || !supabase) return null;
  const userId = await getActiveUserId();
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
    const userId = await getActiveUserId();
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

    // 4. Fallback: provision or resolve default branch via hardened SECURITY DEFINER function
    const { data: defaultBranchId } = await supabase.rpc('ensure_default_branch');
    if (defaultBranchId) return defaultBranchId;

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
    try {
      const data = localStorage.getItem(PROFILES_KEY);
      return data ? JSON.parse(data) : [];
    } catch (e) {
      console.error("Error reading profiles:", e);
      return [];
    }
  },

  saveProfiles(profiles: UserProfile[]): void {
    try {
      localStorage.setItem(PROFILES_KEY, JSON.stringify(profiles));
    } catch (e) {
      console.error("Error saving profiles:", e);
    }
  },

  getProfileByEmail(email: string): UserProfile | null {
    if (!email) return null;
    const cleanEmail = email.trim().toLowerCase();
    const profiles = this.getProfiles();
    return profiles.find(p => p.email.toLowerCase() === cleanEmail) || null;
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

      const profiles = this.getProfiles();
      const cleanEmail = profile.email.trim().toLowerCase();
      const index = profiles.findIndex(p => p.email.toLowerCase() === cleanEmail);
      if (index > -1) {
        profiles[index] = { ...profiles[index], ...profile };
      } else {
        profiles.push(profile);
      }
      this.saveProfiles(profiles);

      const fullKey = getStorageKey(STORAGE_KEYS.PROFILE, cleanEmail);
      try {
        localStorage.setItem(fullKey, JSON.stringify(profile));
      } catch (e) {
        console.error("Failed to cache scoped profile:", e);
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
        const userId = await requireAuthUserId();
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
              console.warn("Supabase profiles table not found in schema cache. Storing profile locally.");
            } else {
              console.warn("Supabase profile upsert warning:", error.message);
            }
          }
        }
      } catch (err) {
        console.warn("Cloud saveProfile skipped:", err);
      }
    }

    const profiles = this.getProfiles();
    const cleanEmail = profile.email.trim().toLowerCase();
    const index = profiles.findIndex(p => p.email.toLowerCase() === cleanEmail);
    if (index > -1) {
      profiles[index] = { ...profiles[index], ...profile };
    } else {
      profiles.push(profile);
    }
    this.saveProfiles(profiles);

    const fullKey = getStorageKey(STORAGE_KEYS.PROFILE, cleanEmail);
    try {
      localStorage.setItem(fullKey, JSON.stringify(profile));
    } catch (e) {
      console.error("Failed to save scoped profile:", e);
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
              console.warn("Supabase profiles table not found in schema cache. Storing updates locally.");
            } else {
              console.warn("Supabase updateProfile warning:", error.message);
            }
          }
        }
      } catch (err) {
        console.warn("Cloud updateProfile skipped:", err);
      }
    }

    const profiles = this.getProfiles();
    const index = profiles.findIndex(p => p.email.toLowerCase() === cleanEmail);
    if (index === -1) return null;

    const updatedProfile = {
      ...profiles[index],
      ...updates
    };
    profiles[index] = updatedProfile;
    this.saveProfiles(profiles);

    if (updates.managerPin) {
      const pinKey = getStorageKey('managerPass', cleanEmail);
      localStorage.setItem(pinKey, updates.managerPin);
    }

    const fullKey = getStorageKey(STORAGE_KEYS.PROFILE, cleanEmail);
    try {
      localStorage.setItem(fullKey, JSON.stringify(updatedProfile));
    } catch (e) {
      console.error("Failed to update scoped profile:", e);
    }

    return updatedProfile;
  },

  getManagerPin(email: string): string {
    const cleanEmail = email.trim().toLowerCase();
    const pinKey = getStorageKey('managerPass', cleanEmail);
    const savedPin = localStorage.getItem(pinKey);
    if (savedPin) return savedPin;

    const profile = this.getProfileByEmail(cleanEmail);
    if (profile && profile.managerPin) return profile.managerPin;

    return '';
  },

  async setManagerPin(email: string, newPin: string): Promise<void> {
    const cleanEmail = email.trim().toLowerCase();
    const pinKey = getStorageKey('managerPass', cleanEmail);
    localStorage.setItem(pinKey, newPin);
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
    if (isSupabaseConfigured && supabase) {
      const userId = await getActiveUserId();
      const branchId = await getActiveBranchId(email);
      let query = supabase
        .from('products')
        .select('*')
        .order('name', { ascending: true });

      if (branchId && userId) {
        query = query.or(`branch_id.eq.${branchId},and(branch_id.is.null,user_id.eq.${userId})`);
      } else if (branchId) {
        query = query.eq('branch_id', branchId);
      } else if (userId) {
        query = query.eq('user_id', userId);
      }

      const { data, error } = await query;

      if (!error && data) {
        const prods: Product[] = data.map(row => ({
          id: row.id,
          name: row.name,
          category: row.category,
          price: Number(row.price),
          stock: Number(row.stock),
          unit: row.unit,
          barcode: row.barcode || undefined
        }));
        saveToLocal(STORAGE_KEYS.PRODUCTS, prods, email);
        return prods;
      }
    }
    return getFromLocal<Product>(STORAGE_KEYS.PRODUCTS, email);
  },

  async upsertProduct(email: string, product: Product) {
    if (isSupabaseConfigured && supabase) {
      try {
        const userId = await requireAuthUserId();
        if (userId) {
          const branchId = await getActiveBranchId(email);

          // 1. Try to update existing product first (avoids changing branch_id or violating RLS insert permissions)
          const updatePayload: any = {
            name: product.name,
            category: product.category,
            price: product.price,
            stock: product.stock,
            unit: product.unit,
            barcode: product.barcode || null,
            updated_at: new Date().toISOString()
          };

          const { data: updatedRows, error: updateErr } = await supabase
            .from('products')
            .update(updatePayload)
            .eq('id', product.id)
            .select('id');

          // 2. If row does not exist in DB yet, insert it with user_id and branch_id
          if (!updateErr && (!updatedRows || updatedRows.length === 0)) {
            const insertPayload: any = {
              id: product.id,
              user_id: userId,
              name: product.name,
              category: product.category,
              price: product.price,
              stock: product.stock,
              unit: product.unit,
              barcode: product.barcode || null,
              updated_at: new Date().toISOString()
            };
            if (branchId) {
              insertPayload.branch_id = branchId;
            }
            const { error: insertErr } = await supabase.from('products').insert(insertPayload);
            if (insertErr && !isPgrstMissingTableError(insertErr)) {
              console.warn("Supabase insertProduct warning:", insertErr.message);
            }
          } else if (updateErr && !isPgrstMissingTableError(updateErr)) {
            console.warn("Supabase updateProduct warning:", updateErr.message);
          }
        }
      } catch (err) {
        console.warn("Cloud product sync skipped:", err);
      }
    }

    const products = getFromLocal<Product>(STORAGE_KEYS.PRODUCTS, email);
    const index = products.findIndex(p => p.id === product.id);
    if (index > -1) {
      products[index] = product;
    } else {
      products.unshift(product);
    }
    saveToLocal(STORAGE_KEYS.PRODUCTS, products, email);
  },

  async deleteProduct(email: string, id: string) {
    if (isSupabaseConfigured && supabase) {
      try {
        const userId = await requireAuthUserId();
        if (userId) {
          const { error } = await supabase.from('products').delete().eq('id', id);
          if (error && !isPgrstMissingTableError(error)) {
            console.warn("Supabase deleteProduct warning:", error.message);
          }
        }
      } catch (err) {
        console.warn("Cloud deleteProduct skipped:", err);
      }
    }

    const products = getFromLocal<Product>(STORAGE_KEYS.PRODUCTS, email);
    saveToLocal(STORAGE_KEYS.PRODUCTS, products.filter(p => p.id !== id), email);
  },

  // --------------------------------------------------------------------------
  // SALES & DUES
  // --------------------------------------------------------------------------
  async getSales(email: string): Promise<Sale[]> {
    if (isSupabaseConfigured && supabase) {
      const branchId = await getActiveBranchId(email);
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
      }

      const { data, error } = await query;

      if (!error && data) {
        const sales: Sale[] = data.map(row => ({
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
        saveToLocal(STORAGE_KEYS.SALES, sales, email);
        return sales;
      }
    }
    return getFromLocal<Sale>(STORAGE_KEYS.SALES, email);
  },

  async addSale(email: string, sale: Sale) {
    if (isSupabaseConfigured && supabase) {
      try {
        const userId = await requireAuthUserId();
        if (userId) {
          const branchId = await getActiveBranchId(email);
          // 1. Insert parent sale with branch scoping
          const salePayload: any = {
            id: sale.id,
            user_id: userId,
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

          if (!saleErr && sale.items.length > 0) {
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

          if (!saleErr && sale.payments && sale.payments.length > 0) {
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
        }
      } catch (err) {
        console.warn("Cloud addSale skipped:", err);
      }
    }

    const sales = getFromLocal<Sale>(STORAGE_KEYS.SALES, email);
    sales.push(sale);
    saveToLocal(STORAGE_KEYS.SALES, sales, email);
  },

  async updateSale(email: string, sale: Sale) {
    if (isSupabaseConfigured && supabase) {
      try {
        const userId = await requireAuthUserId();
        if (userId) {
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

          if (!updateErr && sale.payments && sale.payments.length > 0) {
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
        }
      } catch (err) {
        console.warn("Cloud updateSale skipped:", err);
      }
    }

    const sales = getFromLocal<Sale>(STORAGE_KEYS.SALES, email);
    const index = sales.findIndex(s => s.id === sale.id);
    if (index > -1) {
      sales[index] = sale;
      saveToLocal(STORAGE_KEYS.SALES, sales, email);
    }
  },

  async deleteSale(email: string, id: string): Promise<void> {
    if (isSupabaseConfigured && supabase) {
      try {
        const userId = await requireAuthUserId();
        if (userId) {
          // Atomically cancel sale and restore product inventory via PostgreSQL transactional function
          const { error } = await supabase.rpc('cancel_sale_and_restore_stock', { p_sale_id: id });
          if (error && !isPgrstMissingTableError(error)) {
            await supabase.from('sales').delete().eq('id', id);
          }
        }
      } catch (err) {
        console.warn("Cloud deleteSale skipped:", err);
      }
    }

    const sales = getFromLocal<Sale>(STORAGE_KEYS.SALES, email);
    const targetSale = sales.find(s => s.id === id);
    saveToLocal(STORAGE_KEYS.SALES, sales.filter(s => s.id !== id), email);

    // If target sale had items, restore stock in local cache as well
    if (targetSale && targetSale.items.length > 0) {
      const products = getFromLocal<Product>(STORAGE_KEYS.PRODUCTS, email);
      const updatedProds = products.map(p => {
        const item = targetSale.items.find(i => i.productId === p.id);
        return item ? { ...p, stock: p.stock + item.quantity } : p;
      });
      saveToLocal(STORAGE_KEYS.PRODUCTS, updatedProds, email);
    }
  },

  // --------------------------------------------------------------------------
  // EXPENSES
  // --------------------------------------------------------------------------
  async getExpenses(email: string): Promise<Expense[]> {
    if (isSupabaseConfigured && supabase) {
      const branchId = await getActiveBranchId(email);
      let query = supabase
        .from('expenses')
        .select('*')
        .order('date', { ascending: false });

      if (branchId) {
        query = query.eq('branch_id', branchId);
      }

      const { data, error } = await query;

      if (!error && data) {
        const expenses: Expense[] = data.map(row => ({
          id: row.id,
          description: row.description,
          amount: Number(row.amount),
          category: row.category,
          date: row.date
        }));
        saveToLocal(STORAGE_KEYS.EXPENSES, expenses, email);
        return expenses;
      }
    }
    return getFromLocal<Expense>(STORAGE_KEYS.EXPENSES, email);
  },

  async addExpense(email: string, expense: Expense) {
    if (isSupabaseConfigured && supabase) {
      try {
        const userId = await requireAuthUserId();
        if (userId) {
          const branchId = await getActiveBranchId(email);
          const payload: any = {
            id: expense.id,
            user_id: userId,
            description: expense.description,
            amount: expense.amount,
            category: expense.category,
            date: expense.date
          };
          if (branchId) {
            payload.branch_id = branchId;
          }
          const { error } = await supabase.from('expenses').insert(payload);
          if (error && !isPgrstMissingTableError(error)) {
            console.warn("Supabase addExpense warning:", error.message);
          }
        }
      } catch (err) {
        console.warn("Cloud addExpense skipped:", err);
      }
    }

    const expenses = getFromLocal<Expense>(STORAGE_KEYS.EXPENSES, email);
    expenses.push(expense);
    saveToLocal(STORAGE_KEYS.EXPENSES, expenses, email);
  },

  // --------------------------------------------------------------------------
  // WASTAGE
  // --------------------------------------------------------------------------
  async getWastage(email: string): Promise<Wastage[]> {
    if (isSupabaseConfigured && supabase) {
      const branchId = await getActiveBranchId(email);
      let query = supabase
        .from('wastage')
        .select('*')
        .order('date', { ascending: false });

      if (branchId) {
        query = query.eq('branch_id', branchId);
      }

      const { data, error } = await query;

      if (!error && data) {
        const wastage: Wastage[] = data.map(row => ({
          id: row.id,
          productId: row.product_id || '',
          productName: row.product_name,
          quantity: Number(row.quantity),
          unit: row.unit,
          lossValue: Number(row.loss_value),
          reason: row.reason || '',
          date: row.date
        }));
        saveToLocal(STORAGE_KEYS.WASTAGE, wastage, email);
        return wastage;
      }
    }
    return getFromLocal<Wastage>(STORAGE_KEYS.WASTAGE, email);
  },

  async addWastage(email: string, wastage: Wastage) {
    if (isSupabaseConfigured && supabase) {
      try {
        const userId = await requireAuthUserId();
        if (userId) {
          const branchId = await getActiveBranchId(email);
          const payload: any = {
            id: wastage.id,
            user_id: userId,
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
          if (error && !isPgrstMissingTableError(error)) {
            console.warn("Supabase addWastage warning:", error.message);
          }
        }
      } catch (err) {
        console.warn("Cloud addWastage skipped:", err);
      }
    }

    const all = getFromLocal<Wastage>(STORAGE_KEYS.WASTAGE, email);
    all.push(wastage);
    saveToLocal(STORAGE_KEYS.WASTAGE, all, email);
  },

  async deleteWastage(email: string, id: string) {
    if (isSupabaseConfigured && supabase) {
      try {
        const userId = await requireAuthUserId();
        if (userId) {
          const { error } = await supabase.from('wastage').delete().eq('id', id);
          if (error && !isPgrstMissingTableError(error)) {
            console.warn("Supabase deleteWastage warning:", error.message);
          }
        }
      } catch (err) {
        console.warn("Cloud deleteWastage skipped:", err);
      }
    }

    const all = getFromLocal<Wastage>(STORAGE_KEYS.WASTAGE, email);
    saveToLocal(STORAGE_KEYS.WASTAGE, all.filter(w => w.id !== id), email);
  },

  // --------------------------------------------------------------------------
  // STAFF
  // --------------------------------------------------------------------------
  async getStaff(email: string): Promise<Staff[]> {
    if (isSupabaseConfigured && supabase) {
      const branchId = await getActiveBranchId(email);
      let query = supabase
        .from('staff')
        .select('*')
        .order('name', { ascending: true });

      if (branchId) {
        query = query.eq('branch_id', branchId);
      }

      const { data, error } = await query;

      if (!error && data) {
        const staffList: Staff[] = data.map(row => ({
          id: row.id,
          name: row.name,
          designation: row.designation,
          monthlySalary: Number(row.monthly_salary),
          joinDate: row.join_date
        }));
        saveToLocal(STORAGE_KEYS.STAFF, staffList, email);
        return staffList;
      }
    }
    return getFromLocal<Staff>(STORAGE_KEYS.STAFF, email);
  },

  async addStaff(email: string, staff: Staff) {
    if (isSupabaseConfigured && supabase) {
      try {
        const userId = await requireAuthUserId();
        if (userId) {
          const branchId = await getActiveBranchId(email);
          const payload: any = {
            id: staff.id,
            user_id: userId,
            name: staff.name,
            designation: staff.designation,
            monthly_salary: staff.monthlySalary,
            join_date: staff.joinDate
          };
          if (branchId) {
            payload.branch_id = branchId;
          }
          const { error } = await supabase.from('staff').insert(payload);
          if (error && !isPgrstMissingTableError(error)) {
            console.warn("Supabase addStaff warning:", error.message);
          }
        }
      } catch (err) {
        console.warn("Cloud addStaff skipped:", err);
      }
    }

    const all = getFromLocal<Staff>(STORAGE_KEYS.STAFF, email);
    all.push(staff);
    saveToLocal(STORAGE_KEYS.STAFF, all, email);
  },

  // --------------------------------------------------------------------------
  // ATTENDANCE
  // --------------------------------------------------------------------------
  async getAttendance(email: string): Promise<Attendance[]> {
    if (isSupabaseConfigured && supabase) {
      const branchId = await getActiveBranchId(email);
      let query = supabase
        .from('attendance')
        .select('*')
        .order('date', { ascending: false });

      if (branchId) {
        query = query.eq('branch_id', branchId);
      }

      const { data, error } = await query;

      if (!error && data) {
        const att: Attendance[] = data.map(row => ({
          id: row.id,
          staffId: row.staff_id,
          date: row.date,
          status: row.status
        }));
        saveToLocal(STORAGE_KEYS.ATTENDANCE, att, email);
        return att;
      }
    }
    return getFromLocal<Attendance>(STORAGE_KEYS.ATTENDANCE, email);
  },

  async upsertAttendance(email: string, attendance: Attendance) {
    if (isSupabaseConfigured && supabase) {
      try {
        const userId = await requireAuthUserId();
        if (userId) {
          const branchId = await getActiveBranchId(email);
          const payload: any = {
            id: attendance.id,
            user_id: userId,
            staff_id: attendance.staffId,
            date: attendance.date,
            status: attendance.status
          };
          if (branchId) {
            payload.branch_id = branchId;
          }
          const { error } = await supabase.from('attendance').upsert(payload);
          if (error && !isPgrstMissingTableError(error)) {
            console.warn("Supabase upsertAttendance warning:", error.message);
          }
        }
      } catch (err) {
        console.warn("Cloud upsertAttendance skipped:", err);
      }
    }

    const all = getFromLocal<Attendance>(STORAGE_KEYS.ATTENDANCE, email);
    const index = all.findIndex(item => item.staffId === attendance.staffId && item.date === attendance.date);
    if (index > -1) {
      all[index] = attendance;
    } else {
      all.push(attendance);
    }
    saveToLocal(STORAGE_KEYS.ATTENDANCE, all, email);
  },

  // --------------------------------------------------------------------------
  // DEDUCTIONS
  // --------------------------------------------------------------------------
  async getDeductions(email: string): Promise<Deduction[]> {
    if (isSupabaseConfigured && supabase) {
      const branchId = await getActiveBranchId(email);
      let query = supabase
        .from('deductions')
        .select('*')
        .order('date', { ascending: false });

      if (branchId) {
        query = query.eq('branch_id', branchId);
      }

      const { data, error } = await query;

      if (!error && data) {
        const ded: Deduction[] = data.map(row => ({
          id: row.id,
          staffId: row.staff_id,
          amount: Number(row.amount),
          reason: row.reason,
          date: row.date
        }));
        saveToLocal(STORAGE_KEYS.DEDUCTIONS, ded, email);
        return ded;
      }
    }
    return getFromLocal<Deduction>(STORAGE_KEYS.DEDUCTIONS, email);
  },

  async addDeduction(email: string, deduction: Deduction) {
    if (isSupabaseConfigured && supabase) {
      try {
        const userId = await requireAuthUserId();
        if (userId) {
          const branchId = await getActiveBranchId(email);
          const payload: any = {
            id: deduction.id,
            user_id: userId,
            staff_id: deduction.staffId,
            amount: deduction.amount,
            reason: deduction.reason,
            date: deduction.date
          };
          if (branchId) {
            payload.branch_id = branchId;
          }
          const { error } = await supabase.from('deductions').insert(payload);
          if (error && !isPgrstMissingTableError(error)) {
            console.warn("Supabase addDeduction warning:", error.message);
          }
        }
      } catch (err) {
        console.warn("Cloud addDeduction skipped:", err);
      }
    }

    const all = getFromLocal<Deduction>(STORAGE_KEYS.DEDUCTIONS, email);
    all.push(deduction);
    saveToLocal(STORAGE_KEYS.DEDUCTIONS, all, email);
  },

  // --------------------------------------------------------------------------
  // DAILY CLOSINGS
  // --------------------------------------------------------------------------
  async getClosings(email: string): Promise<DailyClosing[]> {
    if (isSupabaseConfigured && supabase) {
      const branchId = await getActiveBranchId(email);
      let query = supabase
        .from('daily_closings')
        .select('*')
        .order('date', { ascending: false });

      if (branchId) {
        query = query.eq('branch_id', branchId);
      }

      const { data, error } = await query;

      if (!error && data) {
        const closings: DailyClosing[] = data.map(row => ({
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
        saveToLocal(STORAGE_KEYS.CLOSINGS, closings, email);
        return closings;
      }
    }
    return getFromLocal<DailyClosing>(STORAGE_KEYS.CLOSINGS, email);
  },

  async addClosing(email: string, closing: DailyClosing) {
    if (isSupabaseConfigured && supabase) {
      try {
        const userId = await requireAuthUserId();
        if (userId) {
          const branchId = await getActiveBranchId(email);
          const payload: any = {
            id: closing.id,
            user_id: userId,
            date: closing.date,
            total_sales: closing.totalSales,
            total_cash_collected: closing.totalCashCollected,
            total_cash_payments: closing.totalCashPayments,
            total_mobile_payments: closing.totalMobilePayments,
            totalExpenses: closing.totalExpenses,
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
          if (error && !isPgrstMissingTableError(error)) {
            console.warn("Supabase addClosing warning:", error.message);
          }
        }
      } catch (err) {
        console.warn("Cloud addClosing skipped:", err);
      }
    }

    const all = getFromLocal<DailyClosing>(STORAGE_KEYS.CLOSINGS, email);
    all.push(closing);
    saveToLocal(STORAGE_KEYS.CLOSINGS, all, email);
  },

  async updateClosing(email: string, updatedClosing: DailyClosing) {
    if (isSupabaseConfigured && supabase) {
      try {
        const userId = await requireAuthUserId();
        if (userId) {
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
          if (error && !isPgrstMissingTableError(error)) {
            console.warn("Supabase updateClosing warning:", error.message);
          }
        }
      } catch (err) {
        console.warn("Cloud updateClosing skipped:", err);
      }
    }

    const all = getFromLocal<DailyClosing>(STORAGE_KEYS.CLOSINGS, email);
    const updated = all.map(c => c.id === updatedClosing.id ? updatedClosing : c);
    saveToLocal(STORAGE_KEYS.CLOSINGS, updated, email);
  },

  async deleteClosing(email: string, id: string) {
    if (isSupabaseConfigured && supabase) {
      try {
        const userId = await requireAuthUserId();
        if (userId) {
          const { error } = await supabase.from('daily_closings').delete().eq('id', id);
          if (error && !isPgrstMissingTableError(error)) {
            console.warn("Supabase deleteClosing warning:", error.message);
          }
        }
      } catch (err) {
        console.warn("Cloud deleteClosing skipped:", err);
      }
    }

    const all = getFromLocal<DailyClosing>(STORAGE_KEYS.CLOSINGS, email);
    saveToLocal(STORAGE_KEYS.CLOSINGS, all.filter(c => c.id !== id), email);
  },

  // --------------------------------------------------------------------------
  // MONTHLY CLOSINGS
  // --------------------------------------------------------------------------
  async getMonthlyClosings(email: string): Promise<MonthlyClosing[]> {
    if (isSupabaseConfigured && supabase) {
      const branchId = await getActiveBranchId(email);
      let query = supabase
        .from('monthly_closings')
        .select('*')
        .order('timestamp', { ascending: false });

      if (branchId) {
        query = query.eq('branch_id', branchId);
      }

      const { data, error } = await query;

      if (!error && data) {
        const mc: MonthlyClosing[] = data.map(row => ({
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
        saveToLocal(STORAGE_KEYS.MONTHLY_CLOSINGS, mc, email);
        return mc;
      }
    }
    return getFromLocal<MonthlyClosing>(STORAGE_KEYS.MONTHLY_CLOSINGS, email);
  },

  async addMonthlyClosing(email: string, closing: MonthlyClosing) {
    if (isSupabaseConfigured && supabase) {
      try {
        const userId = await requireAuthUserId();
        if (userId) {
          const branchId = await getActiveBranchId(email);
          const payload: any = {
            id: closing.id,
            user_id: userId,
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
          if (error && !isPgrstMissingTableError(error)) {
            console.warn("Supabase addMonthlyClosing warning:", error.message);
          }
        }
      } catch (err) {
        console.warn("Cloud addMonthlyClosing skipped:", err);
      }
    }

    const all = getFromLocal<MonthlyClosing>(STORAGE_KEYS.MONTHLY_CLOSINGS, email);
    all.push(closing);
    saveToLocal(STORAGE_KEYS.MONTHLY_CLOSINGS, all, email);
  },

  async deleteMonthlyClosing(email: string, id: string) {
    if (isSupabaseConfigured && supabase) {
      try {
        const userId = await requireAuthUserId();
        if (userId) {
          const { error } = await supabase.from('monthly_closings').delete().eq('id', id);
          if (error && !isPgrstMissingTableError(error)) {
            console.warn("Supabase deleteMonthlyClosing warning:", error.message);
          }
        }
      } catch (err) {
        console.warn("Cloud deleteMonthlyClosing skipped:", err);
      }
    }

    const all = getFromLocal<MonthlyClosing>(STORAGE_KEYS.MONTHLY_CLOSINGS, email);
    saveToLocal(STORAGE_KEYS.MONTHLY_CLOSINGS, all.filter(c => c.id !== id), email);
  },

  // --------------------------------------------------------------------------
  // PRODUCTION
  // --------------------------------------------------------------------------
  async getProduction(email: string): Promise<Production[]> {
    if (isSupabaseConfigured && supabase) {
      const branchId = await getActiveBranchId(email);
      let query = supabase
        .from('production')
        .select('*')
        .order('date', { ascending: false });

      if (branchId) {
        query = query.eq('branch_id', branchId);
      }

      const { data, error } = await query;

      if (!error && data) {
        const prodList: Production[] = data.map(row => ({
          id: row.id,
          productId: row.product_id || '',
          productName: row.product_name,
          quantity: Number(row.quantity),
          unit: row.unit,
          unitPrice: Number(row.unit_price),
          totalValue: Number(row.total_value),
          date: row.date
        }));
        saveToLocal(STORAGE_KEYS.PRODUCTION, prodList, email);
        return prodList;
      }
    }
    return getFromLocal<Production>(STORAGE_KEYS.PRODUCTION, email);
  },

  async addProduction(email: string, production: Production) {
    if (isSupabaseConfigured && supabase) {
      try {
        const userId = await requireAuthUserId();
        if (userId) {
          const branchId = await getActiveBranchId(email);
          const payload: any = {
            id: production.id,
            user_id: userId,
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
          if (error && !isPgrstMissingTableError(error)) {
            console.warn("Supabase addProduction warning:", error.message);
          }
        }
      } catch (err) {
        console.warn("Cloud addProduction skipped:", err);
      }
    }

    const all = getFromLocal<Production>(STORAGE_KEYS.PRODUCTION, email);
    all.push(production);
    saveToLocal(STORAGE_KEYS.PRODUCTION, all, email);
  },

  async deleteProduction(email: string, id: string) {
    if (isSupabaseConfigured && supabase) {
      try {
        const userId = await requireAuthUserId();
        if (userId) {
          const { error } = await supabase.from('production').delete().eq('id', id);
          if (error && !isPgrstMissingTableError(error)) {
            console.warn("Supabase deleteProduction warning:", error.message);
          }
        }
      } catch (err) {
        console.warn("Cloud deleteProduction skipped:", err);
      }
    }

    const all = getFromLocal<Production>(STORAGE_KEYS.PRODUCTION, email);
    saveToLocal(STORAGE_KEYS.PRODUCTION, all.filter(p => p.id !== id), email);
  },

  // --------------------------------------------------------------------------
  // DAILY NOTES
  // --------------------------------------------------------------------------
  async getNotes(email: string): Promise<DailyNote[]> {
    if (isSupabaseConfigured && supabase) {
      const branchId = await getActiveBranchId(email);
      let query = supabase
        .from('daily_notes')
        .select('*')
        .order('created_at', { ascending: false });

      if (branchId) {
        query = query.eq('branch_id', branchId);
      }

      const { data, error } = await query;

      if (!error && data) {
        const noteList: DailyNote[] = data.map(row => ({
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
        saveToLocal(STORAGE_KEYS.NOTES, noteList, email);
        return noteList;
      }
    }
    return getFromLocal<DailyNote>(STORAGE_KEYS.NOTES, email);
  },

  async addNote(email: string, note: DailyNote) {
    if (isSupabaseConfigured && supabase) {
      try {
        const userId = await requireAuthUserId();
        if (userId) {
          const branchId = await getActiveBranchId(email);
          const payload: any = {
            id: note.id,
            user_id: userId,
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
          if (error && !isPgrstMissingTableError(error)) {
            console.warn("Supabase addNote warning:", error.message);
          }
        }
      } catch (err) {
        console.warn("Cloud addNote skipped:", err);
      }
    }

    const all = getFromLocal<DailyNote>(STORAGE_KEYS.NOTES, email);
    all.unshift(note);
    saveToLocal(STORAGE_KEYS.NOTES, all, email);
  },

  async updateNote(email: string, updatedNote: DailyNote) {
    if (isSupabaseConfigured && supabase) {
      try {
        const userId = await requireAuthUserId();
        if (userId) {
          const { error } = await supabase.from('daily_notes').update({
            title: updatedNote.title,
            content: updatedNote.content,
            priority: updatedNote.priority,
            status: updatedNote.status,
            assigned_to: updatedNote.assignedTo || null,
            author: updatedNote.author,
            pinned: updatedNote.pinned || false
          }).eq('id', updatedNote.id);
          if (error && !isPgrstMissingTableError(error)) {
            console.warn("Supabase updateNote warning:", error.message);
          }
        }
      } catch (err) {
        console.warn("Cloud updateNote skipped:", err);
      }
    }

    const all = getFromLocal<DailyNote>(STORAGE_KEYS.NOTES, email);
    const index = all.findIndex(n => n.id === updatedNote.id);
    if (index > -1) {
      all[index] = updatedNote;
      saveToLocal(STORAGE_KEYS.NOTES, all, email);
    }
  },

  async deleteNote(email: string, id: string) {
    if (isSupabaseConfigured && supabase) {
      try {
        const userId = await requireAuthUserId();
        if (userId) {
          const { error } = await supabase.from('daily_notes').delete().eq('id', id);
          if (error && !isPgrstMissingTableError(error)) {
            console.warn("Supabase deleteNote warning:", error.message);
          }
        }
      } catch (err) {
        console.warn("Cloud deleteNote skipped:", err);
      }
    }

    const all = getFromLocal<DailyNote>(STORAGE_KEYS.NOTES, email);
    saveToLocal(STORAGE_KEYS.NOTES, all.filter(n => n.id !== id), email);
  },

  // --------------------------------------------------------------------------
  // USER CLEANUP & UTILITIES
  // --------------------------------------------------------------------------
  async clearAllDataForUser(email: string): Promise<void> {
    const cleanEmail = email.trim().toLowerCase();
    try {
      if (isSupabaseConfigured && supabase) {
        const userId = await requireAuthUserId();
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
            await supabase.from('sales').delete().eq('user_id', userId);
            await supabase.from('products').delete().eq('user_id', userId);
            await supabase.from('expenses').delete().eq('user_id', userId);
            await supabase.from('wastage').delete().eq('user_id', userId);
            await supabase.from('staff').delete().eq('user_id', userId);
            await supabase.from('attendance').delete().eq('user_id', userId);
            await supabase.from('deductions').delete().eq('user_id', userId);
            await supabase.from('daily_closings').delete().eq('user_id', userId);
            await supabase.from('monthly_closings').delete().eq('user_id', userId);
            await supabase.from('production').delete().eq('user_id', userId);
            await supabase.from('daily_notes').delete().eq('user_id', userId);
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
  }
};
