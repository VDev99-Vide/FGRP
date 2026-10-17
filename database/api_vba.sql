-- ============================================================
-- FGRP API v1 — One-click import từ VBA + chống nhân đôi dữ liệu
-- ============================================================
-- CHẠY 1 LẦN trong Supabase SQL Editor (idempotent, chạy lại không sao).
--
-- Gồm 3 nhóm:
--   A. Gia cố replace_inventory: advisory lock + chặn file trùng Tag ID+Bin
--      (nguyên nhân bug 2.508 dòng -> 5.016 khi bấm nạp 1 lần).
--   B. API cho VBA: api_replace_inventory / api_import_shipping_forecast /
--      api_healthcheck — xác thực bằng import_token, hỗ trợ dry-run.
--   C. Khóa an toàn cho replace_master_data.
--
-- Sau khi chạy xong, KHÔNG cần deploy gì thêm. VBA gọi trực tiếp HTTPS.
-- Đổi token: update public.app_config set value = '<token-moi>' where key = 'import_token';
--            rồi sửa hằng FGRP_TOKEN trong module VBA cho khớp.
-- ============================================================

-- ============================================================
-- A0. BẢNG CẤU HÌNH + TOKEN (không cho đọc qua REST)
-- ============================================================
create table if not exists public.app_config (
  key text primary key,
  value text not null,
  updated_at timestamptz not null default now()
);

insert into public.app_config (key, value)
values ('import_token', 'c20695cbfa064b3c98f6c376ff97f4d62d99bc5b')
on conflict (key) do nothing;

alter table public.app_config enable row level security;
revoke all on table public.app_config from anon, authenticated;

-- ============================================================
-- A. SCHEMA NỘI BỘ (PostgREST KHÔNG expose — chỉ gọi từ function public)
-- ============================================================
create schema if not exists fg_internal;
revoke all on schema fg_internal from public, anon, authenticated;

-- A1. Kiểm tra payload phải là mảng JSON
create or replace function fg_internal.assert_payload_is_array(payload jsonb)
returns void
language plpgsql
set search_path = ''
as $$
begin
  if payload is null or jsonb_typeof(payload) <> 'array' then
    raise exception 'Dữ liệu gửi lên phải là mảng JSON (payload).';
  end if;
end;
$$;

-- A2. Chuẩn hóa payload tồn kho -> (tag_id, bin)
create or replace function fg_internal.normalize_inventory_payload(payload jsonb)
returns table(tag_id text, bin text)
language sql
immutable
set search_path = ''
as $$
  select
    coalesce(nullif(trim(item->>'tag_id'), ''), nullif(trim(item->>'batch'), '')) as tag_id,
    coalesce(trim(item->>'bin'), '') as bin
  from jsonb_array_elements(payload) as item
$$;

-- A3. Validate payload tồn kho: trả về số dòng hợp lệ, RAISE nếu trùng Tag ID + Bin
create or replace function fg_internal.validate_inventory_payload(payload jsonb)
returns integer
language plpgsql
set search_path = ''
as $$
declare
  v_valid integer;
  v_dup_groups integer;
  v_dup_example text;
begin
  perform fg_internal.assert_payload_is_array(payload);

  select count(*) into v_valid
  from fg_internal.normalize_inventory_payload(payload) t
  where t.tag_id is not null;

  select count(*), min(t.tag_id || ' | ' || t.bin || ' (x' || t.c || ')')
    into v_dup_groups, v_dup_example
  from (
    select tag_id, bin, count(*) as c
    from fg_internal.normalize_inventory_payload(payload)
    where tag_id is not null
    group by tag_id, bin
    having count(*) > 1
  ) t;

  if v_dup_groups > 0 then
    raise exception 'File có % nhóm Tag ID + Bin bị trùng (ví dụ: %). Vui lòng sửa file trước khi nạp.', v_dup_groups, v_dup_example;
  end if;

  return v_valid;
end;
$$;

-- A4. Thực thi thay thế toàn bộ tồn kho (đã khóa + validate)
create or replace function fg_internal.replace_inventory_impl(payload jsonb)
returns integer
language plpgsql
set search_path = ''
as $$
declare
  v_count integer;
begin
  begin
    set local sql_safe_updates = off;
  exception when others then
    null;
  end;

  perform fg_internal.validate_inventory_payload(payload);

  -- Khóa advisory theo transaction: 2 lời gọi song song sẽ xếp hàng,
  -- lời gọi sau thấy được dữ liệu lời gọi trước vừa commit và xóa đúng.
  perform pg_advisory_xact_lock(738001, 1);

  delete from public.inventory where ctid is not null;

  insert into public.inventory (tag_id, bin)
  select t.tag_id, t.bin
  from fg_internal.normalize_inventory_payload(payload) t
  where t.tag_id is not null;

  get diagnostics v_count = row_count;
  return v_count;
