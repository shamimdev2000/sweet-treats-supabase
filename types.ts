
export interface Product {
  id: string;
  name: string;
  category: string;
  price: number;
  stock: number;
  unit: string; // e.g., 'pcs', 'kg', 'gm', 'pkt', 'ltr'
  barcode?: string;
}

export interface SaleItem {
  productId: string;
  productName: string;
  quantity: number;
  unit: string;
  pricePerUnit: number;
  subTotal: number;
}

export interface Payment {
  id: string;
  amount: number;
  date: string;
  method: 'Cash' | 'Mobile Payment';
}

export interface Sale {
  id: string;
  items: SaleItem[];
  totalPrice: number;
  discount?: number;
  amountPaid: number;
  dueAmount: number;
  customerName?: string;
  customerPhone?: string;
  paymentMethod: 'Cash' | 'Mobile Payment';
  mobileProvider?: 'Bkash' | 'Nagad' | 'Rocket' | 'Other';
  transactionId?: string;
  date: string;
  payments?: Payment[];
}

export interface Expense {
  id: string;
  description: string;
  amount: number;
  category: 'Raw Material' | 'Utilities' | 'Rent' | 'Staff' | 'Salary' | 'Other';
  date: string;
}

export interface Wastage {
  id: string;
  productId: string;
  productName: string;
  quantity: number;
  unit: string;
  lossValue: number;
  reason: string;
  date: string;
}

export interface Staff {
  id: string;
  name: string;
  designation: string;
  monthlySalary: number;
  joinDate: string;
}

export interface Attendance {
  id: string;
  staffId: string;
  date: string; // YYYY-MM-DD
  status: 'Present' | 'Late' | 'Absent';
}

export interface Deduction {
  id: string;
  staffId: string;
  amount: number;
  reason: string;
  date: string;
}

export interface DailyClosing {
  id: string;
  date: string; // YYYY-MM-DD
  totalSales: number;
  totalCashCollected: number; // Total of all payments (Cash + Mobile)
  totalCashPayments: number; // Only physical cash payments
  totalMobilePayments: number; // Only mobile payments
  totalExpenses: number;
  totalWastage: number;
  systemBalance: number; // Usually totalCashPayments - totalExpenses
  actualCash: number;
  difference: number;
  closedBy: string;
  timestamp: string;
}

export interface MonthlyClosing {
  id: string;
  month: string; // e.g., 'March 2026'
  totalSales: number;
  totalCashPayments: number;
  totalMobilePayments: number;
  totalExpenses: number;
  totalWastage: number;
  totalProfit: number;
  totalDues?: number;
  closedBy: string;
  timestamp: string;
}

export interface Production {
  id: string;
  productId: string;
  productName: string;
  quantity: number;
  unit: string;
  unitPrice: number;
  totalValue: number;
  date: string;
}

export interface DailyNote {
  id: string;
  title: string;
  content: string;
  priority: 'normal' | 'urgent' | 'info';
  status: 'active' | 'completed';
  assignedTo?: string;
  author: string;
  createdAt: string;
  pinned?: boolean;
}

export interface Branch {
  id: string;
  name: string;
  code?: string;
  address?: string;
  phone?: string;
  isMain?: boolean;
  createdBy?: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface BranchMembership {
  id: string;
  userId: string;
  branchId: string;
  role: 'owner' | 'admin' | 'manager' | 'cashier' | 'staff' | 'user';
  createdAt: string;
}

export interface UserProfile {
  id: string;
  email: string;
  username: string;
  businessName: string;
  ownerName: string;
  phone?: string;
  address?: string;
  password?: string;
  managerPin: string;
  currencySymbol?: string;
  receiptFooter?: string;
  branchId?: string;
  role?: string;
  createdAt: string;
  lastLogin?: string;
}

export enum View {
  DASHBOARD = 'DASHBOARD',
  SALES = 'SALES',
  INVENTORY = 'INVENTORY',
  NOTES = 'NOTES',
  EXPENSES = 'EXPENSES',
  STAFF = 'STAFF',
  MANAGER = 'MANAGER',
  DAILY_CLOSING = 'DAILY_CLOSING',
  DUES = 'DUES',
  WASTAGE = 'WASTAGE',
  MONTHLY_CLOSING = 'MONTHLY_CLOSING',
  PRODUCTION = 'PRODUCTION'
}
