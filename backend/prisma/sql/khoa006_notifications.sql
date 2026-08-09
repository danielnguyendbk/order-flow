begin;

create type public.notification_event as enum (
  'ORDER_PAID', 'ORDER_READY', 'PAYMENT_REVIEW'
);

create type public.notification_status as enum (
  'PENDING', 'RETRYING', 'SENT', 'FAILED'
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
  attempt_count integer not null default 0 check (attempt_count >= 0),
  last_error text,
  sent_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint notifications_order_fk foreign key (order_id)
    references public.orders(id) on update cascade on delete set null,
  constraint notifications_recipient_fk foreign key (recipient_user_id)
    references public.users(id) on update cascade on delete restrict,
  constraint notifications_event_source_recipient_key
    unique (event, source_key, recipient_user_id)
);

create index notifications_status_created_idx
  on public.notifications (status, created_at);
create index notifications_order_idx on public.notifications (order_id);
create index notifications_recipient_idx on public.notifications (recipient_user_id);

create trigger notifications_set_updated_at
before update on public.notifications
for each row execute function public.set_updated_at();

comment on table public.notifications is
  'Transactional notification outbox and Telegram delivery state.';

commit;
