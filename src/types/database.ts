/**
 * Business Domain Types for Grocery Store POS (KasirToko)
 * Fully aligned with supabase_schema.sql (Multi-Tenant)
 */

export type PaymentMethod = 'cash' | 'qris' | 'transfer' | 'debt' | 'other';
export type TransactionStatus = 'completed' | 'pending' | 'cancelled';
export type SyncStatus = 'pending' | 'syncing' | 'failed' | 'synced';
export type BusinessUnit = 'Sembako' | 'Tembakau';
export type TransactionBusinessUnit = 'Sembako' | 'Tembakau' | 'Gabungan';
export type ReminderType = 'debt' | 'reminder';

/**
 * Tenant / User Profile Entity
 */
export interface UserProfile {
  id: string; // Supabase auth user_id
  email?: string;
  store_name: string;
  owner_name: string;
  pin_hash?: string;
  created_at?: string;
  updated_at?: string;
}

/**
 * Master Product Entity
 */
export interface Product {
  id: string;
  user_id?: string;
  name: string;
  category?: string | null;
  business_unit?: BusinessUnit | string;
  created_at: string;
  is_active?: boolean;
  // Joined relation variants
  variants?: ProductVariant[];
}

/**
 * Product Variant Entity
 * Supports Barcode, Selling Price, Cost Price (Modal), and Stock
 */
export interface ProductVariant {
  id: string;
  user_id?: string;
  product_id: string;
  variant_name: string; // e.g. "Standar", "Sachet", "1 Kg", "Dus"
  barcode?: string | null;
  price: number; // Selling price (Harga Jual)
  cost_price: number; // Modal (Harga Beli)
  stock: number;
  created_at: string;
  // Joined product relation
  product?: Product;
}

/**
 * Transaction Header Entity
 */
export interface Transaction {
  id: string;
  user_id?: string;
  invoice_seq?: number | null; // Nomor urut struk harian (dihasilkan otomatis oleh Supabase trigger)
  transaction_code: string; // e.g. "TRX-20260906-0001"
  total_amount: number;
  cash_paid: number;
  change_given: number;
  payment_method: PaymentMethod;
  customer_phone?: string | null; // Customer WhatsApp phone
  cashier_name?: string | null; // 'Suami', 'Istri', etc.
  business_unit?: TransactionBusinessUnit | string; // 'Sembako', 'Tembakau', 'Gabungan'
  created_at: string;
  items?: TransactionItem[];
}

/**
 * Transaction Item Entity (Sale line items)
 */
export interface TransactionItem {
  id: string;
  user_id?: string;
  transaction_id: string;
  variant_id: string;
  quantity: number;
  price_at_sale: number;
  cost_price_at_sale?: number; // Historical purchase cost (HPP) locked at sale
  subtotal: number;
  // UI and receipt display helpers
  product_name?: string;
  variant_name?: string;
  barcode?: string | null;
  cost_price?: number;
}

/**
 * Store Reminder & Customer Debt (Kasbon) Entity
 */
export interface StoreReminder {
  id: string;
  user_id?: string;
  type: ReminderType; // 'debt' (Kasbon Utang Pelanggan) or 'reminder' (Catatan Toko)
  customer_name?: string | null;
  amount: number;
  due_date?: string | null;
  notes?: string | null;
  is_settled: boolean;
  created_by?: string | null;
  created_at: string;
}

/**
 * Monthly Sales Summary (Archived reports)
 */
export interface MonthlySalesSummary {
  id: string;
  user_id?: string;
  year_month: string; // 'YYYY-MM'
  total_revenue: number;
  total_profit: number;
  total_transactions: number;
  created_at: string;
}

/**
 * Active POS Cart Item for checkout calculation
 */
export interface CartItem {
  productId: string;
  variantId: string;
  productName: string;
  variantName: string;
  barcode?: string | null;
  costPrice: number;
  price: number; // Selling price
  quantity: number;
  subtotal: number;
  stockAvailable: number;
  unit?: string;
  businessUnit?: BusinessUnit | string;
}

/**
 * Checkout Payment Information
 */
export interface PaymentInfo {
  paymentMethod: PaymentMethod;
  cashPaid: number;
  changeGiven: number;
  customerPhone?: string | null;
}

/**
 * Offline Transaction Queue Item
 * Stored in AsyncStorage when offline
 */
export interface OfflineTransactionQueue {
  id: string; // Temporary local UUID
  user_id?: string;
  transaction: Transaction;
  items: TransactionItem[];
  status: SyncStatus;
  retry_count: number;
  error_message?: string | null;
  queued_at: string;
  last_attempt_at?: string | null;
}

/**
 * Supabase Database Schema Mapping Interface
 */
export interface Database {
  public: {
    Tables: {
      profiles: {
        Row: UserProfile;
        Insert: Partial<UserProfile> & { id: string };
        Update: Partial<UserProfile>;
      };
      products: {
        Row: Product;
        Insert: Omit<Product, 'id' | 'created_at' | 'variants'> & {
          id?: string;
          created_at?: string;
        };
        Update: Partial<Omit<Product, 'id'>>;
      };
      product_variants: {
        Row: ProductVariant;
        Insert: Omit<ProductVariant, 'id' | 'created_at' | 'product'> & {
          id?: string;
          created_at?: string;
        };
        Update: Partial<Omit<ProductVariant, 'id'>>;
      };
      transactions: {
        Row: Transaction;
        Insert: Omit<Transaction, 'id' | 'created_at' | 'items'> & {
          id?: string;
          created_at?: string;
        };
        Update: Partial<Omit<Transaction, 'id'>>;
      };
      transaction_items: {
        Row: TransactionItem;
        Insert: Omit<TransactionItem, 'id'> & {
          id?: string;
        };
        Update: Partial<Omit<TransactionItem, 'id'>>;
      };
      store_reminders: {
        Row: StoreReminder;
        Insert: Omit<StoreReminder, 'id' | 'created_at'> & {
          id?: string;
          created_at?: string;
        };
        Update: Partial<Omit<StoreReminder, 'id'>>;
      };
      monthly_sales_summary: {
        Row: MonthlySalesSummary;
        Insert: Omit<MonthlySalesSummary, 'id' | 'created_at'> & {
          id?: string;
          created_at?: string;
        };
        Update: Partial<Omit<MonthlySalesSummary, 'id'>>;
      };
    };
  };
}
