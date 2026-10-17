-- ==============================================================================
-- KASIRTOKO POS - MASTER SUPABASE POSTGRESQL DATABASE SCHEMA (MULTI-TENANT)
-- INCLUDES: AUTOMATIC DAILY INVOICE NUMBERING (#0001 RESET AT 00:00) & SECURE RPC
-- ==============================================================================

-- 1. EXTENSIONS
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pg_cron";

-- ==============================================================================
-- 2. PROFILES & STORE METADATA (SUPABASE AUTH INTEGRATION)
-- ==============================================================================

CREATE TABLE IF NOT EXISTS public.profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    email TEXT,
    store_name TEXT DEFAULT 'KasirToko POS',
    owner_name TEXT DEFAULT 'Pemilik Toko',
    pin_hash TEXT,
    sub_profiles JSONB DEFAULT '{"kasir_1": {"name": "Kasir 1", "unit": "Unit 1"}, "kasir_2": {"name": "Kasir 2", "unit": "Unit 2"}}'::jsonb,
    created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL
);

ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS email TEXT;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS store_name TEXT DEFAULT 'KasirToko POS';
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS owner_name TEXT DEFAULT 'Pemilik Toko';
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS pin_hash TEXT;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS sub_profiles JSONB DEFAULT '{"kasir_1": {"name": "Kasir 1", "unit": "Unit 1"}, "kasir_2": {"name": "Kasir 2", "unit": "Unit 2"}}'::jsonb;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now());
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now());

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO public.profiles (id, email, store_name, owner_name, sub_profiles)
    VALUES (
        NEW.id,
        NEW.email,
        COALESCE(NEW.raw_user_meta_data->>'store_name', 'KasirToko POS'),
        COALESCE(NEW.raw_user_meta_data->>'owner_name', split_part(NEW.email, '@', 1)),
        COALESCE(
            NEW.raw_user_meta_data->'sub_profiles',
            '{"kasir_1": {"name": "Kasir 1", "unit": "Unit 1"}, "kasir_2": {"name": "Kasir 2", "unit": "Unit 2"}}'::jsonb
        )
    )
    ON CONFLICT (id) DO UPDATE
    SET
        email = EXCLUDED.email,
        store_name = COALESCE(EXCLUDED.store_name, public.profiles.store_name),
        owner_name = COALESCE(EXCLUDED.owner_name, public.profiles.owner_name),
        sub_profiles = COALESCE(EXCLUDED.sub_profiles, public.profiles.sub_profiles),
        updated_at = now();
    RETURN NEW;
EXCEPTION WHEN OTHERS THEN
    RAISE WARNING 'handle_new_user trigger error: %', SQLERRM;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ==============================================================================
-- 3. TABLES DEFINITIONS & MULTI-TENANT ALTERATIONS
-- ==============================================================================

-- Master Products Table
CREATE TABLE IF NOT EXISTS public.products (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE DEFAULT auth.uid(),
    name TEXT NOT NULL,
    category TEXT,
    business_unit TEXT DEFAULT 'Sembako',
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL
);

ALTER TABLE public.products ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE DEFAULT auth.uid();
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS is_active BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS business_unit TEXT DEFAULT 'Sembako';

-- Product Variants Table
CREATE TABLE IF NOT EXISTS public.product_variants (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE DEFAULT auth.uid(),
    product_id UUID NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
    variant_name TEXT NOT NULL DEFAULT 'Standar',
    barcode TEXT,
    price NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
    cost_price NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
    stock INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL
);

ALTER TABLE public.product_variants ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE DEFAULT auth.uid();

-- Transactions Table (Header + Daily Invoice Support)
CREATE TABLE IF NOT EXISTS public.transactions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE DEFAULT auth.uid(),
    transaction_code TEXT NOT NULL,
    total_amount NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
    cash_paid NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
    change_given NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
    payment_method TEXT NOT NULL DEFAULT 'cash',
    customer_phone TEXT,
    cashier_name TEXT,
    business_unit TEXT DEFAULT 'Sembako',
    invoice_seq INT DEFAULT 1,
    transaction_date DATE DEFAULT CURRENT_DATE,
    created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL
);

ALTER TABLE public.transactions ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE DEFAULT auth.uid();
ALTER TABLE public.transactions ADD COLUMN IF NOT EXISTS cashier_name TEXT;
ALTER TABLE public.transactions ADD COLUMN IF NOT EXISTS business_unit TEXT DEFAULT 'Sembako';
ALTER TABLE public.transactions ADD COLUMN IF NOT EXISTS invoice_seq INT DEFAULT 1;
ALTER TABLE public.transactions ADD COLUMN IF NOT EXISTS transaction_date DATE DEFAULT CURRENT_DATE;

-- Transaction Items Table
CREATE TABLE IF NOT EXISTS public.transaction_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE DEFAULT auth.uid(),
    transaction_id UUID NOT NULL REFERENCES public.transactions(id) ON DELETE CASCADE,
    variant_id UUID NOT NULL REFERENCES public.product_variants(id) ON DELETE RESTRICT,
    quantity INTEGER NOT NULL DEFAULT 1,
    price_at_sale NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
    cost_price_at_sale NUMERIC(12, 2) DEFAULT 0.00,
    subtotal NUMERIC(12, 2) NOT NULL DEFAULT 0.00
);

