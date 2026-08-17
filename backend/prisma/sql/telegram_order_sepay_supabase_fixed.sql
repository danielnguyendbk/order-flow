-- Telegram Order + SePay MVP
-- PostgreSQL / Supabase-ready schema
-- Run on a NEW database/schema.

begin;

-- =========================================================
-- ENUM TYPES
-- =========================================================

create type public.user_role as enum (
  'OWNER',
  'SERVICE_STAFF',
  'BARISTA'
);

create type public.user_status as enum (
  'ACTIVE',
  'INACTIVE'
);

create type public.payment_method as enum (
  'QR',
  'CASH'
);

create type public.payment_status as enum (
  'UNPAID',
  'PENDING',
  'PAID',
  'UNDERPAID',
  'OVERPAID',
  'REVIEW'
);

create type public.fulfillment_status as enum (
  'PENDING_PAYMENT',
  'QUEUED',
  'PREPARING',
  'READY',
  'DELIVERED',
  'CANCELLED'
);

create type public.order_status_domain as enum (
  'PAYMENT',
  'FULFILLMENT'
);

create type public.notification_event as enum (
  'ORDER_PAID',
  'ORDER_READY',
  'PAYMENT_REVIEW'
);

create type public.notification_status as enum (
  'PENDING',
  'RETRYING',
  'SENT',
  'FAILED'
);

create type public.transaction_match_status as enum (
  'UNMATCHED',
  'MATCHED',
  'WRONG_CODE',
  'REVIEWED'
);

create type public.resolution_action as enum (
  'NONE',
  'LINK_MANUALLY',
  'ACCEPT',
  'REJECT',
  'REFUND_REQUIRED'
);

create type public.audit_entity_type as enum (
  'USER',
  'MENU_CATEGORY',
  'MENU_ITEM',
  'ORDER',
  'PAYMENT',
  'SEPAY_TRANSACTION'
);

-- =========================================================
-- TABLES
-- =========================================================

create table public.users (
  id uuid primary key default gen_random_uuid(),
  full_name varchar(150) not null,
  telegram_user_id bigint unique,
  telegram_chat_id bigint,
  username varchar(100) unique,
  password_hash varchar(255),
  role public.user_role not null,
  status public.user_status not null default 'ACTIVE',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint users_identity_required_chk check (
    telegram_user_id is not null
    or username is not null
  ),
  constraint users_owner_credentials_chk check (
    role <> 'OWNER'
    or (username is not null and password_hash is not null)
  ),
  constraint users_bot_identity_chk check (
    role = 'OWNER'
    or telegram_user_id is not null
  )
);

create table public.menu_categories (
  id uuid primary key default gen_random_uuid(),
  name varchar(100) not null unique,
  display_order integer not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint menu_categories_display_order_chk
    check (display_order >= 0)
);

create table public.menu_items (
  id uuid primary key default gen_random_uuid(),
  category_id uuid not null,
  name varchar(150) not null,
  description text,
  price bigint not null,
  is_available boolean not null default true,
  image_url text,
  display_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint menu_items_category_fk
    foreign key (category_id)
    references public.menu_categories(id)
    on update cascade
    on delete restrict,

  constraint menu_items_price_chk check (price >= 0),
  constraint menu_items_display_order_chk check (display_order >= 0)
);

create table public.orders (
  id uuid primary key default gen_random_uuid(),
  order_code varchar(32) not null unique,
  created_by_user_id uuid not null,
  assigned_barista_id uuid,
  payment_method public.payment_method,
  payment_status public.payment_status not null default 'UNPAID',
  fulfillment_status public.fulfillment_status
    not null default 'PENDING_PAYMENT',
  total_amount bigint not null default 0,
  customer_note text,
  cancellation_reason text,
  paid_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint orders_created_by_user_fk
    foreign key (created_by_user_id)
    references public.users(id)
    on update cascade
    on delete restrict,

  constraint orders_assigned_barista_fk
    foreign key (assigned_barista_id)
    references public.users(id)
    on update cascade
    on delete set null,

  constraint orders_total_amount_chk check (total_amount >= 0),

  constraint orders_cancellation_reason_chk check (
    fulfillment_status <> 'CANCELLED'
    or cancellation_reason is not null
  ),

  constraint orders_paid_at_chk check (
    payment_status <> 'PAID'
    or paid_at is not null
  ),

  constraint orders_fulfillment_payment_chk check (
    fulfillment_status in ('PENDING_PAYMENT', 'CANCELLED')
    or payment_status = 'PAID'
  ),

  constraint orders_barista_assignment_chk check (
    fulfillment_status not in ('PREPARING', 'READY')
    or assigned_barista_id is not null
  )
);