end;
$$;

-- A5. Chuẩn hóa payload kế hoạch xuất hàng
create or replace function fg_internal.normalize_forecast_payload(payload jsonb)
returns table(
  po text,
  so text,
  container_no text,
  item_code text,
  feature text,
  loading_date text,
  qty numeric,
  pcs_per_pkg numeric,
  pkg numeric,
  is_accessory boolean,
  is_special boolean,
  unit_type text,
  status text
)
language sql
immutable
set search_path = ''
as $$
  with src as (
    select
      coalesce(nullif(trim(item->>'po'), ''), '') as po,
      coalesce(nullif(trim(item->>'so'), ''), '') as so,
      coalesce(trim(item->>'container_no'), '') as container_no,
      coalesce(
        nullif(trim(item->>'item_code'), ''),
        nullif(trim(item->>'lp_no'), ''),
        nullif(trim(item->>'stock_code'), '')
      ) as item_code,
      nullif(trim(item->>'feature'), '') as feature_raw,
      coalesce(nullif(trim(item->>'loading_date'), ''), '') as loading_date,
      coalesce(nullif(trim(item->>'qty'), '')::numeric, 0) as qty,
      coalesce(nullif(trim(item->>'pcs_per_pkg'), '')::numeric, 0) as pcs_per_pkg,
      coalesce(nullif(trim(item->>'pkg'), '')::numeric, 0) as pkg,
      coalesce(nullif(trim(item->>'is_accessory'), '')::boolean, false) as is_accessory,
      coalesce(nullif(trim(item->>'is_special'), '')::boolean, false) as is_special,
      case when lower(coalesce(nullif(trim(item->>'unit_type'), ''), 'kien')) = 'thung' then 'thung' else 'kien' end as unit_type,
      case when lower(coalesce(nullif(trim(item->>'status'), ''), 'pending')) = 'ready' then 'ready' else 'pending' end as status
    from jsonb_array_elements(payload) as item
  )
  select
    po, so, container_no, item_code,
    coalesce(
      feature_raw,
      case
        when item_code like '1220%' then '1220'
        when length(item_code) >= 5 then substring(item_code from 2 for 4)
        else 'No data'
      end
    ) as feature,
    loading_date, qty, pcs_per_pkg, pkg, is_accessory, is_special, unit_type, status
  from src
$$;

-- A6. Validate payload kế hoạch xuất hàng (đếm dòng có item_code)
create or replace function fg_internal.validate_forecast_payload(payload jsonb)
returns integer
language plpgsql
set search_path = ''
as $$
declare
  v_valid integer;
begin
  perform fg_internal.assert_payload_is_array(payload);

  select count(*) into v_valid
  from fg_internal.normalize_forecast_payload(payload) t
  where t.item_code is not null and t.item_code <> '';

  return v_valid;
end;
$$;

-- A7. Thực thi import kế hoạch xuất hàng: mode = 'append' (cộng dồn) hoặc 'replace'
create or replace function fg_internal.import_shipping_forecast_impl(payload jsonb, p_mode text default 'append')
returns integer
language plpgsql
set search_path = ''
as $$
declare
  v_mode text := lower(coalesce(nullif(trim(p_mode), ''), 'append'));
  v_count integer;
begin
  if v_mode not in ('append', 'replace') then
    raise exception 'Chế độ không hợp lệ: % (chỉ nhận append hoặc replace).', p_mode;
  end if;

  perform fg_internal.assert_payload_is_array(payload);

  perform pg_advisory_xact_lock(738001, 2);

  if v_mode = 'replace' then
    delete from public.shipping_forecast where ctid is not null;
  end if;

  insert into public.shipping_forecast
    (po, so, container_no, item_code, feature, loading_date, qty, pcs_per_pkg, pkg, is_accessory, is_special, unit_type, status)
  select
    t.po, t.so, t.container_no, t.item_code, t.feature, t.loading_date,
    t.qty, t.pcs_per_pkg, t.pkg, t.is_accessory, t.is_special, t.unit_type, t.status
  from fg_internal.normalize_forecast_payload(payload) t
  where t.item_code is not null and t.item_code <> '';

  get diagnostics v_count = row_count;
  return v_count;
end;
$$;

-- A8. Kiểm tra token chung cho API VBA
create or replace function fg_internal.check_import_token(p_token text)
returns void
language plpgsql
set search_path = ''
as $$
declare
  v_expected text;