ALTER TABLE public.transaction_items ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE DEFAULT auth.uid();
ALTER TABLE public.transaction_items ADD COLUMN IF NOT EXISTS cost_price_at_sale NUMERIC(12, 2) DEFAULT 0.00;

-- Store Reminders & Debt Table
CREATE TABLE IF NOT EXISTS public.store_reminders (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE DEFAULT auth.uid(),
    type TEXT NOT NULL DEFAULT 'reminder',
    customer_name TEXT,
    amount NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
    due_date TIMESTAMPTZ,
    notes TEXT,
    is_settled BOOLEAN NOT NULL DEFAULT false,
    created_by TEXT,
    created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL
);

ALTER TABLE public.store_reminders ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE DEFAULT auth.uid();

-- Monthly Sales Summary Table
CREATE TABLE IF NOT EXISTS public.monthly_sales_summary (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE DEFAULT auth.uid(),
    year_month VARCHAR(7) NOT NULL,
    total_revenue NUMERIC(14, 2) NOT NULL DEFAULT 0.00,
    total_profit NUMERIC(14, 2) NOT NULL DEFAULT 0.00,
    total_transactions INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL,
    CONSTRAINT uq_monthly_user_month UNIQUE(user_id, year_month)
);

ALTER TABLE public.monthly_sales_summary ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE DEFAULT auth.uid();

-- ==============================================================================
-- 4. INDEXES FOR PERFORMANCE OPTIMIZATION
-- ==============================================================================

CREATE INDEX IF NOT EXISTS idx_products_user_id ON public.products(user_id);
CREATE INDEX IF NOT EXISTS idx_product_variants_user_id ON public.product_variants(user_id);
CREATE INDEX IF NOT EXISTS idx_transactions_user_id ON public.transactions(user_id);
CREATE INDEX IF NOT EXISTS idx_transaction_items_user_id ON public.transaction_items(user_id);
CREATE INDEX IF NOT EXISTS idx_store_reminders_user_id ON public.store_reminders(user_id);
CREATE INDEX IF NOT EXISTS idx_monthly_sales_user_id ON public.monthly_sales_summary(user_id);

