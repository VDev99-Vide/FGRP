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

-- 10. Cập nhật nguồn: token sai phải bị chặn
do $$
begin
  begin
    perform public.api_replace_master_data('sai-token', '[]'::jsonb, true);
    raise exception 'FAIL: token sai không bị chặn (master)';
  exception when others then
    if sqlerrm <> 'Token không hợp lệ.' then raise; end if;
  end;
end $$;

-- 11. dry-run master: đếm đúng, KHÔNG ghi dữ liệu (bỏ dòng batch rỗng)
truncate public.master_data;
insert into public.master_data (batch, stock_code) values ('OLD-M', 'OLD-S');
do $$
declare v integer;
begin
  v := public.api_replace_master_data(
    'c20695cbfa064b3c98f6c376ff97f4d62d99bc5b',
    '[{"batch":"B1","stock_code":"8101010104","qty":10,"warehouse":"1","create_date":"01/01/2026"},
      {"batch":"","stock_code":"8101010104","qty":1},
      {"batch":"B2","stock_code":"1220190004","qty":"20"}]'::jsonb,
    true
  );
  if v <> 2 then raise exception 'FAIL: dry-run master trả % (kỳ vọng 2, bỏ dòng batch rỗng)', v; end if;
  select count(*) into v from public.master_data;
  if v <> 1 then raise exception 'FAIL: dry-run master đã ghi dữ liệu (count=%)', v; end if;
end $$;

-- 12. Ghi thật master: mapping đủ cột (batch+tag_id, stock_code+lp_no, warehouse+wh_location)
do $$
declare v integer;
begin
  v := public.api_replace_master_data(
    'c20695cbfa064b3c98f6c376ff97f4d62d99bc5b',
    '[{"batch":"B1","stock_code":"8101010104","qty":10,"warehouse":"1","create_date":"01/01/2026"},
      {"batch":"","stock_code":"8101010104","qty":1},
      {"batch":"B2","stock_code":"1220190004","qty":"20","warehouse":"60","create_date":"15/03/2026"}]'::jsonb,
    false
  );
  if v <> 2 then raise exception 'FAIL: ghi thật master trả % (kỳ vọng 2)', v; end if;
  select count(*) into v from public.master_data;
  if v <> 2 then raise exception 'FAIL: master count = % (kỳ vọng 2)', v; end if;
  select count(*) into v from public.master_data
   where batch = 'B1' and tag_id = 'B1'
     and stock_code = '8101010104' and lp_no = '8101010104'
     and qty = 10 and warehouse = '1' and wh_location = '1'
     and create_date = '01/01/2026';
  if v <> 1 then raise exception 'FAIL: mapping cột master sai (B1)'; end if;
end $$;

-- 13. Kênh web (replace_master_data, không token) vẫn hoạt động + bỏ dòng batch rỗng
do $$
declare v integer;
begin
  perform public.replace_master_data(
    '[{"batch":"WEB-B","stock_code":"9999999999","qty":5},
      {"batch":"   ","stock_code":"8888888888","qty":1}]'::jsonb
  );
  select count(*) into v from public.master_data;
  if v <> 1 then raise exception 'FAIL: replace_master_data (web) count = % (kỳ vọng 1)', v; end if;
  select count(*) into v from public.master_data where batch = 'WEB-B';
  if v <> 1 then raise exception 'FAIL: replace_master_data (web) sai dữ liệu'; end if;
end $$;

\echo '   OK: 13/13 nhóm assert chức năng PASS'
