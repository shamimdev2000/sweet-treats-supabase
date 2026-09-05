/*
# Database Indexes for Performance

## Purpose
Creates indexes on columns frequently used in WHERE clauses, JOINs, and ORDER BY
to ensure fast queries as data grows across multiple branches and users.

## Indexes Created

### Branch-scoped filtering (all tables have branch_id)
- idx_products_branch_id ON products(branch_id)
- idx_production_branch_id ON production(branch_id)
- idx_wastage_branch_id ON wastage(branch_id)
- idx_sales_branch_id ON sales(branch_id)
- idx_sale_items_branch_id ON sale_items(branch_id)
- idx_payments_branch_id ON payments(branch_id)
- idx_expenses_branch_id ON expenses(branch_id)
- idx_staff_branch_id ON staff(branch_id)
- idx_attendance_branch_id ON attendance(branch_id)
- idx_deductions_branch_id ON deductions(branch_id)
- idx_daily_closings_branch_id ON daily_closings(branch_id)
- idx_monthly_closings_branch_id ON monthly_closings(branch_id)
- idx_daily_notes_branch_id ON daily_notes(branch_id)
- idx_audit_logs_branch_id ON audit_logs(branch_id)

### Date-based queries (sales by date, expenses by date, etc.)
- idx_sales_date ON sales(date DESC)
- idx_production_date ON production(date DESC)
- idx_wastage_date ON wastage(date DESC)
- idx_expenses_date ON expenses(date DESC)
- idx_daily_closings_date ON daily_closings(date DESC)
- idx_daily_notes_created_at ON daily_notes(created_at DESC)
- idx_audit_logs_created_at ON audit_logs(created_at DESC)

### Composite indexes for common query patterns
- idx_attendance_staff_date ON attendance(staff_id, date) — supports UNIQUE constraint + lookups
- idx_sale_items_sale_id ON sale_items(sale_id) — join from sales to items
- idx_payments_sale_id ON payments(sale_id) — join from sales to payments
- idx_production_product_id ON production(product_id) — reconciliation queries
- idx_wastage_product_id ON wastage(product_id) — reconciliation queries
- idx_deductions_staff_id ON deductions(staff_id) — salary calculations

### Foreign key indexes (for referential integrity lookups)
- idx_branch_memberships_user_id ON branch_memberships(user_id)
- idx_branch_memberships_branch_id ON branch_memberships(branch_id)
*/

-- Branch-scoped filtering indexes
CREATE INDEX IF NOT EXISTS idx_products_branch_id ON public.products(branch_id);
CREATE INDEX IF NOT EXISTS idx_production_branch_id ON public.production(branch_id);
CREATE INDEX IF NOT EXISTS idx_wastage_branch_id ON public.wastage(branch_id);
CREATE INDEX IF NOT EXISTS idx_sales_branch_id ON public.sales(branch_id);
CREATE INDEX IF NOT EXISTS idx_sale_items_branch_id ON public.sale_items(branch_id);
CREATE INDEX IF NOT EXISTS idx_payments_branch_id ON public.payments(branch_id);
CREATE INDEX IF NOT EXISTS idx_expenses_branch_id ON public.expenses(branch_id);
CREATE INDEX IF NOT EXISTS idx_staff_branch_id ON public.staff(branch_id);
CREATE INDEX IF NOT EXISTS idx_attendance_branch_id ON public.attendance(branch_id);
CREATE INDEX IF NOT EXISTS idx_deductions_branch_id ON public.deductions(branch_id);
CREATE INDEX IF NOT EXISTS idx_daily_closings_branch_id ON public.daily_closings(branch_id);
CREATE INDEX IF NOT EXISTS idx_monthly_closings_branch_id ON public.monthly_closings(branch_id);
CREATE INDEX IF NOT EXISTS idx_daily_notes_branch_id ON public.daily_notes(branch_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_branch_id ON public.audit_logs(branch_id);

-- Date-based indexes
CREATE INDEX IF NOT EXISTS idx_sales_date ON public.sales(date DESC);
CREATE INDEX IF NOT EXISTS idx_production_date ON public.production(date DESC);
CREATE INDEX IF NOT EXISTS idx_wastage_date ON public.wastage(date DESC);
CREATE INDEX IF NOT EXISTS idx_expenses_date ON public.expenses(date DESC);
CREATE INDEX IF NOT EXISTS idx_daily_closings_date ON public.daily_closings(date DESC);
CREATE INDEX IF NOT EXISTS idx_daily_notes_created_at ON public.daily_notes(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_logs_created_at ON public.audit_logs(created_at DESC);

-- Composite / join indexes
CREATE INDEX IF NOT EXISTS idx_attendance_staff_date ON public.attendance(staff_id, date);
CREATE INDEX IF NOT EXISTS idx_sale_items_sale_id ON public.sale_items(sale_id);
CREATE INDEX IF NOT EXISTS idx_payments_sale_id ON public.payments(sale_id);
CREATE INDEX IF NOT EXISTS idx_production_product_id ON public.production(product_id);
CREATE INDEX IF NOT EXISTS idx_wastage_product_id ON public.wastage(product_id);
CREATE INDEX IF NOT EXISTS idx_deductions_staff_id ON public.deductions(staff_id);

-- Membership lookups
CREATE INDEX IF NOT EXISTS idx_branch_memberships_user_id ON public.branch_memberships(user_id);
CREATE INDEX IF NOT EXISTS idx_branch_memberships_branch_id ON public.branch_memberships(branch_id);