create table public.order_items (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null,
  menu_item_id uuid not null,
  item_name varchar(150) not null,
  unit_price bigint not null,
  quantity integer not null default 1,
  note text,

  constraint order_items_order_fk
    foreign key (order_id)
    references public.orders(id)
    on update cascade
    on delete cascade,

  constraint order_items_menu_item_fk
    foreign key (menu_item_id)
    references public.menu_items(id)
    on update cascade
    on delete restrict,

  constraint order_items_unit_price_chk check (unit_price >= 0),
  constraint order_items_quantity_chk check (quantity > 0)
);

create table public.payments (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null unique,
  payment_code varchar(40) unique,
  expected_amount bigint not null,
  received_amount bigint not null default 0,
  cash_confirmed_by_user_id uuid,
  confirmed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint payments_order_fk
    foreign key (order_id)
    references public.orders(id)
    on update cascade
    on delete cascade,

  constraint payments_cash_confirmed_by_fk
    foreign key (cash_confirmed_by_user_id)
    references public.users(id)
    on update cascade
    on delete set null,

  constraint payments_expected_amount_chk check (expected_amount >= 0),
  constraint payments_received_amount_chk check (received_amount >= 0),

  constraint payments_cash_confirmation_chk check (
    (cash_confirmed_by_user_id is null and confirmed_at is null)
    or
    (cash_confirmed_by_user_id is not null and confirmed_at is not null)
  )
);

create table public.sepay_transactions (
  id uuid primary key default gen_random_uuid(),
  sepay_transaction_id bigint not null unique,
  payment_id uuid,
  transaction_date timestamptz not null,
  code varchar(100),
  content text,
  amount_in bigint not null default 0,
  reference_code varchar(150),
  match_status public.transaction_match_status
    not null default 'UNMATCHED',
  difference_amount bigint,
  resolution_action public.resolution_action not null default 'NONE',
  resolution_note text,
  resolved_by_user_id uuid,
  resolved_at timestamptz,
  raw_payload jsonb not null default '{}'::jsonb,
  received_at timestamptz not null default now(),

  constraint sepay_transactions_payment_fk
    foreign key (payment_id)
    references public.payments(id)
    on update cascade
    on delete restrict,

  constraint sepay_transactions_resolved_by_fk
    foreign key (resolved_by_user_id)
    references public.users(id)
    on update cascade
    on delete set null,

  constraint sepay_transactions_amount_in_chk check (amount_in >= 0),

  constraint sepay_transactions_resolution_chk check (
    (resolution_action = 'NONE'
      and resolved_by_user_id is null
      and resolved_at is null)
    or
    (resolution_action <> 'NONE'
      and resolved_by_user_id is not null
      and resolved_at is not null)
  ),

  constraint sepay_transactions_match_payment_chk check (
    match_status <> 'MATCHED'
    or payment_id is not null
  )
);

create table public.order_status_history (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null,
  status_domain public.order_status_domain not null,
  old_status varchar(30),
  new_status varchar(30) not null,
  changed_by_user_id uuid,
  reason text,
  created_at timestamptz not null default now(),

  constraint order_status_history_order_fk
    foreign key (order_id)
    references public.orders(id)
    on update cascade
    on delete cascade,

  constraint order_status_history_changed_by_fk
    foreign key (changed_by_user_id)
    references public.users(id)
    on update cascade
    on delete set null,

  constraint order_status_history_changed_chk check (
    old_status is null or old_status <> new_status
  )
);

create table public.audit_logs (
  id bigint generated by default as identity primary key,
  actor_user_id uuid,
  action varchar(100) not null,
  entity_type public.audit_entity_type not null,
  entity_id uuid,
  details jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),

  constraint audit_logs_actor_user_fk
    foreign key (actor_user_id)
    references public.users(id)
    on update cascade
    on delete set null
);

