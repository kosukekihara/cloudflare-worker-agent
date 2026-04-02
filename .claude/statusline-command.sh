#!/bin/sh
# Claude Code statusLine - 2-line, foreground-only, dynamic colors, progress bars
# Line 1: Model, Tokens, Context usage, Rate limits
# Line 2: Git branch, Worktree, Current directory

input=$(cat)
reset='\033[0m'
bold='\033[1m'

fg() { printf '\033[38;5;%sm' "$1"; }

# ── Parse JSON ──────────────────────────────────────────────────────────────
cwd=$(echo "$input"          | jq -r '.workspace.current_dir // .cwd // ""')
model=$(echo "$input"        | jq -r '.model.display_name // ""')
used=$(echo "$input"         | jq -r '.context_window.used_percentage // ""')
ctx_max=$(echo "$input"      | jq -r '.context_window.context_window_size // .context_window.max_tokens // 0')
total_in=$(echo "$input"     | jq -r '.context_window.total_input_tokens // 0')
total_out=$(echo "$input"    | jq -r '.context_window.total_output_tokens // 0')
cache_read=$(echo "$input"   | jq -r '.context_window.cache_read_input_tokens // 0')
cache_create=$(echo "$input" | jq -r '.context_window.cache_creation_input_tokens // 0')
worktree=$(echo "$input"     | jq -r '.worktree.name // ""')
wt_branch=$(echo "$input"    | jq -r '.worktree.branch // ""')
cur_in=$(echo "$input"       | jq -r '.context_window.current_usage.input_tokens // 0')
cur_cache_read=$(echo "$input" | jq -r '.context_window.current_usage.cache_read_input_tokens // 0')
cur_cache_create=$(echo "$input" | jq -r '.context_window.current_usage.cache_creation_input_tokens // 0')
rate_5h=$(echo "$input"      | jq -r '.rate_limits.five_hour.used_percentage // ""')
rate_7d=$(echo "$input"      | jq -r '.rate_limits.seven_day.used_percentage // ""')


# ── Git branch + dirty status ───────────────────────────────────────────────
git_branch=""
git_dirty=0
if [ -n "$cwd" ] && git -C "$cwd" rev-parse --is-inside-work-tree >/dev/null 2>&1; then
  git_branch=$(git -C "$cwd" symbolic-ref --short HEAD 2>/dev/null \
    || git -C "$cwd" rev-parse --short HEAD 2>/dev/null)
  if ! git -C "$cwd" diff-index --quiet HEAD -- 2>/dev/null; then
    git_dirty=1
  fi
  if [ -n "$(git -C "$cwd" ls-files --others --exclude-standard 2>/dev/null | head -1)" ]; then
    git_dirty=2
  fi
fi


# ── Format token count ───────────────────────────────────────────────────────
fmt_tokens() {
  t=$1
  if [ "$t" -ge 1000000 ]; then
    awk "BEGIN{printf \"%.1fM\", $t/1000000}"
  elif [ "$t" -ge 1000 ]; then
    awk "BEGIN{printf \"%.1fk\", $t/1000}"
  else
    echo "$t"
  fi
}

total_tokens=$(( total_in + total_out ))
cache_total=$(( cache_read + cache_create ))
in_str=$(fmt_tokens "$total_in")
out_str=$(fmt_tokens "$total_out")
cache_str=$(fmt_tokens "$cache_total")

# ── Dynamic color by percentage ─────────────────────────────────────────────
pct_color() {
  pct=$1
  if [ "$pct" -ge 90 ]; then
    echo 196
  elif [ "$pct" -ge 80 ]; then
    echo 208
  elif [ "$pct" -ge 70 ]; then
    echo 220
  else
    echo 78
  fi
}

# ── Progress bar (8 blocks) ─────────────────────────────────────────────────
progress_bar() {
  pct=$1
  color=$2
  width=8
  filled=$(( pct * width / 100 ))
  [ "$filled" -gt "$width" ] && filled=$width
  empty=$(( width - filled ))
  bar=""
  i=0; while [ $i -lt $filled ]; do bar="${bar}█"; i=$(( i + 1 )); done
  i=0; while [ $i -lt $empty ];  do bar="${bar}░"; i=$(( i + 1 )); done
  printf "$(fg "$color")%s %d%%${reset}" "$bar" "$pct"
}

