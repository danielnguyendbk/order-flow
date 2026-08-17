-- SePay API v2 uses UUID transaction IDs, while API v1 used integers.
-- Converting to varchar preserves all existing v1 values and accepts both formats.

alter table public.sepay_transactions
  alter column sepay_transaction_id type varchar(64)
  using sepay_transaction_id::text;
