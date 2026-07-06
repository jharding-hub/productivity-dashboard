#!/usr/bin/env bash
#
# secret-guard.sh — Claude Code PreToolUse hook (Edit | Write | MultiEdit)
#
# Blocks Claude-authored writes that introduce secret-shaped strings, and
# covers the paths your CI secret-grep misses (public/**, *.html, config.js,
# wrangler.toml) because it inspects the *content being written*, not a path
# allow-list.
#
# SCOPE — READ THIS:
#   Fires ONLY when Claude writes a file via Edit/Write/MultiEdit.
#   A secret you paste by hand in your own editor will NOT trigger it.
#   It is a COMPLEMENT to security-scan.yml, not a replacement. Keep both.
#
# Exit codes (Claude Code hook contract):
#   0 = allow the write
#   2 = block; stderr is fed back to Claude so it can course-correct
#   other non-zero = non-blocking error shown to you; the write proceeds
# On any tooling/parse error this hook fails OPEN (exit 0) with a message,
# because CI is the real backstop and a wedged session helps no one.

payload="$(cat)"

if ! command -v jq >/dev/null 2>&1; then
  echo "secret-guard: jq not found — guard is inert. Install jq to enable it." >&2
  exit 0
fi

file_path="$(printf '%s' "$payload" | jq -r '.tool_input.file_path // empty' 2>/dev/null)"

# Collect the text actually being written: Write.content, Edit.new_string,
# and every MultiEdit edits[].new_string.
new_content="$(printf '%s' "$payload" | jq -r '
  [ .tool_input.content    // empty,
    .tool_input.new_string // empty,
    ( .tool_input.edits // [] | .[].new_string // empty )
  ] | join("\n")
' 2>/dev/null)"

# Nothing to inspect -> allow.
[ -z "$new_content" ] && exit 0

# Secret shapes tuned to Centerpost's backend.
# NOTE: intentionally omits Firebase web keys (AIza...). Those are PUBLIC client
# config in your config.js; flagging them would only train you to bypass this.
patterns=(
  'sk-ant-[A-Za-z0-9_-]{20,}'                  # Anthropic API key  (prior-incident vector)
  'sk-[A-Za-z0-9]{20,}'                         # OpenAI-style secret key
  'SG\.[A-Za-z0-9_-]{16,}\.[A-Za-z0-9_-]{16,}'  # SendGrid API key
  'AC[0-9a-f]{32}'                              # Twilio Account SID
  'SK[0-9a-f]{32}'                              # Twilio API Key SID
  'account_id.*[0-9a-f]{32}'                    # Cloudflare account_id (wrangler.toml)
  'AKIA[0-9A-Z]{16}'                            # AWS access key id
  '-----BEGIN[A-Z ]*PRIVATE KEY-----'           # any PEM private key
)

report=""
for pat in "${patterns[@]}"; do
  match="$(printf '%s' "$new_content" | grep -nE -- "$pat" 2>/dev/null \
            | sed -E 's#[A-Za-z0-9_+./-]{12,}#<redacted>#g')"
  if [ -n "$match" ]; then
    report="${report}  /$pat/"$'\n'"$(printf '%s' "$match" | sed 's/^/    /')"$'\n'
  fi
done

if [ -n "$report" ]; then
  {
    echo "secret-guard BLOCKED a write to: ${file_path:-<unknown>}"
    echo "Secret-shaped content detected (values masked):"
    printf '%s' "$report"
    echo "-> If real: use 'wrangler secret put' or an env var; do not commit it."
    echo "-> If false positive: adjust patterns in .claude/hooks/secret-guard.sh"
  } >&2
  exit 2
fi

exit 0
