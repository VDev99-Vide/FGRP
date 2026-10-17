#!/usr/bin/env bash
# ============================================================
# Test SQL API FGRP trên Postgres local (Docker) — bằng chứng thật:
#   1. Tái hiện bug nhân đôi: replace CŨ chạy song song -> 2.508 thành 5.016
#   2. Chứng minh fix: replace_inventory mới (advisory lock) song song -> luôn 2.508
#   3. Chứng minh lời gọi thứ 2 phải chờ advisory lock
#   4. Assert chức năng: token, chặn trùng, dry-run, append/replace, healthcheck
#
# Chạy: bash scripts/test-sql-api.sh
# ============================================================
set -euo pipefail

CONTAINER="${FGRP_PG_CONTAINER:-fgrp-sql-test}"
PORT="${FGRP_PG_PORT:-55432}"
ROOT="$(cd "$(dirname "$0")/.." && pwd)"

PSQL=(docker exec -i "$CONTAINER" psql -U postgres -v ON_ERROR_STOP=1 -q)
Q() { docker exec -i "$CONTAINER" psql -U postgres -tA -c "$1"; }

cleanup() { docker rm -f "$CONTAINER" >/dev/null 2>&1 || true; }
trap cleanup EXIT

echo "== [1/5] Khởi động Postgres 16 (Docker) =="
docker rm -f "$CONTAINER" >/dev/null 2>&1 || true
docker run -d --name "$CONTAINER" -e POSTGRES_PASSWORD=test -p "$PORT":5432 postgres:16-alpine >/dev/null
READY=0
for _ in $(seq 1 60); do
  if docker exec "$CONTAINER" pg_isready -U postgres >/dev/null 2>&1; then READY=1; break; fi
  sleep 1
done
[ "$READY" = "1" ] || { echo "FAIL: Postgres không khởi động được"; exit 1; }

echo "== [2/5] Nạp schema + database/api_vba.sql =="
"${PSQL[@]}" < "$ROOT/scripts/sql/schema.sql"
"${PSQL[@]}" < "$ROOT/database/api_vba.sql"
"${PSQL[@]}" < "$ROOT/scripts/sql/race_old.sql"

echo "== [3/5] TÁI HIỆN BUG: 2 lời gọi song song bằng hàm replace CŨ (không khóa) =="
Q "truncate public.inventory" >/dev/null
Q "select public.test_old_replace_inventory(public.test_inv_payload(2508))" >/dev/null &
PID_A=$!
Q "select public.test_old_replace_inventory(public.test_inv_payload(2508))" >/dev/null &
PID_B=$!
wait "$PID_A" "$PID_B"
OLD_COUNT=$(Q "select count(*) from public.inventory")
echo "   -> inventory sau 2 lời gọi song song (hàm CŨ): $OLD_COUNT dòng"
if [ "$OLD_COUNT" != "5016" ]; then
  echo "FAIL: không tái hiện được bug (kỳ vọng 5016)"
  exit 1
fi

echo "== [4/5] FIX: replace_inventory mới chạy song song 5 vòng (kỳ vọng luôn 2508) =="
for round in 1 2 3 4 5; do
  Q "truncate public.inventory" >/dev/null
  Q "select public.replace_inventory(public.test_inv_payload(2508))" >/dev/null &
  PID_A=$!
  Q "select public.replace_inventory(public.test_inv_payload(2508))" >/dev/null &
  PID_B=$!
  wait "$PID_A" "$PID_B"
  C=$(Q "select count(*) from public.inventory")
  echo "   vòng $round: $C dòng"
  if [ "$C" != "2508" ]; then
    echo "FAIL: kỳ vọng 2508 nhưng nhận $C (vòng $round)"
    exit 1
  fi
done

echo "== [4b/5] Advisory lock: lời gọi thứ 2 phải CHỜ lock đang giữ =="
docker exec -i "$CONTAINER" psql -U postgres -q -c "begin; select pg_advisory_xact_lock(738001,1); select pg_sleep(2); commit;" >/dev/null &
LOCK_PID=$!
sleep 0.5
START_MS=$(date +%s%3N)
Q "select public.replace_inventory(public.test_inv_payload(2508))" >/dev/null
END_MS=$(date +%s%3N)
ELAPSED_MS=$(( END_MS - START_MS ))
wait "$LOCK_PID"
echo "   lời gọi mất ${ELAPSED_MS}ms (bắt đầu sau 0.5s, lock giữ 2s => phải >= ~1400ms)"
if [ "$ELAPSED_MS" -lt 1300 ]; then
  echo "FAIL: lời gọi không chờ advisory lock (${ELAPSED_MS}ms)"
  exit 1
fi
C=$(Q "select count(*) from public.inventory")
[ "$C" = "2508" ] || { echo "FAIL: count sau chờ lock = $C"; exit 1; }

echo "== [4c/5] Advisory lock master_data (khóa 738001,3) =="
Q "truncate public.master_data" >/dev/null
docker exec -i "$CONTAINER" psql -U postgres -q -c "begin; select pg_advisory_xact_lock(738001,3); select pg_sleep(2); commit;" >/dev/null &
LOCK_PID=$!
sleep 0.5
START_MS=$(date +%s%3N)
Q "select public.replace_master_data((select jsonb_agg(jsonb_build_object('batch','MB-'||i,'stock_code','8101'||lpad(i::text,6,'0'),'qty',i)) from generate_series(1,100) i))" >/dev/null
END_MS=$(date +%s%3N)
ELAPSED_MS2=$(( END_MS - START_MS ))
wait "$LOCK_PID"
echo "   lời gọi mất ${ELAPSED_MS2}ms (bắt đầu sau 0.5s, lock giữ 2s => phải >= ~1400ms)"
if [ "$ELAPSED_MS2" -lt 1300 ]; then
  echo "FAIL: replace_master_data không chờ advisory lock (${ELAPSED_MS2}ms)"
  exit 1
fi
C=$(Q "select count(*) from public.master_data")
[ "$C" = "100" ] || { echo "FAIL: master count sau chờ lock = $C"; exit 1; }

echo "== [5/5] Assert chức năng API =="
"${PSQL[@]}" < "$ROOT/scripts/sql/test_api.sql"

echo ""
echo "============================================================"
echo "PASS TOÀN BỘ: SQL API đã được kiểm chứng thật trên Postgres 16"
echo "  - Bug cũ tái hiện:    2508 x 2 = 5016 (hàm không khóa)"
echo "  - Hàm mới có lock:    2508 (5/5 vòng song song)"
echo "  - Lời gọi thứ 2 chờ advisory lock inventory: ${ELAPSED_MS}ms"
echo "  - Lời gọi thứ 2 chờ advisory lock master_data: ${ELAPSED_MS2}ms"
echo "  - 13/13 nhóm assert chức năng PASS"
echo "============================================================"
