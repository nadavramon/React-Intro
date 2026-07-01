#!/usr/bin/env bash
# Stop hook: when Claude finishes a turn, typecheck the whole project.
# Runs once per turn on the SETTLED state (not on every intermediate edit),
# so it won't flag transient mid-refactor errors. On failure it exits 2, which
# feeds the errors back to Claude and asks it to fix before finishing.

set -uo pipefail

input="$(cat)"

# Loop guard: if we're already continuing because of a previous Stop-hook block,
# don't block again — otherwise a genuinely unfixable error would loop forever.
active="$(printf '%s' "$input" | node -e "
  let s = '';
  process.stdin.on('data', (d) => (s += d));
  process.stdin.on('end', () => {
    let j = {};
    try { j = JSON.parse(s); } catch {}
    process.stdout.write(j.stop_hook_active ? 'true' : 'false');
  });
")"
[ "$active" = "true" ] && exit 0

cd "${CLAUDE_PROJECT_DIR:-/Users/nadavramon/fullstack_projects/React_Intro}" || exit 0

# Monorepo-aware: a flat repo has a root tsconfig.json; the pnpm/Turbo workspace
# does not (typecheck is per-package via turbo). Mid-migration, before the
# workspace is installed, there's nothing to check — skip gracefully.
if [ -f tsconfig.json ]; then
    cmd=(npx tsc -b)
elif [ -f turbo.json ] && [ -d node_modules ]; then
    cmd=(pnpm turbo run typecheck)
else
    exit 0
fi

if ! output="$("${cmd[@]}" 2>&1)"; then
    echo "Typecheck failed (${cmd[*]}) — fix these before finishing:" >&2
    echo "$output" >&2
    exit 2
fi

exit 0
