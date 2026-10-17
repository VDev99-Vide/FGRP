-- Test-only: mô phỏng replace_inventory CŨ (delete + insert, KHÔNG khóa)
-- pg_sleep ép 2 transaction chồng lấn để tái hiện bug 2.508 -> 5.016 một cách chắc chắn.
create or replace function public.test_old_replace_inventory(payload jsonb)
returns void
language plpgsql
as $$
begin
  delete from public.inventory where ctid is not null;
  perform pg_sleep(2);
  insert into public.inventory (tag_id, bin)
  select
    coalesce(nullif(trim(item->>'tag_id'), ''), nullif(trim(item->>'batch'), '')),
    coalesce(trim(item->>'bin'), '')
  from jsonb_array_elements(payload) as item;
end;
$$;

-- Test-only: sinh payload tồn kho n dòng (tag_id duy nhất)
create or replace function public.test_inv_payload(n integer)
returns jsonb
language sql
as $$
  select jsonb_agg(jsonb_build_object(
    'tag_id', 'TAG-' || lpad(i::text, 7, '0'),
    'bin', 'WH' || (i % 50)
  ))
  from generate_series(1, n) as i;
$$;
