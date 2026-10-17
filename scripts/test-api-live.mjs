#!/usr/bin/env node
/**
 * Kiểm chứng API VBA trên Supabase THẬT — chỉ READ-ONLY + DRY-RUN, KHÔNG ghi dữ liệu.
 *
 * Cách dùng:
 *   node scripts/test-api-live.mjs            # đầy đủ (cần đã chạy database/api_vba.sql)
 *   node scripts/test-api-live.mjs --readonly # chỉ đếm số dòng (không cần SQL mới)
 *
 * Token lấy từ database/api_vba.sql hoặc env FGRP_TOKEN.
 */
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const readonlyOnly = process.argv.includes('--readonly')

const supabaseSrc = readFileSync(join(ROOT, 'src/services/supabase.ts'), 'utf8')
const URL_BASE = (process.env.VITE_SUPABASE_URL || supabaseSrc.match(/DEFAULT_SUPABASE_URL = '([^']+)'/)?.[1] || '').replace(/\/$/, '')
const ANON_KEY = process.env.VITE_SUPABASE_ANON_KEY || supabaseSrc.match(/DEFAULT_SUPABASE_ANON_KEY = '([^']+)'/)?.[1] || ''
const sqlSrc = readFileSync(join(ROOT, 'database/api_vba.sql'), 'utf8')
const TOKEN = process.env.FGRP_TOKEN || sqlSrc.match(/values \('import_token', '([0-9a-f]+)'\)/)?.[1] || ''

let passed = 0
let failed = 0

function ok(name, detail = '') {
  passed++
  console.log(`  PASS  ${name}${detail ? ` — ${detail}` : ''}`)
}
function fail(name, detail = '') {
  failed++
  console.error(`  FAIL  ${name}${detail ? ` — ${detail}` : ''}`)
}

async function rest(path) {
  const res = await fetch(`${URL_BASE}/rest/v1/${path}`, {
    headers: {
      apikey: ANON_KEY,
      Authorization: `Bearer ${ANON_KEY}`,
      Prefer: 'count=exact'
    }
  })
  return res
}

async function count(table) {
  const res = await rest(`${table}?select=id&limit=1`)
  const range = res.headers.get('content-range') || ''
  return Number(range.split('/')[1] || NaN)
}

async function rpc(fn, body) {
  const res = await fetch(`${URL_BASE}/rest/v1/rpc/${fn}`, {
    method: 'POST',
    headers: {
      apikey: ANON_KEY,
      Authorization: `Bearer ${ANON_KEY}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(body)
  })
  const text = await res.text()
  let json = null
  try { json = JSON.parse(text) } catch { /* plain number body */ }
  return { status: res.status, text, json }
}

console.log('=== FGRP API LIVE VERIFY ===')
console.log(`URL: ${URL_BASE}`)
console.log(`Token: ${TOKEN ? TOKEN.slice(0, 6) + '...' : '(không tìm thấy)'}`)
console.log('')

console.log('[1] Đếm số dòng hiện tại (read-only)')
const invBefore = await count('inventory')
const fcBefore = await count('shipping_forecast')
if (Number.isFinite(invBefore) && Number.isFinite(fcBefore)) {
  ok('kết nối REST', `inventory=${invBefore}, shipping_forecast=${fcBefore}`)
} else {
  fail('kết nối REST', 'không đọc được content-range')
  process.exit(1)
}

if (readonlyOnly) {
  console.log('\n(--readonly) Bỏ qua kiểm tra RPC.')
  process.exit(0)
}

console.log('\n[2] api_healthcheck (RPC + token)')
const health = await rpc('api_healthcheck', { p_token: TOKEN })
if (health.status === 404) {
  fail('api_healthcheck', 'RPC chưa tồn tại — hãy chạy database/api_vba.sql trong Supabase SQL Editor trước')
  console.log('\nHƯỚNG DẪN: mở Supabase > SQL Editor > dán toàn bộ database/api_vba.sql > Run, rồi chạy lại script này.')
  process.exit(2)
}
if (health.json?.ok === true && typeof health.json.inventory_count === 'number') {
  ok('api_healthcheck', `ok=true, inventory_count=${health.json.inventory_count}, forecast=${health.json.shipping_forecast_count}`)
} else {
  fail('api_healthcheck', health.text.slice(0, 200))
}

console.log('\n[3] Token sai phải bị từ chối')
const bad = await rpc('api_replace_inventory', { p_token: 'sai-token', payload: [], p_dry_run: true })
if (bad.status >= 400 && bad.text.includes('Token')) {
  ok('token sai bị chặn', bad.text.slice(0, 80))
} else {
  fail('token sai bị chặn', `status=${bad.status} body=${bad.text.slice(0, 120)}`)
}

console.log('\n[4] DRY-RUN tồn kho (2 dòng giả, không ghi dữ liệu)')
const invDry = await rpc('api_replace_inventory', {
  p_token: TOKEN,
  payload: [
    { tag_id: 'DRYRUN-TAG-1', bin: 'DRY-BIN' },
    { tag_id: 'DRYRUN-TAG-2', bin: 'DRY-BIN' }
  ],
  p_dry_run: true
})
if (invDry.status < 300 && Number(invDry.text.trim()) === 2) {
  ok('dry-run trả đúng 2 dòng', invDry.text.trim())
} else {
  fail('dry-run tồn kho', `status=${invDry.status} body=${invDry.text.slice(0, 160)}`)
}

console.log('\n[5] DRY-RUN kế hoạch xuất hàng (2 dòng giả)')
const fcDry = await rpc('api_import_shipping_forecast', {
  p_token: TOKEN,
  payload: [
    { po: 'DRY-PO', so: 'DRY-SO', item_code: '8101010104', loading_date: '01/01/2027', qty: 10 },
    { po: 'DRY-PO', so: 'DRY-SO', item_code: '', loading_date: '', qty: 1 }
  ],
  p_mode: 'append',
  p_dry_run: true
})
if (fcDry.status < 300 && Number(fcDry.text.trim()) === 1) {
  ok('dry-run bỏ dòng thiếu item_code, trả đúng 1', fcDry.text.trim())
} else {
  fail('dry-run kế hoạch xuất', `status=${fcDry.status} body=${fcDry.text.slice(0, 160)}`)
}

console.log('\n[6] Xác nhận dry-run KHÔNG ghi dữ liệu')
const invAfter = await count('inventory')
const fcAfter = await count('shipping_forecast')
if (invAfter === invBefore && fcAfter === fcBefore) {
  ok('số dòng không đổi', `inventory=${invAfter}, forecast=${fcAfter}`)
} else {
  fail('dữ liệu bị thay đổi', `inventory ${invBefore}->${invAfter}, forecast ${fcBefore}->${fcAfter}`)
}

console.log('')
if (failed === 0) {
  console.log(`KẾT QUẢ: ${passed}/${passed + failed} PASS — API sẵn sàng cho VBA one-click.`)
  process.exit(0)
} else {
  console.error(`KẾT QUẢ: ${failed} FAIL / ${passed + failed} kiểm tra.`)
  process.exit(1)
}
