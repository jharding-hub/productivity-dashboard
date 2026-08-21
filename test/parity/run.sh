#!/usr/bin/env bash
# ═══════════════════════════════════════════════════════════════════
# A-2 WIDGET DAY PARITY (panel survey Stage 9)
#
# The native home-screen widget runs as a SEPARATE PROCESS with no access to
# legacy.js, so it carries its own copy of the day arithmetic in
# TodayWidget.swift. If that copy and _anchoredDayKey() ever disagree, an
# anchored account's widget confidently renders a different "today" than the
# app -- silently, and only on device.
#
# This proves they agree rather than assuming it. The Swift function is
# EXTRACTED VERBATIM from the shipping TodayWidget.swift at run time, so the
# harness cannot drift from the code it is vouching for: if someone edits
# dayKey(), this tests the edited version.
#
# Run: npm run test:parity          (needs Xcode's swiftc + the Capacitor repo)
# ═══════════════════════════════════════════════════════════════════
set -u
HERE="$(cd "$(dirname "$0")" && pwd)"
NATIVE="${CENTERPOST_NATIVE:-/Users/jhmac/Desktop/git hub productivity}"
SWIFT_SRC="$NATIVE/ios/App/FocusTimerWidget/TodayWidget.swift"

if [ ! -f "$SWIFT_SRC" ]; then
  echo "SKIP: TodayWidget.swift not found at $SWIFT_SRC"
  echo "      (set CENTERPOST_NATIVE to the Capacitor repo root)"
  exit 0
fi
if ! command -v xcrun >/dev/null 2>&1; then
  echo "SKIP: xcrun not available (needs Xcode)"; exit 0
fi

WORK="$(mktemp -d)"
trap 'rm -rf "$WORK"' EXIT

# Extract the real dayKey(_:anchorMin:) implementation, verbatim.
python3 - "$SWIFT_SRC" "$WORK/extracted.swift" <<'PY'
import io, re, sys
src = io.open(sys.argv[1], encoding='utf-8').read()
m = re.search(r'private func dayKey\(_ date: Date, anchorMin: Int = 0\) -> String \{.*?\n    \}', src, re.S)
if not m:
    sys.stderr.write('FAIL: could not find dayKey(_:anchorMin:) in TodayWidget.swift\n')
    sys.exit(3)
body = m.group(0).replace('private func', 'func')
body = '\n'.join(l[4:] if l.startswith('    ') else l for l in body.split('\n'))
io.open(sys.argv[2], 'w', encoding='utf-8').write(body + '\n')
PY
[ $? -ne 0 ] && exit 1

{ echo 'import Foundation'; cat "$WORK/extracted.swift"; cat "$HERE/compare.swift"; } > "$WORK/main.swift"
xcrun swiftc -O -o "$WORK/parity" "$WORK/main.swift" || { echo "FAIL: swiftc could not build the harness"; exit 1; }

FAIL=0
for TZNAME in America/New_York America/Los_Angeles UTC Europe/London Asia/Kolkata Australia/Sydney Pacific/Chatham America/St_Johns; do
  OUT=$(TZ="$TZNAME" node "$HERE/js-side.mjs" | TZ="$TZNAME" "$WORK/parity") || FAIL=1
  printf "  %-22s %s\n" "$TZNAME" "$OUT"
done
echo
if [ $FAIL -eq 0 ]; then
  echo "PASS: legacy.js _anchoredDayKey and TodayWidget.swift dayKey agree on every sample"
else
  echo "FAIL: the app and the widget would resolve DIFFERENT days -- do not ship"
fi
exit $FAIL
