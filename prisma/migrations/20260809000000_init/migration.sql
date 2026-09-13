-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "DataSource" AS ENUM ('SMAREGI', 'OWN_POS');

-- CreateEnum
CREATE TYPE "TransactionType" AS ENUM ('SALE', 'REFUND', 'VOID', 'CANCEL');

-- CreateEnum
CREATE TYPE "TaxRate" AS ENUM ('STANDARD_10', 'REDUCED_8', 'EXEMPT');

-- CreateEnum
CREATE TYPE "EatInType" AS ENUM ('DINE_IN', 'TAKEOUT');

-- CreateEnum
CREATE TYPE "ProductStatus" AS ENUM ('ACTIVE', 'SOLD_OUT', 'HIDDEN');

-- CreateEnum
CREATE TYPE "ImportSourceType" AS ENUM ('CSV', 'API');

-- CreateEnum
CREATE TYPE "ImportJobStatus" AS ENUM ('PENDING', 'PARSING', 'PREVIEW', 'IMPORTING', 'NORMALIZING', 'AGGREGATING', 'COMPLETED', 'FAILED');

-- CreateEnum
CREATE TYPE "ImportFileType" AS ENUM ('PRODUCT_MASTER', 'TRANSACTION_DETAIL', 'TRANSACTION_PAYMENT', 'DAILY_CLOSING');

-- CreateEnum
CREATE TYPE "PaymentMethodType" AS ENUM ('CASH', 'CREDIT_CARD', 'TRANSIT_IC', 'QR', 'STORES', 'OTHER');

-- CreateEnum
CREATE TYPE "OrderChannel" AS ENUM ('WAITER', 'QR');

-- CreateEnum
CREATE TYPE "PaymentSessionStatus" AS ENUM ('PENDING', 'AWAITING_TERMINAL', 'AWAITING_ONLINE', 'PAID', 'FAILED', 'CANCELLED', 'EXPIRED');

-- CreateEnum
CREATE TYPE "RoleType" AS ENUM ('ADMIN', 'HALL', 'KITCHEN', 'CASHIER');

-- CreateEnum
CREATE TYPE "TableStatus" AS ENUM ('EMPTY', 'OCCUPIED', 'AWAITING_PAYMENT');

-- CreateEnum
CREATE TYPE "OrderStatus" AS ENUM ('OPEN', 'SENT_TO_KITCHEN', 'READY', 'PAID', 'CANCELLED');

