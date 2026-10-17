-- Assert chức năng cho database/api_vba.sql (chạy trên Postgres local, xem scripts/test-sql-api.sh)
\echo '   [2/2] Assert chức năng API (token, trùng lặp, dry-run, append/replace, healthcheck)'

-- 1. Token sai phải bị chặn
do $$
begin
  begin
    perform public.api_replace_inventory('sai-token', '[]'::jsonb, true);
    raise exception 'FAIL: token sai không bị chặn';
  exception when others then
    if sqlerrm <> 'Token không hợp lệ.' then raise; end if;
  end;
end $$;

-- 2. File trùng Tag ID + Bin phải bị chặn kèm thông báo tiếng Việt
do $$
begin
  begin
    perform public.api_replace_inventory(
      'c20695cbfa064b3c98f6c376ff97f4d62d99bc5b',
      '[{"tag_id":"DUP-1","bin":"B1"},{"tag_id":"DUP-1","bin":"B1"}]'::jsonb,
      false
    );
    raise exception 'FAIL: file trùng không bị chặn';
  exception when others then
    if sqlerrm not like '%trùng%' then raise; end if;
  end;
end $$;

-- 3. dry-run: trả đúng số dòng nhưng KHÔNG ghi dữ liệu
truncate public.inventory;
insert into public.inventory (tag_id, bin) values ('OLD-1', 'B9');
do $$
declare v integer;
begin
  v := public.api_replace_inventory(
    'c20695cbfa064b3c98f6c376ff97f4d62d99bc5b',
    public.test_inv_payload(100),
    true
  );
  if v <> 100 then raise exception 'FAIL: dry-run trả % (kỳ vọng 100)', v; end if;
  select count(*) into v from public.inventory;
  if v <> 1 then raise exception 'FAIL: dry-run đã ghi dữ liệu (count=%)', v; end if;
end $$;

-- 4. Ghi thật: 100 dòng -> count = 100
do $$
declare v integer;
begin
  v := public.api_replace_inventory(
    'c20695cbfa064b3c98f6c376ff97f4d62d99bc5b',
    public.test_inv_payload(100),
    false
  );
  if v <> 100 then raise exception 'FAIL: ghi thật trả % (kỳ vọng 100)', v; end if;
  select count(*) into v from public.inventory;
  if v <> 100 then raise exception 'FAIL: count sau ghi thật = % (kỳ vọng 100)', v; end if;
end $$;

-- 5. Kế hoạch xuất hàng: append (cộng dồn), bỏ dòng thiếu item_code, feature fallback
truncate public.shipping_forecast;
do $$
declare
  v integer;
  payload jsonb := '[
    {"po":"PO-1","so":"SO-1","item_code":"8101010104","loading_date":"19/10/2026","qty":6750},
    {"po":"PO-1","so":"SO-1","item_code":"1220190004","loading_date":"19/10/2026","qty":"2000","feature":"1220"},
    {"po":"","so":"","item_code":"","qty":1}
  ]'::jsonb;
begin
  v := public.api_import_shipping_forecast('c20695cbfa064b3c98f6c376ff97f4d62d99bc5b', payload, 'append', false);
  if v <> 2 then raise exception 'FAIL: append trả % (kỳ vọng 2, bỏ dòng thiếu item_code)', v; end if;
  v := public.api_import_shipping_forecast('c20695cbfa064b3c98f6c376ff97f4d62d99bc5b', payload, 'append', false);
  if v <> 2 then raise exception 'FAIL: append lần 2 trả %', v; end if;
end $$;
do $$
declare v integer;
begin
  select count(*) into v from public.shipping_forecast;
  if v <> 4 then raise exception 'FAIL: append count = % (kỳ vọng 4 — cộng dồn)', v; end if;
  select count(*) into v from public.shipping_forecast where feature = '1010' and item_code = '8101010104';
  if v <> 2 then raise exception 'FAIL: feature fallback 1010 sai (count=%)', v; end if;
  select count(*) into v from public.shipping_forecast where qty = 6750;
  if v <> 2 then raise exception 'FAIL: qty numeric sai'; end if;
end $$;

-- 6. replace: xóa sạch rồi nạp
do $$
declare v integer;
begin
  v := public.api_import_shipping_forecast(
    'c20695cbfa064b3c98f6c376ff97f4d62d99bc5b',
    '[{"po":"PO-X","so":"SO-X","item_code":"9999999999","loading_date":"01/01/2027","qty":5}]'::jsonb,
    'replace',
    false
  );
  if v <> 1 then raise exception 'FAIL: replace trả %', v; end if;
  select count(*) into v from public.shipping_forecast;
  if v <> 1 then raise exception 'FAIL: replace count = % (kỳ vọng 1)', v; end if;
end $$;

-- 7. mode sai phải bị chặn
do $$
begin
  begin
    perform public.api_import_shipping_forecast('c20695cbfa064b3c98f6c376ff97f4d62d99bc5b', '[]'::jsonb, 'xyz', false);
    raise exception 'FAIL: mode sai không bị chặn';
  exception when others then
    if sqlerrm not like '%Chế độ không hợp lệ%' then raise; end if;
  end;
end $$;

-- 8. Healthcheck: ok + đúng số dòng
do $$
declare v jsonb;
begin
  v := public.api_healthcheck('c20695cbfa064b3c98f6c376ff97f4d62d99bc5b');
  if (v->>'ok')::boolean is not true then raise exception 'FAIL: healthcheck ok != true'; end if;
  if (v->>'inventory_count')::int <> 100 then raise exception 'FAIL: healthcheck inventory_count = %', v->>'inventory_count'; end if;
  if (v->>'shipping_forecast_count')::int <> 1 then raise exception 'FAIL: healthcheck forecast count = %', v->>'shipping_forecast_count'; end if;
end $$;

-- 9. replace_inventory (kênh web, không token) cũng phải chặn trùng
do $$
begin
  begin
    perform public.replace_inventory('[{"tag_id":"DUP-2","bin":"B1"},{"tag_id":"DUP-2","bin":"B1"}]'::jsonb);
    raise exception 'FAIL: replace_inventory không chặn trùng';
  exception when others then
    if sqlerrm not like '%trùng%' then raise; end if;
  end;
end $$;

\echo '   OK: 9/9 nhóm assert chức năng PASS'
