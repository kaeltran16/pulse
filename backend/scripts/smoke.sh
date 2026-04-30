#!/usr/bin/env bash
set -euo pipefail

# Usage:
#   BASE_URL=http://<droplet-host>:3000 DEV_JWT=ey... ./scripts/smoke.sh
#
# Exits non-zero on any failure. Intended to run after deploy.

: "${BASE_URL:?BASE_URL is required}"
: "${DEV_JWT:?DEV_JWT is required}"

AUTH=(-H "Authorization: Bearer ${DEV_JWT}")
JSON=(-H "Content-Type: application/json")

check_status() {
  local desc="$1" expected="$2" actual="$3"
  if [ "${actual}" != "${expected}" ]; then
    echo "FAIL: ${desc} — expected ${expected}, got ${actual}" >&2
    exit 1
  fi
  echo "OK:   ${desc} (${actual})"
}

# 1. /health
status=$(curl -s -o /tmp/pulse_health.json -w "%{http_code}" "${BASE_URL}/health")
check_status "GET /health" 200 "${status}"
grep -q '"ok":true' /tmp/pulse_health.json

# 2. /parse happy
status=$(curl -s -o /tmp/pulse_parse.json -w "%{http_code}" -X POST "${BASE_URL}/parse" "${AUTH[@]}" "${JSON[@]}" \
  -d '{"text":"spent 5.75 at starbucks"}')
check_status "POST /parse" 200 "${status}"
grep -q '"kind":"spend"' /tmp/pulse_parse.json

# 3. /chat SSE — fetch first chunk
status=$(curl -s -N -o /tmp/pulse_chat.txt -w "%{http_code}" -X POST "${BASE_URL}/chat" "${AUTH[@]}" "${JSON[@]}" \
  --max-time 30 \
  -d '{"messages":[{"role":"user","content":"say hi in one word"}]}')
check_status "POST /chat" 200 "${status}"
grep -q '^event: chunk' /tmp/pulse_chat.txt
grep -q '^event: done'  /tmp/pulse_chat.txt

# 4. /review happy
status=$(curl -s -o /tmp/pulse_review.json -w "%{http_code}" -X POST "${BASE_URL}/review" "${AUTH[@]}" "${JSON[@]}" \
  -d '{"period":"weekly","periodKey":"2026-W18","aggregates":{"spend":{"totalMinor":0,"currency":"USD","byCategory":{},"byDayOfWeek":[0,0,0,0,0,0,0],"topMerchant":null},"rituals":{"kept":0,"goalTotal":0,"perRitual":[],"bestStreakRitual":null},"workouts":{"sessions":0,"prCount":0}},"signals":{"topSpendDay":null,"ritualVsNonRitual":null,"bestStreak":null,"underBudget":null}}')
check_status "POST /review" 200 "${status}"
grep -q '"hero"' /tmp/pulse_review.json

# 5. /chat without auth → 401
status=$(curl -s -o /dev/null -w "%{http_code}" -X POST "${BASE_URL}/chat" "${JSON[@]}" \
  -d '{"messages":[{"role":"user","content":"x"}]}')
check_status "POST /chat (no auth)" 401 "${status}"

# 6. Rate limit — 70 quick requests; expect at least one 429.
hit429=0
for i in $(seq 1 70); do
  s=$(curl -s -o /dev/null -w "%{http_code}" -X POST "${BASE_URL}/parse" "${AUTH[@]}" "${JSON[@]}" -d '{"text":"x"}')
  if [ "${s}" = "429" ]; then hit429=1; break; fi
done
if [ "${hit429}" != "1" ]; then
  echo "FAIL: rate limit did not trip within 70 requests" >&2
  exit 1
fi
echo "OK:   rate limit observed (429)"

echo "All smoke checks passed."
