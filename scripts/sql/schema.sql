-- Schema tối thiểu mô phỏng DB thật FGRP để test SQL local (Docker Postgres)
-- Không dùng cho production — chỉ phục vụ scripts/test-sql-api.sh

-- Supabase có sẵn 2 role này; Postgres thuần thì tạo để script api_vba.sql chạy được
do $$ begin
  create role anon nologin;
exception when duplicate_object then null;
end $$;

do $$ begin
  create role authenticated nologin;
exception when duplicate_object then null;
end $$;

create table if not exists public.inventory (
  id uuid primary key default gen_random_uuid(),
  tag_id text not null,
  bin text,
  stock_up_date timestamptz default now(),
  stock_in_date timestamptz
);

create index if not exists idx_inventory_tag_id on public.inventory (tag_id);
create index if not exists idx_inventory_bin on public.inventory (bin);

create table if not exists public.master_data (
  id uuid primary key default gen_random_uuid(),
  tag_id text,
  lp_no text,
  wh_location text,
  batch text,
  stock_code text,
  warehouse text,
  qty numeric,
  create_date text
);

create table if not exists public.shipping_forecast (
  id uuid primary key default gen_random_uuid(),
  po text not null,
  so text not null,
  container_no text default '',
  item_code text not null,
  feature text not null,
  loading_date text not null,
  qty numeric not null default 0,
  pcs_per_pkg numeric not null default 0,
  pkg numeric not null default 0,
  is_accessory boolean not null default false,
  is_special boolean not null default false,
  unit_type text not null default 'kien',
  status text not null default 'pending',
  status_changed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
