#!/usr/bin/env bash
# Runs the release suite against one URL, sequentially (each test needs the GPU to itself).
# Usage: bash scripts/release_suite.sh <url> <log> [names...]   e.g. http://localhost:4180/html/12345/ (an extracted zip)
# Names: SMOKE_EDGE QA INPUT MUSIC MOBILE_844 MOBILE_740 FIRSTLINE SMOKE_CHROME SMOKE_FIREFOX MONKEY STRESS (default: all, ~22 min)
cd "/c/Game Dev/Bad Omen" || exit 1
URL="$1"; LOG="$2"; shift 2
export PW_FIREFOX="C:/Users/aswin/AppData/Local/ms-playwright/firefox-1538/firefox/firefox.exe"
ALL="SMOKE_EDGE QA INPUT MUSIC MOBILE_844 MOBILE_740 FIRSTLINE SMOKE_CHROME SMOKE_FIREFOX MONKEY STRESS"
NAMES="${*:-$ALL}"
run() {
  local name="$1"; shift
  echo "=== $name $(date +%H:%M:%S)" >> "$LOG"
  "$@" >> "$LOG" 2>&1
  echo "--- exit $? $(date +%H:%M:%S)" >> "$LOG"
}
: > "$LOG"
for n in $NAMES; do
  case "$n" in
    SMOKE_EDGE)    run $n node scripts/browser_smoke.mjs "$URL" ;;
    QA)            run $n node scripts/qa_probe.mjs "$URL" ;;
    INPUT)         run $n node scripts/input_test.mjs "$URL" ;;
    MUSIC)         run $n node scripts/music_test.mjs "$URL" ;;
    MOBILE_844)    run $n node scripts/mobile_test.mjs "$URL" ;;
    MOBILE_740)    run $n node scripts/mobile_test.mjs "$URL" --size 740x360 ;;
    FIRSTLINE)     run $n node scripts/first_line_test.mjs "$URL" ;;
    SMOKE_CHROME)  run $n node scripts/browser_smoke.mjs "$URL" --chrome ;;
    SMOKE_FIREFOX) run $n node scripts/browser_smoke.mjs "$URL" --firefox ;;
    MONKEY)        run $n node scripts/monkey_test.mjs "$URL" --minutes 6 ;;
    STRESS)        run $n node scripts/stress_test.mjs "$URL" ;;
  esac
done
echo "=== ALL DONE $(date +%H:%M:%S)" >> "$LOG"