CREATE INDEX IF NOT EXISTS idx_product_variants_barcode ON public.product_variants(barcode);
CREATE INDEX IF NOT EXISTS idx_transactions_created_at ON public.transactions(created_at);
CREATE INDEX IF NOT EXISTS idx_transactions_user_date ON public.transactions(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_transactions_daily_seq ON public.transactions(user_id, transaction_date);

CREATE INDEX IF NOT EXISTS idx_product_variants_product_id ON public.product_variants(product_id);
CREATE INDEX IF NOT EXISTS idx_transaction_items_transaction_id ON public.transaction_items(transaction_id);
CREATE INDEX IF NOT EXISTS idx_transaction_items_variant_id ON public.transaction_items(variant_id);

CREATE INDEX IF NOT EXISTS idx_products_business_unit ON public.products(business_unit);
CREATE INDEX IF NOT EXISTS idx_transactions_business_unit ON public.transactions(business_unit);
CREATE INDEX IF NOT EXISTS idx_transactions_cashier_name ON public.transactions(cashier_name);

CREATE INDEX IF NOT EXISTS idx_store_reminders_type ON public.store_reminders(type);
CREATE INDEX IF NOT EXISTS idx_store_reminders_is_settled ON public.store_reminders(is_settled);
CREATE INDEX IF NOT EXISTS idx_store_reminders_created_at ON public.store_reminders(created_at DESC);

-- ==============================================================================
-- 5. AUTOMATIC DAILY INVOICE NUMBERING TRIGGER (#0001 RESET AT 00:00)
-- ==============================================================================

CREATE OR REPLACE FUNCTION public.generate_daily_invoice_number()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_next_seq INT;
    v_date_str TEXT;
    v_current_user_id UUID;
BEGIN
    v_current_user_id := COALESCE(NEW.user_id, auth.uid());
    v_date_str := TO_CHAR(CURRENT_DATE, 'YYYYMMDD');
    NEW.transaction_date := CURRENT_DATE;

    -- Hitung urutan transaksi khusus untuk toko/user ini pada hari ini
    SELECT COALESCE(MAX(invoice_seq), 0) + 1 
    INTO v_next_seq
    FROM public.transactions
    WHERE user_id = v_current_user_id 
      AND transaction_date = CURRENT_DATE;

    NEW.invoice_seq := v_next_seq;
    
    -- Format otomatis: TRX-YYYYMMDD-0001
    IF NEW.transaction_code IS NULL OR NEW.transaction_code = '' OR NEW.transaction_code LIKE 'TRX-%' THEN
        NEW.transaction_code := 'TRX-' || v_date_str || '-' || LPAD(v_next_seq::TEXT, 4, '0');
    END IF;

    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_generate_daily_invoice ON public.transactions;
CREATE TRIGGER trg_generate_daily_invoice
    BEFORE INSERT ON public.transactions
    FOR EACH ROW
    EXECUTE FUNCTION public.generate_daily_invoice_number();

-- ==============================================================================
-- 6. STORED PROCEDURES & SECURE RPC FUNCTIONS
-- ==============================================================================

-- SECURED: Ditambahkan validasi user_id = auth.uid() untuk mencegah bypass RLS
CREATE OR REPLACE FUNCTION public.deduct_variant_stock(
    p_variant_id UUID,
    p_quantity INTEGER
)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_current_stock INTEGER;
    v_new_stock INTEGER;
BEGIN
    -- Ambil stok HANYA jika varian tersebut milik user yang sedang login
    SELECT stock INTO v_current_stock
    FROM public.product_variants
    WHERE id = p_variant_id 
      AND user_id = auth.uid()
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Product variant with ID % not found or unauthorized', p_variant_id;
    END IF;

    v_new_stock := v_current_stock - p_quantity;

    IF v_new_stock < 0 THEN
        RAISE EXCEPTION 'Insufficient stock for variant ID %', p_variant_id;
    END IF;

    -- Update stok HANYA untuk milik user yang sedang login
    UPDATE public.product_variants
    SET stock = v_new_stock
    WHERE id = p_variant_id 
      AND user_id = auth.uid();

    RETURN v_new_stock;
END;
$$;

CREATE OR REPLACE FUNCTION public.archive_and_cleanup_old_transactions()
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    cutoff_date TIMESTAMPTZ := (now() - INTERVAL '12 months');
BEGIN
    WITH old_tx AS (
        SELECT
            t.user_id,
            t.id,
            to_char(t.created_at, 'YYYY-MM') AS year_month,
            t.total_amount,
            COALESCE(SUM(ti.subtotal - (pv.cost_price * ti.quantity)), 0) AS profit
        FROM public.transactions t
        LEFT JOIN public.transaction_items ti ON ti.transaction_id = t.id
        LEFT JOIN public.product_variants pv ON pv.id = ti.variant_id
        WHERE t.created_at < cutoff_date
        GROUP BY t.user_id, t.id, t.created_at, t.total_amount
    ),
    aggregated_monthly AS (
        SELECT
            user_id,
            year_month,
            SUM(total_amount) AS total_revenue,
            SUM(profit) AS total_profit,
            COUNT(id) AS total_transactions
        FROM old_tx
        GROUP BY user_id, year_month
    )
    INSERT INTO public.monthly_sales_summary (user_id, year_month, total_revenue, total_profit, total_transactions, created_at)
    SELECT
        user_id,
        year_month,
        total_revenue,
        total_profit,
        total_transactions,
        now()
    FROM aggregated_monthly
    ON CONFLICT (user_id, year_month) DO UPDATE
    SET
        total_revenue = public.monthly_sales_summary.total_revenue + EXCLUDED.total_revenue,
        total_profit = public.monthly_sales_summary.total_profit + EXCLUDED.total_profit,
        total_transactions = public.monthly_sales_summary.total_transactions + EXCLUDED.total_transactions;

    DELETE FROM public.transactions
    WHERE created_at < cutoff_date;

    RAISE NOTICE 'Transactions older than % successfully archived and cleaned up.', cutoff_date;
END;
$$;

-- ==============================================================================
-- 7. ROW LEVEL SECURITY (RLS) POLICIES
-- ==============================================================================

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.product_variants ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.transaction_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.monthly_sales_summary ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.store_reminders ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can only manage their own profile" ON public.profiles;
CREATE POLICY "Users can only manage their own profile"
    ON public.profiles FOR ALL TO authenticated
    USING (auth.uid() = id) WITH CHECK (auth.uid() = id);

DROP POLICY IF EXISTS "Users can only manage their own products" ON public.products;
CREATE POLICY "Users can only manage their own products"
    ON public.products FOR ALL TO authenticated
    USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can only manage their own product_variants" ON public.product_variants;
CREATE POLICY "Users can only manage their own product_variants"
    ON public.product_variants FOR ALL TO authenticated
    USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can only manage their own transactions" ON public.transactions;
CREATE POLICY "Users can only manage their own transactions"
    ON public.transactions FOR ALL TO authenticated
    USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can only manage their own transaction_items" ON public.transaction_items;
CREATE POLICY "Users can only manage their own transaction_items"
    ON public.transaction_items FOR ALL TO authenticated
    USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can only manage their own reminders" ON public.store_reminders;
CREATE POLICY "Users can only manage their own reminders"
    ON public.store_reminders FOR ALL TO authenticated
    USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can only manage their own monthly_sales_summary" ON public.monthly_sales_summary;
CREATE POLICY "Users can only manage their own monthly_sales_summary"
    ON public.monthly_sales_summary FOR ALL TO authenticated
    USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);