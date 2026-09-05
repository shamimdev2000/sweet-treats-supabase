import { Product, Sale, Expense, Wastage, Staff, Attendance, DailyClosing, Deduction, MonthlyClosing, Production, DailyNote, UserProfile } from '../types';
import { supabase } from './supabaseClient';

// Cache: email -> branch_id
const branchIdCache = new Map<string, string>();

async function getBranchId(email: string): Promise<string> {
  const cleanEmail = email.trim().toLowerCase();
  if (branchIdCache.has(cleanEmail)) return branchIdCache.get(cleanEmail)!;

  const { data, error } = await supabase.rpc('ensure_default_branch', { p_user_email: cleanEmail });
  if (error) {
    console.error('ensure_default_branch error:', error);
    throw error;
  }

  branchIdCache.set(cleanEmail, data);
  return data as string;
}

function clearBranchCache(email?: string) {
  if (email) {
    branchIdCache.delete(email.trim().toLowerCase());
  } else {
    branchIdCache.clear();
  }
}

// ── Mapping helpers (snake_case DB ↔ camelCase TS) ──

function mapProduct(row: any): Product {
  return {
    id: row.id,
    name: row.name,
    category: row.category,
    price: Number(row.price),
    stock: Number(row.stock),
    unit: row.unit,
    barcode: row.barcode || undefined,
  };
}

function mapSale(row: any): Sale {
  return {
    id: row.id,
    items: (row.sale_items || []).map((item: any) => ({
      productId: item.product_id,
      productName: item.product_name,
      quantity: Number(item.quantity),
      unit: item.unit,
      pricePerUnit: Number(item.price_per_unit),
      subTotal: Number(item.sub_total),
    })),
    totalPrice: Number(row.total_price),
    discount: Number(row.discount) || 0,
    amountPaid: Number(row.amount_paid),
    dueAmount: Number(row.due_amount),
    customerName: row.customer_name || undefined,
    customerPhone: row.customer_phone || undefined,
    paymentMethod: row.payment_method,
    mobileProvider: row.mobile_provider || undefined,
    transactionId: row.transaction_id || undefined,
    date: row.date,
    payments: (row.payments || []).map((p: any) => ({
      id: p.id,
      amount: Number(p.amount),
      date: p.date,
      method: p.method,
    })),
  };
}

function mapExpense(row: any): Expense {
  return {
    id: row.id,
    description: row.description,
    amount: Number(row.amount),
    category: row.category,
    date: row.date,
  };
}

function mapWastage(row: any): Wastage {
  return {
    id: row.id,
    productId: row.product_id,
    productName: row.product_name,
    quantity: Number(row.quantity),
    unit: row.unit,
    lossValue: Number(row.loss_value),
    reason: row.reason,
    date: row.date,
  };
}

function mapStaff(row: any): Staff {
  return {
    id: row.id,
    name: row.name,
    designation: row.designation,
    monthlySalary: Number(row.monthly_salary),
    joinDate: row.join_date,
  };
}

function mapAttendance(row: any): Attendance {
  return {
    id: row.id,
    staffId: row.staff_id,
    date: row.date,
    status: row.status,
  };
}

function mapDeduction(row: any): Deduction {
  return {
    id: row.id,
    staffId: row.staff_id,
    amount: Number(row.amount),
    reason: row.reason,
    date: row.date,
  };
}

function mapDailyClosing(row: any): DailyClosing {
  return {
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
    timestamp: row.timestamp,
  };
}

function mapMonthlyClosing(row: any): MonthlyClosing {
  return {
    id: row.id,
    month: row.month,
    totalSales: Number(row.total_sales),
    totalCashPayments: Number(row.total_cash_payments),
    totalMobilePayments: Number(row.total_mobile_payments),
    totalExpenses: Number(row.total_expenses),
    totalWastage: Number(row.total_wastage),
    totalProfit: Number(row.total_profit),
    totalDues: Number(row.total_dues) || 0,
    closedBy: row.closed_by,
    timestamp: row.timestamp,
  };
}