begin
  select value into v_expected
  from public.app_config
  where key = 'import_token';

  if v_expected is null or trim(v_expected) = '' then
    raise exception 'Chưa cấu hình import_token trong bảng app_config.';
  end if;

  if p_token is null or trim(p_token) <> trim(v_expected) then
    raise exception 'Token không hợp lệ.';
  end if;
end;
$$;

-- ============================================================
-- B. API PUBLIC CHO VBA (PostgREST expose — gọi qua /rest/v1/rpc/)
-- ============================================================

-- B1. Tồn kho thành phẩm: thay thế toàn bộ (giống nút NHẬP KHO IN)
create or replace function public.api_replace_inventory(
  p_token text,
  payload jsonb,
  p_dry_run boolean default false
)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform fg_internal.check_import_token(p_token);

  if coalesce(p_dry_run, false) then
    return fg_internal.validate_inventory_payload(payload);
  end if;

  return fg_internal.replace_inventory_impl(payload);
end;
$$;

-- B2. Kế hoạch xuất hàng: mặc định cộng dồn (append), có thể replace
create or replace function public.api_import_shipping_forecast(
  p_token text,
  payload jsonb,
  p_mode text default 'append',
  p_dry_run boolean default false
)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform fg_internal.check_import_token(p_token);

  if coalesce(p_dry_run, false) then
    return fg_internal.validate_forecast_payload(payload);
  end if;

  return fg_internal.import_shipping_forecast_impl(payload, p_mode);
end;
$$;

-- B3. Healthcheck: xác thực token + trả số dòng hiện có (chỉ đọc)
create or replace function public.api_healthcheck(p_token text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_result jsonb;
begin
  perform fg_internal.check_import_token(p_token);

  select jsonb_build_object(
    'ok', true,
    'server_time', now(),
    'inventory_count', (select count(*) from public.inventory),
    'master_data_count', (select count(*) from public.master_data),
    'shipping_forecast_count', (select count(*) from public.shipping_forecast)
  ) into v_result;

  return v_result;
end;
$$;

-- ============================================================
-- C. GIA CỐ HÀM CŨ (WEB ĐANG DÙNG)
-- ============================================================

-- C1. replace_inventory: giữ nguyên chữ ký void cho web, thân đã khóa + validate
create or replace function public.replace_inventory(payload jsonb)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform fg_internal.replace_inventory_impl(payload);
end;
$$;

-- C2. replace_master_data: thêm advisory lock chống chạy song song
create or replace function public.replace_master_data(payload jsonb)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  begin
    set local sql_safe_updates = off;
  exception when others then
    null;
  end;

  perform pg_advisory_xact_lock(738001, 3);

  delete from public.master_data where ctid is not null;

  insert into public.master_data (tag_id, batch, lp_no, stock_code, qty, wh_location, warehouse, create_date)
  with vals as (
    select
      coalesce(
        nullif(trim(item->>'batch'), ''),
        nullif(trim(item->>'tag_id'), ''),
        nullif(trim(item->>'BATCH'), '')
      ) as b,
      coalesce(
        nullif(trim(item->>'stock_code'), ''),
        nullif(trim(item->>'lp_no'), ''),
        nullif(trim(item->>'LP.No'), '')
      ) as c,
      nullif(trim(item->>'qty'), '')::numeric as q,
      coalesce(
        nullif(trim(item->>'warehouse'), ''),
        nullif(trim(item->>'wh_location'), '')
      ) as w,
      coalesce(
        nullif(trim(item->>'create_date'), ''),
        nullif(trim(item->>'createdate'), ''),
        nullif(trim(item->>'CREATEDATE'), '')
      ) as d
    from jsonb_array_elements(payload) as item
  )
  select b, b, c, c, q, w, w, d from vals;
end;
$$;

-- ============================================================
-- D. PHÂN QUYỀN
-- ============================================================
grant execute on function public.replace_inventory(jsonb) to anon, authenticated;
grant execute on function public.replace_master_data(jsonb) to anon, authenticated;
grant execute on function public.api_replace_inventory(text, jsonb, boolean) to anon, authenticated;
grant execute on function public.api_import_shipping_forecast(text, jsonb, text, boolean) to anon, authenticated;
grant execute on function public.api_healthcheck(text) to anon, authenticated;

revoke all on all functions in schema fg_internal from public, anon, authenticated;

-- ============================================================
-- E. LÀM MỚI SCHEMA CACHE POSTGREST
-- ============================================================
notify pgrst, 'reload schema';