# ── Separator ────────────────────────────────────────────────────────────────
sep="$(fg 240) │ ${reset}"

# ══════════════════════════════════════════════════════════════════════════════
# LINE 1 (output as line 2): Branch, Worktree, Current directory
# ══════════════════════════════════════════════════════════════════════════════
line1=""

# 🔀 Git branch — color reflects working tree status, 🌲 if worktree
if [ -n "$git_branch" ]; then
  branch_icon="🔀"
  wt_tag=""
  if [ -n "$worktree" ]; then
    branch_icon="🌲"
    branch_label="${git_branch}"
  else
    branch_label="${git_branch}"
  fi
  if [ "$git_dirty" -eq 2 ]; then
    line1="$(fg 196)${bold}${branch_icon} ${branch_label} ●${reset}"
  elif [ "$git_dirty" -eq 1 ]; then
    line1="$(fg 208)${bold}${branch_icon} ${branch_label} ✎${reset}"
  else
    line1="$(fg 78)${bold}${branch_icon} ${branch_label}${reset}"
  fi
else
  line1="$(fg 240)🚫 no git${reset}"
fi

# 📁 Current directory (shorten with ~)
if [ -n "$cwd" ]; then
  display_cwd="${cwd##*/}"
  [ -n "$line1" ] && line1="${line1}${sep}"
  line1="${line1}$(fg 252)󰉋  ${display_cwd}${reset}"
fi

# ══════════════════════════════════════════════════════════════════════════════
# LINE 2 (output as line 1): Model, Tokens, Context, Rate limits
# ══════════════════════════════════════════════════════════════════════════════
line2=""

# 🤖 Model name
if [ -n "$model" ]; then
  line2="$(fg 75)${model}${reset}"
fi

# 🪙 Token consumption — input, (cache), output (always show)
if [ "$total_tokens" -ge 800000 ]; then
  tok_color=196
elif [ "$total_tokens" -ge 500000 ]; then
  tok_color=208
elif [ "$total_tokens" -ge 200000 ]; then
  tok_color=220
else
  tok_color=78
fi
tok_detail="📥 ${in_str}"
if [ "$cache_total" -gt 0 ]; then
  tok_detail="${tok_detail} 📦 ${cache_str}"
fi
tok_detail="${tok_detail} 📤 ${out_str}"
line2="${line2}${sep}$(fg "$tok_color")${tok_detail}${reset}"

# 󰍛 Context window occupation — current / max tokens
used_int=0
[ -n "$used" ] && used_int=$(printf "%.0f" "$used")
ctx_color=$(pct_color "$used_int")
ctx_used_tokens=$(( cur_in + cur_cache_read + cur_cache_create ))
ctx_used_str=$(fmt_tokens "$ctx_used_tokens")
if [ "$ctx_max" -gt 0 ] 2>/dev/null; then
  ctx_max_str=$(fmt_tokens "$ctx_max")
  line2="${line2}${sep}$(fg "$ctx_color")󰍛  ${ctx_used_str} / ${ctx_max_str}${reset}"
else
  line2="${line2}${sep}$(fg "$ctx_color")󰍛  ${ctx_used_str}${reset}"
fi

# 📊 Context window usage — progress bar
line2="${line2} $(progress_bar "$used_int" "$ctx_color")"

# ⚡ Rate limit 5h — progress bar (always show)
r5_int=0
[ -n "$rate_5h" ] && r5_int=$(printf "%.0f" "$rate_5h")
r5_color=$(pct_color "$r5_int")
line2="${line2}${sep}$(fg "$r5_color")⚡ 5h $(progress_bar "$r5_int" "$r5_color")"

# 📅 Rate limit 7d — progress bar (always show)
r7_int=0
[ -n "$rate_7d" ] && r7_int=$(printf "%.0f" "$rate_7d")
r7_color=$(pct_color "$r7_int")
line2="${line2}${sep}$(fg "$r7_color")📅 7d $(progress_bar "$r7_int" "$r7_color")"

# ── Output (2 lines) ────────────────────────────────────────────────────────
printf "%b\n%b" "$line1" "$line2"