-- CreateEnum
CREATE TYPE "OrderItemStatus" AS ENUM ('PENDING', 'SENT', 'COOKING', 'DONE', 'SERVED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "KitchenTicketStatus" AS ENUM ('NEW', 'COOKING', 'DONE', 'SERVED');

-- CreateEnum
CREATE TYPE "ExpenseCategory" AS ENUM ('RENT', 'UTILITIES', 'INGREDIENTS', 'LABOR', 'SUPPLIES', 'MARKETING', 'EQUIPMENT', 'INSURANCE', 'OTHER');

-- CreateEnum
CREATE TYPE "ExpenseSource" AS ENUM ('MANUAL', 'RECEIPT_SCAN');

-- CreateEnum
CREATE TYPE "ShiftRole" AS ENUM ('HALL', 'KITCHEN', 'CASHIER', 'MANAGER');

-- CreateEnum
CREATE TYPE "ShiftStatus" AS ENUM ('SCHEDULED', 'CONFIRMED', 'COMPLETED', 'CANCELLED');

-- CreateTable
CREATE TABLE "stores" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "invoice_reg_number" TEXT,
    "open_time" TEXT NOT NULL DEFAULT '11:00',
    "close_time" TEXT NOT NULL DEFAULT '18:00',
    "regular_closed_days" JSONB NOT NULL DEFAULT '[3]',
    "timezone" TEXT NOT NULL DEFAULT 'Asia/Tokyo',
    "stores_enabled" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "stores_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "daily_weather" (
    "id" TEXT NOT NULL,
    "store_id" TEXT NOT NULL,
    "business_date" DATE NOT NULL,
    "location_name" TEXT NOT NULL,
    "latitude" DOUBLE PRECISION NOT NULL,
    "longitude" DOUBLE PRECISION NOT NULL,
    "weather_code" INTEGER NOT NULL,
    "temp_max" DOUBLE PRECISION,
    "temp_min" DOUBLE PRECISION,
    "precipitation" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "fetched_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "daily_weather_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "roles" (
    "id" TEXT NOT NULL,
    "type" "RoleType" NOT NULL,
    "name" TEXT NOT NULL,

    CONSTRAINT "roles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "product_categories" (
    "id" TEXT NOT NULL,
    "store_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "product_categories_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "products" (
    "id" TEXT NOT NULL,
    "store_id" TEXT NOT NULL,
    "category_id" TEXT,
    "name" TEXT NOT NULL,
    "price_dine_in" INTEGER NOT NULL,
    "price_takeout" INTEGER,
    "tax_rate" "TaxRate" NOT NULL DEFAULT 'STANDARD_10',
    "status" "ProductStatus" NOT NULL DEFAULT 'ACTIVE',
    "send_to_kitchen" BOOLEAN NOT NULL DEFAULT true,
    "smaregi_dept_id" TEXT,
    "smaregi_dept_name" TEXT,
    "cost_amount" INTEGER,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "data_source" "DataSource" NOT NULL DEFAULT 'SMAREGI',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "products_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tables" (
    "id" TEXT NOT NULL,
    "store_id" TEXT NOT NULL,
    "number" INTEGER NOT NULL,
    "name" TEXT NOT NULL,
    "eat_in_type" "EatInType" NOT NULL DEFAULT 'DINE_IN',
    "status" "TableStatus" NOT NULL DEFAULT 'EMPTY',
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "qr_token" TEXT,
    "qr_enabled" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "tables_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "orders" (
    "id" TEXT NOT NULL,
    "store_id" TEXT NOT NULL,
    "table_id" TEXT NOT NULL,
    "order_number" TEXT NOT NULL,
    "status" "OrderStatus" NOT NULL DEFAULT 'OPEN',
    "channel" "OrderChannel" NOT NULL DEFAULT 'WAITER',
    "eat_in_type" "EatInType" NOT NULL DEFAULT 'DINE_IN',
    "customer_count" INTEGER NOT NULL DEFAULT 1,
    "staff_name" TEXT,
    "customer_segment" TEXT,
    "note" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "orders_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "order_items" (
    "id" TEXT NOT NULL,
    "order_id" TEXT NOT NULL,
    "product_id" TEXT NOT NULL,
    "product_name" TEXT NOT NULL,
    "unit_price" INTEGER NOT NULL,
    "quantity" INTEGER NOT NULL DEFAULT 1,
    "status" "OrderItemStatus" NOT NULL DEFAULT 'PENDING',
    "note" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "order_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "kitchen_tickets" (
    "id" TEXT NOT NULL,
    "order_item_id" TEXT NOT NULL,
    "status" "KitchenTicketStatus" NOT NULL DEFAULT 'NEW',
    "queued_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "done_at" TIMESTAMP(3),

    CONSTRAINT "kitchen_tickets_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "payment_sessions" (
    "id" TEXT NOT NULL,
    "store_id" TEXT NOT NULL,
    "order_id" TEXT NOT NULL,
    "status" "PaymentSessionStatus" NOT NULL DEFAULT 'PENDING',
    "amount" INTEGER NOT NULL,
    "discount_amount" INTEGER NOT NULL DEFAULT 0,
    "payment_method" "PaymentMethodType",
    "stores_payment_id" TEXT,
    "payment_url" TEXT,
    "terminal_note" TEXT,
    "paid_at" TIMESTAMP(3),
    "expires_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "payment_sessions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "external_product_mappings" (
    "id" TEXT NOT NULL,
    "product_id" TEXT NOT NULL,
    "external_source" "DataSource" NOT NULL DEFAULT 'SMAREGI',
    "external_product_id" TEXT NOT NULL,
    "external_product_code" TEXT,
    "external_product_name" TEXT,

    CONSTRAINT "external_product_mappings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "external_payment_mappings" (
    "id" TEXT NOT NULL,
    "payment_method_type" "PaymentMethodType" NOT NULL,
    "external_source" "DataSource" NOT NULL DEFAULT 'SMAREGI',
    "external_payment_id" TEXT NOT NULL,
    "external_payment_name" TEXT NOT NULL,

    CONSTRAINT "external_payment_mappings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "smaregi_import_jobs" (
    "id" TEXT NOT NULL,
    "store_id" TEXT NOT NULL,
    "source_type" "ImportSourceType" NOT NULL,
    "file_type" "ImportFileType" NOT NULL,
    "file_name" TEXT,
    "file_hash" TEXT,
    "encoding" TEXT,
    "status" "ImportJobStatus" NOT NULL DEFAULT 'PENDING',
    "total_rows" INTEGER NOT NULL DEFAULT 0,
    "success_rows" INTEGER NOT NULL DEFAULT 0,
    "failed_rows" INTEGER NOT NULL DEFAULT 0,
    "skipped_rows" INTEGER NOT NULL DEFAULT 0,
    "preview_summary" JSONB,
    "result_summary" JSONB,
    "started_at" TIMESTAMP(3),
    "completed_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "smaregi_import_jobs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "smaregi_import_errors" (
    "id" TEXT NOT NULL,
    "import_job_id" TEXT NOT NULL,
    "row_number" INTEGER NOT NULL,
    "raw_payload" JSONB NOT NULL,
    "error_code" TEXT NOT NULL,
    "error_message" TEXT NOT NULL,

    CONSTRAINT "smaregi_import_errors_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "smaregi_raw_transaction_details" (
    "id" TEXT NOT NULL,
    "import_job_id" TEXT NOT NULL,
    "smaregi_transaction_id" TEXT NOT NULL,
    "smaregi_detail_id" TEXT NOT NULL,
    "raw_payload" JSONB NOT NULL,
    "source_row_number" INTEGER NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "smaregi_raw_transaction_details_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sales_transactions" (
    "id" TEXT NOT NULL,
    "store_id" TEXT NOT NULL,
    "external_id" TEXT NOT NULL,
    "data_source" "DataSource" NOT NULL,
    "transaction_type" "TransactionType" NOT NULL,
    "transaction_at" TIMESTAMP(3) NOT NULL,
    "business_date" TIMESTAMP(3) NOT NULL,
    "subtotal_amount" INTEGER NOT NULL,
    "discount_amount" INTEGER NOT NULL DEFAULT 0,
    "total_amount" INTEGER NOT NULL,
    "tax_10_amount" INTEGER NOT NULL DEFAULT 0,
    "tax_8_amount" INTEGER NOT NULL DEFAULT 0,
    "tax_exempt_amount" INTEGER NOT NULL DEFAULT 0,
    "consumption_tax_10" INTEGER NOT NULL DEFAULT 0,
    "consumption_tax_8" INTEGER NOT NULL DEFAULT 0,
    "consumption_tax" INTEGER NOT NULL DEFAULT 0,
    "customer_count" INTEGER NOT NULL DEFAULT 1,
    "eat_in_type" "EatInType" NOT NULL DEFAULT 'DINE_IN',
    "staff_name" TEXT,
    "table_number" INTEGER,
    "table_name" TEXT,
    "entry_time" TIMESTAMP(3),
    "import_job_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "sales_transactions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sales_transaction_items" (
    "id" TEXT NOT NULL,
    "sales_transaction_id" TEXT NOT NULL,
    "external_detail_id" TEXT,
    "product_id" TEXT,
    "external_product_id" TEXT,
    "product_name" TEXT NOT NULL,
    "category_id" TEXT,
    "category_name" TEXT,
    "quantity" INTEGER NOT NULL,
    "unit_price" INTEGER NOT NULL,
    "subtotal_amount" INTEGER NOT NULL,
    "discount_amount" INTEGER NOT NULL DEFAULT 0,
    "total_amount" INTEGER NOT NULL,
    "tax_rate" "TaxRate" NOT NULL DEFAULT 'STANDARD_10',
    "cost_amount" INTEGER,

    CONSTRAINT "sales_transaction_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sales_transaction_payments" (
    "id" TEXT NOT NULL,
    "sales_transaction_id" TEXT NOT NULL,
    "method" "PaymentMethodType" NOT NULL,
    "amount" INTEGER NOT NULL,

    CONSTRAINT "sales_transaction_payments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sales_daily_summaries" (
    "id" TEXT NOT NULL,
    "store_id" TEXT NOT NULL,
    "business_date" TIMESTAMP(3) NOT NULL,
    "data_source" "DataSource" NOT NULL,
    "gross_sales" INTEGER NOT NULL,
    "discount_amount" INTEGER NOT NULL DEFAULT 0,
    "net_sales" INTEGER NOT NULL,
    "customer_count" INTEGER NOT NULL DEFAULT 0,
    "order_count" INTEGER NOT NULL DEFAULT 0,
    "item_count" INTEGER NOT NULL DEFAULT 0,
    "avg_spend" INTEGER NOT NULL DEFAULT 0,
    "dine_in_sales" INTEGER NOT NULL DEFAULT 0,
    "takeout_sales" INTEGER NOT NULL DEFAULT 0,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "sales_daily_summaries_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sales_hourly_summaries" (
    "id" TEXT NOT NULL,
    "store_id" TEXT NOT NULL,
    "business_date" TIMESTAMP(3) NOT NULL,
    "hour" INTEGER NOT NULL,
    "data_source" "DataSource" NOT NULL,
    "net_sales" INTEGER NOT NULL,
    "customer_count" INTEGER NOT NULL DEFAULT 0,
    "order_count" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "sales_hourly_summaries_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sales_product_summaries" (
    "id" TEXT NOT NULL,
    "store_id" TEXT NOT NULL,
    "product_id" TEXT,
    "product_name" TEXT NOT NULL,
    "category_name" TEXT,
    "period_start" TIMESTAMP(3) NOT NULL,
    "period_end" TIMESTAMP(3) NOT NULL,
    "data_source" "DataSource" NOT NULL,
    "quantity" INTEGER NOT NULL,
    "gross_sales" INTEGER NOT NULL,
    "discount_amount" INTEGER NOT NULL DEFAULT 0,
    "net_sales" INTEGER NOT NULL,

    CONSTRAINT "sales_product_summaries_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sales_payment_summaries" (
    "id" TEXT NOT NULL,
    "store_id" TEXT NOT NULL,
    "business_date" TIMESTAMP(3) NOT NULL,
    "method" "PaymentMethodType" NOT NULL,
    "data_source" "DataSource" NOT NULL,
    "amount" INTEGER NOT NULL,

    CONSTRAINT "sales_payment_summaries_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sales_tax_summaries" (
    "id" TEXT NOT NULL,
    "store_id" TEXT NOT NULL,
    "business_date" TIMESTAMP(3) NOT NULL,
    "tax_rate" "TaxRate" NOT NULL,
    "data_source" "DataSource" NOT NULL,
    "taxable_amount" INTEGER NOT NULL,
    "consumption_tax" INTEGER NOT NULL,

    CONSTRAINT "sales_tax_summaries_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "report_snapshots" (
    "id" TEXT NOT NULL,
    "store_id" TEXT NOT NULL,
    "report_type" TEXT NOT NULL,
    "period_start" TIMESTAMP(3) NOT NULL,
    "period_end" TIMESTAMP(3) NOT NULL,
    "payload" JSONB NOT NULL,
    "generated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "report_snapshots_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "expenses" (
    "id" TEXT NOT NULL,
    "store_id" TEXT NOT NULL,
    "category" "ExpenseCategory" NOT NULL,
    "amount" INTEGER NOT NULL,
    "description" TEXT,
    "expense_date" TIMESTAMP(3) NOT NULL,
    "is_recurring" BOOLEAN NOT NULL DEFAULT false,
    "source" "ExpenseSource" NOT NULL DEFAULT 'MANUAL',
    "merchant_name" TEXT,
    "receipt_image_path" TEXT,
    "ocr_text" TEXT,
    "classify_confidence" DOUBLE PRECISION,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "expenses_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "receipt_blobs" (
    "id" TEXT NOT NULL,
    "store_id" TEXT NOT NULL,
    "data" BYTEA NOT NULL,
    "mime_type" TEXT NOT NULL DEFAULT 'image/jpeg',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "receipt_blobs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "staff_members" (
    "id" TEXT NOT NULL,
    "store_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "hourly_wage" INTEGER,
    "role" "ShiftRole" NOT NULL DEFAULT 'HALL',
    "color" TEXT,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "staff_members_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "shifts" (
    "id" TEXT NOT NULL,
    "store_id" TEXT NOT NULL,
    "staff_id" TEXT NOT NULL,
    "shift_date" TIMESTAMP(3) NOT NULL,
    "start_time" TEXT NOT NULL,
    "end_time" TEXT NOT NULL,
    "role" "ShiftRole" NOT NULL DEFAULT 'HALL',
    "status" "ShiftStatus" NOT NULL DEFAULT 'SCHEDULED',
    "note" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "shifts_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "daily_weather_business_date_idx" ON "daily_weather"("business_date");

-- CreateIndex
CREATE UNIQUE INDEX "daily_weather_store_id_business_date_key" ON "daily_weather"("store_id", "business_date");

-- CreateIndex
CREATE UNIQUE INDEX "roles_type_key" ON "roles"("type");

-- CreateIndex
CREATE UNIQUE INDEX "product_categories_store_id_name_key" ON "product_categories"("store_id", "name");

-- CreateIndex
CREATE UNIQUE INDEX "tables_store_id_name_key" ON "tables"("store_id", "name");

-- CreateIndex
CREATE INDEX "orders_table_id_status_idx" ON "orders"("table_id", "status");

-- CreateIndex
CREATE UNIQUE INDEX "orders_store_id_order_number_key" ON "orders"("store_id", "order_number");

-- CreateIndex
CREATE UNIQUE INDEX "kitchen_tickets_order_item_id_key" ON "kitchen_tickets"("order_item_id");

-- CreateIndex
CREATE INDEX "kitchen_tickets_status_queued_at_idx" ON "kitchen_tickets"("status", "queued_at");

-- CreateIndex
CREATE INDEX "payment_sessions_order_id_status_idx" ON "payment_sessions"("order_id", "status");

-- CreateIndex
CREATE UNIQUE INDEX "external_product_mappings_external_source_external_product__key" ON "external_product_mappings"("external_source", "external_product_id");

-- CreateIndex
CREATE UNIQUE INDEX "external_payment_mappings_external_source_external_payment__key" ON "external_payment_mappings"("external_source", "external_payment_id");

-- CreateIndex
CREATE INDEX "smaregi_import_jobs_store_id_created_at_idx" ON "smaregi_import_jobs"("store_id", "created_at");

-- CreateIndex
CREATE INDEX "smaregi_raw_transaction_details_smaregi_transaction_id_idx" ON "smaregi_raw_transaction_details"("smaregi_transaction_id");

-- CreateIndex
CREATE UNIQUE INDEX "smaregi_raw_transaction_details_smaregi_transaction_id_smar_key" ON "smaregi_raw_transaction_details"("smaregi_transaction_id", "smaregi_detail_id");

-- CreateIndex
CREATE INDEX "sales_transactions_store_id_business_date_idx" ON "sales_transactions"("store_id", "business_date");

-- CreateIndex
CREATE INDEX "sales_transactions_transaction_at_idx" ON "sales_transactions"("transaction_at");

-- CreateIndex
CREATE UNIQUE INDEX "sales_transactions_data_source_external_id_key" ON "sales_transactions"("data_source", "external_id");

-- CreateIndex
CREATE UNIQUE INDEX "sales_transaction_items_sales_transaction_id_external_detai_key" ON "sales_transaction_items"("sales_transaction_id", "external_detail_id");

-- CreateIndex
CREATE UNIQUE INDEX "sales_daily_summaries_store_id_business_date_data_source_key" ON "sales_daily_summaries"("store_id", "business_date", "data_source");

-- CreateIndex
CREATE UNIQUE INDEX "sales_hourly_summaries_store_id_business_date_hour_data_sou_key" ON "sales_hourly_summaries"("store_id", "business_date", "hour", "data_source");

-- CreateIndex
CREATE INDEX "sales_product_summaries_store_id_period_start_period_end_idx" ON "sales_product_summaries"("store_id", "period_start", "period_end");

-- CreateIndex
CREATE UNIQUE INDEX "sales_payment_summaries_store_id_business_date_method_data__key" ON "sales_payment_summaries"("store_id", "business_date", "method", "data_source");

-- CreateIndex
CREATE UNIQUE INDEX "sales_tax_summaries_store_id_business_date_tax_rate_data_so_key" ON "sales_tax_summaries"("store_id", "business_date", "tax_rate", "data_source");

-- CreateIndex
CREATE INDEX "report_snapshots_store_id_report_type_period_start_idx" ON "report_snapshots"("store_id", "report_type", "period_start");

-- CreateIndex
CREATE INDEX "expenses_store_id_expense_date_idx" ON "expenses"("store_id", "expense_date");

-- CreateIndex
CREATE INDEX "receipt_blobs_store_id_idx" ON "receipt_blobs"("store_id");

-- CreateIndex
CREATE UNIQUE INDEX "staff_members_store_id_name_key" ON "staff_members"("store_id", "name");

-- CreateIndex
CREATE INDEX "shifts_store_id_shift_date_idx" ON "shifts"("store_id", "shift_date");

-- CreateIndex
CREATE INDEX "shifts_staff_id_shift_date_idx" ON "shifts"("staff_id", "shift_date");

-- AddForeignKey
ALTER TABLE "daily_weather" ADD CONSTRAINT "daily_weather_store_id_fkey" FOREIGN KEY ("store_id") REFERENCES "stores"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "product_categories" ADD CONSTRAINT "product_categories_store_id_fkey" FOREIGN KEY ("store_id") REFERENCES "stores"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "products" ADD CONSTRAINT "products_store_id_fkey" FOREIGN KEY ("store_id") REFERENCES "stores"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "products" ADD CONSTRAINT "products_category_id_fkey" FOREIGN KEY ("category_id") REFERENCES "product_categories"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tables" ADD CONSTRAINT "tables_store_id_fkey" FOREIGN KEY ("store_id") REFERENCES "stores"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "orders" ADD CONSTRAINT "orders_store_id_fkey" FOREIGN KEY ("store_id") REFERENCES "stores"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "orders" ADD CONSTRAINT "orders_table_id_fkey" FOREIGN KEY ("table_id") REFERENCES "tables"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "order_items" ADD CONSTRAINT "order_items_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "orders"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "order_items" ADD CONSTRAINT "order_items_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "kitchen_tickets" ADD CONSTRAINT "kitchen_tickets_order_item_id_fkey" FOREIGN KEY ("order_item_id") REFERENCES "order_items"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payment_sessions" ADD CONSTRAINT "payment_sessions_store_id_fkey" FOREIGN KEY ("store_id") REFERENCES "stores"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payment_sessions" ADD CONSTRAINT "payment_sessions_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "orders"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "external_product_mappings" ADD CONSTRAINT "external_product_mappings_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "smaregi_import_jobs" ADD CONSTRAINT "smaregi_import_jobs_store_id_fkey" FOREIGN KEY ("store_id") REFERENCES "stores"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "smaregi_import_errors" ADD CONSTRAINT "smaregi_import_errors_import_job_id_fkey" FOREIGN KEY ("import_job_id") REFERENCES "smaregi_import_jobs"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "smaregi_raw_transaction_details" ADD CONSTRAINT "smaregi_raw_transaction_details_import_job_id_fkey" FOREIGN KEY ("import_job_id") REFERENCES "smaregi_import_jobs"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sales_transactions" ADD CONSTRAINT "sales_transactions_store_id_fkey" FOREIGN KEY ("store_id") REFERENCES "stores"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sales_transactions" ADD CONSTRAINT "sales_transactions_import_job_id_fkey" FOREIGN KEY ("import_job_id") REFERENCES "smaregi_import_jobs"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sales_transaction_items" ADD CONSTRAINT "sales_transaction_items_sales_transaction_id_fkey" FOREIGN KEY ("sales_transaction_id") REFERENCES "sales_transactions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sales_transaction_items" ADD CONSTRAINT "sales_transaction_items_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sales_transaction_payments" ADD CONSTRAINT "sales_transaction_payments_sales_transaction_id_fkey" FOREIGN KEY ("sales_transaction_id") REFERENCES "sales_transactions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sales_daily_summaries" ADD CONSTRAINT "sales_daily_summaries_store_id_fkey" FOREIGN KEY ("store_id") REFERENCES "stores"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sales_hourly_summaries" ADD CONSTRAINT "sales_hourly_summaries_store_id_fkey" FOREIGN KEY ("store_id") REFERENCES "stores"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sales_product_summaries" ADD CONSTRAINT "sales_product_summaries_store_id_fkey" FOREIGN KEY ("store_id") REFERENCES "stores"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sales_payment_summaries" ADD CONSTRAINT "sales_payment_summaries_store_id_fkey" FOREIGN KEY ("store_id") REFERENCES "stores"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sales_tax_summaries" ADD CONSTRAINT "sales_tax_summaries_store_id_fkey" FOREIGN KEY ("store_id") REFERENCES "stores"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "expenses" ADD CONSTRAINT "expenses_store_id_fkey" FOREIGN KEY ("store_id") REFERENCES "stores"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "staff_members" ADD CONSTRAINT "staff_members_store_id_fkey" FOREIGN KEY ("store_id") REFERENCES "stores"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "shifts" ADD CONSTRAINT "shifts_store_id_fkey" FOREIGN KEY ("store_id") REFERENCES "stores"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "shifts" ADD CONSTRAINT "shifts_staff_id_fkey" FOREIGN KEY ("staff_id") REFERENCES "staff_members"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