function mapProduction(row: any): Production {
  return {
    id: row.id,
    productId: row.product_id,
    productName: row.product_name,
    quantity: Number(row.quantity),
    unit: row.unit,
    unitPrice: Number(row.unit_price),
    totalValue: Number(row.total_value),
    date: row.date,
  };
}

function mapDailyNote(row: any): DailyNote {
  return {
    id: row.id,
    title: row.title,
    content: row.content,
    priority: row.priority,
    status: row.status,
    assignedTo: row.assigned_to || undefined,
    author: row.author,
    createdAt: row.created_at,
    pinned: row.pinned || false,
  };
}

// ── Storage Service (same interface, Supabase backend) ──

export const storageService = {
  // ── Profiles ──
  getProfiles(): UserProfile[] {
    return [];
  },

  saveProfiles(_profiles: UserProfile[]): void {
    // No-op: profiles are managed by Supabase Auth + profiles table
  },

  getProfileByEmail(email: string): UserProfile | null {
    // Synchronous fallback for code that hasn't been converted to async yet
    // Returns null; callers should use getProfileByEmailAsync
    return null;
  },

  async getProfileByEmailAsync(email: string): Promise<UserProfile | null> {
    const cleanEmail = email.trim().toLowerCase();
    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('email', cleanEmail)
      .maybeSingle();

    if (error || !data) return null;

    return {
      id: data.id,
      email: data.email,
      username: data.email.split('@')[0],
      businessName: data.business_name || data.full_name || 'My Bakery',
      ownerName: data.owner_name || data.full_name || data.email.split('@')[0],
      phone: data.phone || undefined,
      address: data.address || undefined,
      managerPin: data.manager_pin || '123456',
      currencySymbol: data.currency_symbol || '৳',
      receiptFooter: data.receipt_footer || 'Thank you for shopping with us!',
      createdAt: data.created_at,
      starterPack: false,
    } as UserProfile;
  },

  saveProfile(_profile: UserProfile): void {
    // No-op: use updateProfile
  },

  async updateProfile(email: string, updates: Partial<UserProfile>): Promise<UserProfile | null> {
    const cleanEmail = email.trim().toLowerCase();
    const dbUpdates: any = {};
    if (updates.businessName !== undefined) dbUpdates.business_name = updates.businessName;
    if (updates.ownerName !== undefined) dbUpdates.owner_name = updates.ownerName;
    if (updates.phone !== undefined) dbUpdates.phone = updates.phone;
    if (updates.address !== undefined) dbUpdates.address = updates.address;
    if (updates.managerPin !== undefined) dbUpdates.manager_pin = updates.managerPin;
    if (updates.currencySymbol !== undefined) dbUpdates.currency_symbol = updates.currencySymbol;
    if (updates.receiptFooter !== undefined) dbUpdates.receipt_footer = updates.receiptFooter;
    if (updates.full_name !== undefined) dbUpdates.full_name = updates.full_name;

    if (Object.keys(dbUpdates).length === 0) {
      return await this.getProfileByEmailAsync(cleanEmail);
    }

    const { data: authData } = await supabase.auth.getUser();
    if (!authData.user) return null;

    const { data, error } = await supabase
      .from('profiles')
      .update(dbUpdates)
      .eq('id', authData.user.id)
      .select('*')
      .maybeSingle();

    if (error) {
      console.error('updateProfile error:', error);
      return null;
    }

    if (!data) return null;

    return {
      id: data.id,
      email: data.email,
      username: data.email.split('@')[0],
      businessName: data.business_name || data.full_name || 'My Bakery',
      ownerName: data.owner_name || data.full_name || data.email.split('@')[0],
      phone: data.phone || undefined,
      address: data.address || undefined,
      managerPin: data.manager_pin || '123456',
      currencySymbol: data.currency_symbol || '৳',
      receiptFooter: data.receipt_footer || 'Thank you for shopping with us!',
      createdAt: data.created_at,
      starterPack: false,
    } as UserProfile;
  },

  getManagerPin(email: string): string {
    return '123456';
  },

  async getManagerPinAsync(email: string): Promise<string> {
    const profile = await this.getProfileByEmailAsync(email);
    return profile?.managerPin || '123456';
  },

  setManagerPin(email: string, newPin: string): void {
    this.updateProfile(email, { managerPin: newPin });
  },

  // ── Products ──
  async getProducts(email: string): Promise<Product[]> {
    const branchId = await getBranchId(email);
    const { data, error } = await supabase
      .from('products')
      .select('*')
      .eq('branch_id', branchId)
      .order('name', { ascending: true });

    if (error) {
      console.error('getProducts error:', error);
      return [];
    }

    return (data || []).map(mapProduct);
  },

  async upsertProduct(email: string, product: Product): Promise<void> {
    const branchId = await getBranchId(email);

    // Check if product exists
    const { data: existing } = await supabase
      .from('products')
      .select('id')
      .eq('id', product.id)
      .eq('branch_id', branchId)
      .maybeSingle();

    if (existing) {
      // Update only non-stock fields (stock is managed by RPC functions)
      const { error } = await supabase
        .from('products')
        .update({
          name: product.name,
          category: product.category,
          price: product.price,
          unit: product.unit,
          barcode: product.barcode || null,
        })
        .eq('id', product.id)
        .eq('branch_id', branchId);

      if (error) console.error('upsertProduct update error:', error);
    } else {
      // Insert new product with initial stock
      const { error } = await supabase
        .from('products')
        .insert({
          id: product.id,
          branch_id: branchId,
          name: product.name,
          category: product.category,
          price: product.price,
          stock: product.stock,
          unit: product.unit,
          barcode: product.barcode || null,
        });

      if (error) console.error('upsertProduct insert error:', error);
    }
  },

  async deleteProduct(email: string, id: string): Promise<void> {
    const branchId = await getBranchId(email);
    const { error } = await supabase
      .from('products')
      .delete()
      .eq('id', id)
      .eq('branch_id', branchId);

    if (error) console.error('deleteProduct error:', error);
  },

  // ── Sales ──
  async getSales(email: string): Promise<Sale[]> {
    const branchId = await getBranchId(email);
    const { data, error } = await supabase
      .from('sales')
      .select('*, sale_items(*), payments(*)')
      .eq('branch_id', branchId)
      .order('date', { ascending: false });

    if (error) {
      console.error('getSales error:', error);
      return [];
    }

    return (data || []).map(mapSale);
  },

  async addSale(email: string, sale: Sale): Promise<void> {
    const branchId = await getBranchId(email);

    const itemsJson = sale.items.map(item => ({
      product_id: item.productId,
      product_name: item.productName,
      quantity: item.quantity,
      unit: item.unit,
      price_per_unit: item.pricePerUnit,
      sub_total: item.subTotal,
      category: (item as any).category || undefined,
    }));

    const { data, error } = await supabase.rpc('create_sale', {
      p_branch_id: branchId,
      p_items: itemsJson,
      p_total_price: sale.totalPrice,
      p_discount: sale.discount || 0,
      p_amount_paid: sale.amountPaid,
      p_payment_method: sale.paymentMethod,
      p_customer_name: sale.customerName || null,
      p_customer_phone: sale.customerPhone || null,
      p_mobile_provider: sale.mobileProvider || null,
      p_transaction_id: sale.transactionId || null,
    });

    if (error) {
      console.error('addSale error:', error);
      throw error;
    }
  },

  async updateSale(email: string, sale: Sale): Promise<void> {
    const branchId = await getBranchId(email);

    // This is called from DuesView for collecting due payments
    // Extract the new payment (last in the payments array)
    const payments = sale.payments || [];
    if (payments.length === 0) return;

    const lastPayment = payments[payments.length - 1];

    const { error } = await supabase.rpc('collect_due_payment', {
      p_branch_id: branchId,
      p_sale_id: sale.id,
      p_amount: lastPayment.amount,
      p_payment_method: lastPayment.method,
      p_mobile_provider: sale.mobileProvider || null,
      p_transaction_id: sale.transactionId || null,
    });

    if (error) {
      console.error('updateSale error:', error);
    }
  },

  async deleteSale(email: string, id: string): Promise<void> {
    const branchId = await getBranchId(email);
    const { error } = await supabase.rpc('cancel_sale', {
      p_branch_id: branchId,
      p_sale_id: id,
    });

    if (error) {
      console.error('deleteSale error:', error);
    }
  },

  // ── Expenses ──
  async getExpenses(email: string): Promise<Expense[]> {
    const branchId = await getBranchId(email);
    const { data, error } = await supabase
      .from('expenses')
      .select('*')
      .eq('branch_id', branchId)
      .order('date', { ascending: false });

    if (error) {
      console.error('getExpenses error:', error);
      return [];
    }

    return (data || []).map(mapExpense);
  },

  async addExpense(email: string, expense: Expense): Promise<void> {
    const branchId = await getBranchId(email);
    const { data: authData } = await supabase.auth.getUser();

    const { error } = await supabase.from('expenses').insert({
      id: expense.id,
      branch_id: branchId,
      description: expense.description,
      amount: expense.amount,
      category: expense.category,
      date: expense.date,
      created_by: authData.user?.id || null,
    });

    if (error) console.error('addExpense error:', error);
  },

  // ── Wastage ──
  async getWastage(email: string): Promise<Wastage[]> {
    const branchId = await getBranchId(email);
    const { data, error } = await supabase
      .from('wastage')
      .select('*')
      .eq('branch_id', branchId)
      .order('date', { ascending: false });

    if (error) {
      console.error('getWastage error:', error);
      return [];
    }

    return (data || []).map(mapWastage);
  },

  async addWastage(email: string, wastage: Wastage): Promise<void> {
    const branchId = await getBranchId(email);

    const { data, error } = await supabase.rpc('record_wastage', {
      p_branch_id: branchId,
      p_product_id: wastage.productId,
      p_quantity: wastage.quantity,
      p_reason: wastage.reason,
    });

    if (error) {
      console.error('addWastage error:', error);
      throw error;
    }
  },

  async deleteWastage(email: string, id: string): Promise<void> {
    const branchId = await getBranchId(email);
    const { error } = await supabase.rpc('delete_wastage', {
      p_branch_id: branchId,
      p_wastage_id: id,
    });

    if (error) {
      console.error('deleteWastage error:', error);
    }
  },

  // ── Staff ──
  async getStaff(email: string): Promise<Staff[]> {
    const branchId = await getBranchId(email);
    const { data, error } = await supabase
      .from('staff')
      .select('*')
      .eq('branch_id', branchId)
      .order('name', { ascending: true });

    if (error) {
      console.error('getStaff error:', error);
      return [];
    }

    return (data || []).map(mapStaff);
  },

  async addStaff(email: string, staff: Staff): Promise<void> {
    const branchId = await getBranchId(email);
    const { data: authData } = await supabase.auth.getUser();

    const { error } = await supabase.from('staff').insert({
      id: staff.id,
      branch_id: branchId,
      name: staff.name,
      designation: staff.designation,
      monthly_salary: staff.monthlySalary,
      join_date: staff.joinDate,
      created_by: authData.user?.id || null,
    });

    if (error) console.error('addStaff error:', error);
  },

  // ── Attendance ──
  async getAttendance(email: string): Promise<Attendance[]> {
    const branchId = await getBranchId(email);
    const { data, error } = await supabase
      .from('attendance')
      .select('*')
      .eq('branch_id', branchId)
      .order('date', { ascending: false });

    if (error) {
      console.error('getAttendance error:', error);
      return [];
    }

    return (data || []).map(mapAttendance);
  },

  async upsertAttendance(email: string, attendance: Attendance): Promise<void> {
    const branchId = await getBranchId(email);

    // Try update first
    const { data: existing } = await supabase
      .from('attendance')
      .select('id')
      .eq('staff_id', attendance.staffId)
      .eq('date', attendance.date)
      .eq('branch_id', branchId)
      .maybeSingle();

    if (existing) {
      const { error } = await supabase
        .from('attendance')
        .update({ status: attendance.status })
        .eq('id', existing.id)
        .eq('branch_id', branchId);

      if (error) console.error('upsertAttendance update error:', error);
    } else {
      const { error } = await supabase.from('attendance').insert({
        id: attendance.id,
        branch_id: branchId,
        staff_id: attendance.staffId,
        date: attendance.date,
        status: attendance.status,
      });

      if (error) console.error('upsertAttendance insert error:', error);
    }
  },

  // ── Daily Closings ──
  async getClosings(email: string): Promise<DailyClosing[]> {
    const branchId = await getBranchId(email);
    const { data, error } = await supabase
      .from('daily_closings')
      .select('*')
      .eq('branch_id', branchId)
      .order('date', { ascending: false });

    if (error) {
      console.error('getClosings error:', error);
      return [];
    }

    return (data || []).map(mapDailyClosing);
  },

  async addClosing(email: string, closing: DailyClosing): Promise<void> {
    const branchId = await getBranchId(email);
    const { data: authData } = await supabase.auth.getUser();

    const { error } = await supabase.from('daily_closings').insert({
      id: closing.id,
      branch_id: branchId,
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
      timestamp: closing.timestamp,
      created_by: authData.user?.id || null,
    });

    if (error) console.error('addClosing error:', error);
  },

  async deleteClosing(email: string, id: string): Promise<void> {
    const branchId = await getBranchId(email);
    const { error } = await supabase
      .from('daily_closings')
      .delete()
      .eq('id', id)
      .eq('branch_id', branchId);

    if (error) console.error('deleteClosing error:', error);
  },

  async updateClosing(email: string, updatedClosing: DailyClosing): Promise<void> {
    const branchId = await getBranchId(email);
    const { error } = await supabase
      .from('daily_closings')
      .update({
        date: updatedClosing.date,
        actual_cash: updatedClosing.actualCash,
        difference: updatedClosing.difference,
      })
      .eq('id', updatedClosing.id)
      .eq('branch_id', branchId);

    if (error) console.error('updateClosing error:', error);
  },

  // ── Deductions ──
  async getDeductions(email: string): Promise<Deduction[]> {
    const branchId = await getBranchId(email);
    const { data, error } = await supabase
      .from('deductions')
      .select('*')
      .eq('branch_id', branchId)
      .order('date', { ascending: false });

    if (error) {
      console.error('getDeductions error:', error);
      return [];
    }

    return (data || []).map(mapDeduction);
  },

  async addDeduction(email: string, deduction: Deduction): Promise<void> {
    const branchId = await getBranchId(email);
    const { data: authData } = await supabase.auth.getUser();

    const { error } = await supabase.from('deductions').insert({
      id: deduction.id,
      branch_id: branchId,
      staff_id: deduction.staffId,
      amount: deduction.amount,
      reason: deduction.reason,
      date: deduction.date,
      created_by: authData.user?.id || null,
    });

    if (error) console.error('addDeduction error:', error);
  },

  // ── Monthly Closings ──
  async getMonthlyClosings(email: string): Promise<MonthlyClosing[]> {
    const branchId = await getBranchId(email);
    const { data, error } = await supabase
      .from('monthly_closings')
      .select('*')
      .eq('branch_id', branchId)
      .order('month', { ascending: false });

    if (error) {
      console.error('getMonthlyClosings error:', error);
      return [];
    }

    return (data || []).map(mapMonthlyClosing);
  },

  async addMonthlyClosing(email: string, closing: MonthlyClosing): Promise<void> {
    const branchId = await getBranchId(email);
    const { data: authData } = await supabase.auth.getUser();

    const { error } = await supabase.from('monthly_closings').insert({
      id: closing.id,
      branch_id: branchId,
      month: closing.month,
      total_sales: closing.totalSales,
      total_cash_payments: closing.totalCashPayments,
      total_mobile_payments: closing.totalMobilePayments,
      total_expenses: closing.totalExpenses,
      total_wastage: closing.totalWastage,
      total_profit: closing.totalProfit,
      total_dues: closing.totalDues || 0,
      closed_by: closing.closedBy,
      timestamp: closing.timestamp,
      created_by: authData.user?.id || null,
    });

    if (error) console.error('addMonthlyClosing error:', error);
  },

  async deleteMonthlyClosing(email: string, id: string): Promise<void> {
    const branchId = await getBranchId(email);
    const { error } = await supabase
      .from('monthly_closings')
      .delete()
      .eq('id', id)
      .eq('branch_id', branchId);

    if (error) console.error('deleteMonthlyClosing error:', error);
  },

  // ── Production ──
  async getProduction(email: string): Promise<Production[]> {
    const branchId = await getBranchId(email);
    const { data, error } = await supabase
      .from('production')
      .select('*')
      .eq('branch_id', branchId)
      .order('date', { ascending: false });

    if (error) {
      console.error('getProduction error:', error);
      return [];
    }

    return (data || []).map(mapProduction);
  },

  async addProduction(email: string, production: Production): Promise<void> {
    const branchId = await getBranchId(email);

    const { data, error } = await supabase.rpc('record_production', {
      p_branch_id: branchId,
      p_product_id: production.productId,
      p_quantity: production.quantity,
      p_unit_price: production.unitPrice,
    });

    if (error) {
      console.error('addProduction error:', error);
      // Fallback: direct insert without stock update (for compatibility)
      const { data: authData } = await supabase.auth.getUser();
      const { error: insertError } = await supabase.from('production').insert({
        id: production.id,
        branch_id: branchId,
        product_id: production.productId,
        product_name: production.productName,
        quantity: production.quantity,
        unit: production.unit,
        unit_price: production.unitPrice,
        total_value: production.totalValue,
        date: production.date,
        created_by: authData.user?.id || null,
      });
      if (insertError) console.error('addProduction fallback error:', insertError);
    }
  },

  async deleteProduction(email: string, id: string): Promise<void> {
    const branchId = await getBranchId(email);
    const { error } = await supabase
      .from('production')
      .delete()
      .eq('id', id)
      .eq('branch_id', branchId);

    if (error) console.error('deleteProduction error:', error);
  },

  // ── Daily Notes ──
  async getNotes(email: string): Promise<DailyNote[]> {
    const branchId = await getBranchId(email);
    const { data, error } = await supabase
      .from('daily_notes')
      .select('*')
      .eq('branch_id', branchId)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('getNotes error:', error);
      return [];
    }

    return (data || []).map(mapDailyNote);
  },

  async addNote(email: string, note: DailyNote): Promise<void> {
    const branchId = await getBranchId(email);
    const { data: authData } = await supabase.auth.getUser();

    const { error } = await supabase.from('daily_notes').insert({
      id: note.id,
      branch_id: branchId,
      title: note.title,
      content: note.content,
      priority: note.priority,
      status: note.status,
      assigned_to: note.assignedTo || null,
      author: note.author,
      pinned: note.pinned || false,
      created_at: note.createdAt,
      created_by: authData.user?.id || null,
    });

    if (error) console.error('addNote error:', error);
  },

  async updateNote(email: string, updatedNote: DailyNote): Promise<void> {
    const branchId = await getBranchId(email);
    const { error } = await supabase
      .from('daily_notes')
      .update({
        title: updatedNote.title,
        content: updatedNote.content,
        priority: updatedNote.priority,
        status: updatedNote.status,
        assigned_to: updatedNote.assignedTo || null,
        pinned: updatedNote.pinned || false,
      })
      .eq('id', updatedNote.id)
      .eq('branch_id', branchId);

    if (error) console.error('updateNote error:', error);
  },

  async deleteNote(email: string, id: string): Promise<void> {
    const branchId = await getBranchId(email);
    const { error } = await supabase
      .from('daily_notes')
      .delete()
      .eq('id', id)
      .eq('branch_id', branchId);

    if (error) console.error('deleteNote error:', error);
  },

  // ── Clear all data for user ──
  async clearAllDataForUser(email: string): Promise<void> {
    const branchId = await getBranchId(email);
    clearBranchCache(email);

    // Delete all data in the branch (order matters for FK constraints)
    const tables = [
      'daily_notes', 'monthly_closings', 'daily_closings',
      'deductions', 'attendance', 'staff',
      'expenses', 'wastage', 'production',
      'sale_items', 'payments', 'sales',
      'products',
    ];

    for (const table of tables) {
      const { error } = await supabase
        .from(table)
        .delete()
        .eq('branch_id', branchId);

      if (error) console.error(`clearAllData ${table} error:`, error);
    }
  },

  // ── Backup & Restore ──
  async exportAllData(email: string): Promise<string> {
    const cleanEmail = email.trim().toLowerCase();
    const profile = await this.getProfileByEmailAsync(cleanEmail);
    const branchId = await getBranchId(cleanEmail);

    const [products, sales, expenses, wastage, staff, attendance, closings, deductions, monthlyClosings, production, notes] = await Promise.all([
      this.getProducts(cleanEmail),
      this.getSales(cleanEmail),
      this.getExpenses(cleanEmail),
      this.getWastage(cleanEmail),
      this.getStaff(cleanEmail),
      this.getAttendance(cleanEmail),
      this.getClosings(cleanEmail),
      this.getDeductions(cleanEmail),
      this.getMonthlyClosings(cleanEmail),
      this.getProduction(cleanEmail),
      this.getNotes(cleanEmail),
    ]);

    return JSON.stringify({
      tenantEmail: cleanEmail,
      businessProfile: profile,
      version: '4.0.0 (Supabase)',
      timestamp: new Date().toISOString(),
      data: {
        products, sales, expenses, wastage, staff, attendance,
        closings, deductions, monthly_closings: monthlyClosings,
        production, notes,
      },
    }, null, 2);
  },

  async importAllData(email: string, jsonData: string): Promise<boolean> {
    const cleanEmail = email.trim().toLowerCase();
    const branchId = await getBranchId(cleanEmail);

    try {
      const parsed = JSON.parse(jsonData);
      if (!parsed.data) return false;
      const d = parsed.data;

      // Import products
      if (Array.isArray(d.products)) {
        for (const p of d.products) {
          await supabase.from('products').upsert({
            id: p.id,
            branch_id: branchId,
            name: p.name,
            category: p.category,
            price: p.price,
            stock: p.stock,
            unit: p.unit,
            barcode: p.barcode || null,
          });
        }
      }

      // Import expenses
      if (Array.isArray(d.expenses)) {
        for (const e of d.expenses) {
          await supabase.from('expenses').insert({
            id: e.id,
            branch_id: branchId,
            description: e.description,
            amount: e.amount,
            category: e.category,
            date: e.date,
          });
        }
      }

      // Import staff
      if (Array.isArray(d.staff)) {
        for (const s of d.staff) {
          await supabase.from('staff').insert({
            id: s.id,
            branch_id: branchId,
            name: s.name,
            designation: s.designation,
            monthly_salary: s.monthlySalary,
            join_date: s.joinDate,
          });
        }
      }

      // Import notes
      if (Array.isArray(d.notes)) {
        for (const n of d.notes) {
          await supabase.from('daily_notes').insert({
            id: n.id,
            branch_id: branchId,
            title: n.title,
            content: n.content,
            priority: n.priority,
            status: n.status,
            assigned_to: n.assignedTo || null,
            author: n.author,
            pinned: n.pinned || false,
            created_at: n.createdAt,
          });
        }
      }

      // Update profile if provided
      if (parsed.businessProfile) {
        await this.updateProfile(cleanEmail, parsed.businessProfile);
      }

      return true;
    } catch (e) {
      console.error('Import error:', e);
      return false;
    }
  },
};
