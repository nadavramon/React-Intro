#!/usr/bin/env bash
# Claude Code statusline. Receives a JSON payload on stdin describing the
# current session; prints a single line: directory, git branch, and model.

input="$(cat)"

# Pull the full working dir and model name out of the JSON, tab-separated.
parsed="$(printf '%s' "$input" | node -e "
  let s = '';
  process.stdin.on('data', (d) => (s += d));
  process.stdin.on('end', () => {
    let j = {};
    try { j = JSON.parse(s); } catch {}
    const dir = (j.workspace && j.workspace.current_dir) || j.cwd || process.cwd();
    const model = (j.model && (j.model.display_name || j.model.id)) || 'Claude';
    process.stdout.write(dir + '\t' + model);
  });
")"

dir="${parsed%%$'\t'*}"
model="${parsed##*$'\t'}"

branch="$(git -C "${dir:-.}" rev-parse --abbrev-ref HEAD 2>/dev/null)"

line="📁 $(basename "${dir:-?}")"
[ -n "$branch" ] && line="${line}  🌿 ${branch}"
line="${line}  🤖 ${model}"

printf '%s' "$line"