create table public.notifications (
  id uuid primary key default gen_random_uuid(),
  event public.notification_event not null,
  status public.notification_status not null default 'PENDING',
  source_key varchar(150) not null,
  order_id uuid,
  recipient_user_id uuid not null,
  recipient_telegram_chat_id bigint not null,
  message text not null,
  attempt_count integer not null default 0,
  last_error text,
  sent_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint notifications_order_fk foreign key (order_id)
    references public.orders(id) on update cascade on delete set null,
  constraint notifications_recipient_fk foreign key (recipient_user_id)
    references public.users(id) on update cascade on delete restrict,
  constraint notifications_event_source_recipient_key
    unique (event, source_key, recipient_user_id),
  constraint notifications_attempt_count_chk check (attempt_count >= 0)
);

-- =========================================================
-- INDEXES
-- UNIQUE constraints already create indexes automatically.
-- =========================================================

create index menu_items_category_display_idx
  on public.menu_items (category_id, display_order);

create index orders_creator_created_at_idx
  on public.orders (created_by_user_id, created_at desc);

create index orders_barista_status_created_at_idx
  on public.orders (assigned_barista_id, fulfillment_status, created_at desc)
  where assigned_barista_id is not null;

create index orders_fulfillment_created_at_idx
  on public.orders (fulfillment_status, created_at desc);

create index orders_payment_created_at_idx
  on public.orders (payment_status, created_at desc);

create index order_items_order_menu_idx
  on public.order_items (order_id, menu_item_id);

create index order_items_menu_item_idx
  on public.order_items (menu_item_id);

create index payments_cash_confirmer_idx
  on public.payments (cash_confirmed_by_user_id)
  where cash_confirmed_by_user_id is not null;

create index sepay_transactions_payment_date_idx
  on public.sepay_transactions (payment_id, transaction_date desc)
  where payment_id is not null;

create index sepay_transactions_unmatched_received_idx
  on public.sepay_transactions (received_at desc)
  where match_status in ('UNMATCHED', 'WRONG_CODE');

create index sepay_transactions_code_idx
  on public.sepay_transactions (code)
  where code is not null;

create index sepay_transactions_reference_code_idx
  on public.sepay_transactions (reference_code)
  where reference_code is not null;

create index order_status_history_order_created_idx
  on public.order_status_history (order_id, created_at desc);

create index order_status_history_changed_by_idx
  on public.order_status_history (changed_by_user_id)
  where changed_by_user_id is not null;

create index audit_logs_entity_created_idx
  on public.audit_logs (entity_type, entity_id, created_at desc);

create index audit_logs_actor_created_idx
  on public.audit_logs (actor_user_id, created_at desc)
  where actor_user_id is not null;

create index notifications_status_created_idx
  on public.notifications (status, created_at);

create index notifications_order_idx
  on public.notifications (order_id);

create index notifications_recipient_idx
  on public.notifications (recipient_user_id);

-- =========================================================
-- AUTOMATIC updated_at
-- =========================================================

create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger users_set_updated_at
before update on public.users
for each row execute function public.set_updated_at();

create trigger menu_categories_set_updated_at
before update on public.menu_categories
for each row execute function public.set_updated_at();

create trigger menu_items_set_updated_at
before update on public.menu_items
for each row execute function public.set_updated_at();

create trigger orders_set_updated_at
before update on public.orders
for each row execute function public.set_updated_at();

create trigger payments_set_updated_at
before update on public.payments
for each row execute function public.set_updated_at();

create trigger notifications_set_updated_at
before update on public.notifications
for each row execute function public.set_updated_at();

-- =========================================================
-- COMMENTS
-- =========================================================

comment on table public.users is
  'Employees and owner accounts for Telegram Bot and admin website.';

comment on table public.orders is
  'Current payment and fulfillment state of each order.';

comment on table public.order_status_history is
  'Append-only timeline of order status changes.';

comment on table public.sepay_transactions is
  'Raw SePay transactions and reconciliation resolution data.';

comment on table public.notifications is
  'Transactional notification outbox and Telegram delivery state.';

comment on column public.order_items.item_name is
  'Snapshot of the menu item name at order creation time.';

comment on column public.order_items.unit_price is
  'Snapshot of the menu item price at order creation time, in VND.';

comment on column public.sepay_transactions.raw_payload is
  'Original webhook payload retained for troubleshooting and idempotency.';

commit;
