#!/usr/bin/env bash
# Prints how big a change is, excluding generated files, against the PR size limits.
# Usage: pnpm pr:size [base-branch]   (default base: main; falls back to uncommitted changes if no commits differ)
# For a stacked branch, pass its target: pnpm pr:size refactor/backup-lifecycle-shell
# CI sets PR_BASE_SHA and PR_HEAD_SHA (and PR_BASE_LABEL) so the PR is measured against its own target branch.
# Limits: up to 200 small, 201-400 normal, 401-800 large (needs a reason), over 800 split it.
# See docs/contributing/pull-requests.md.
set -euo pipefail

base_branch="${1:-main}"
excluded_paths=(':!pnpm-lock.yaml' ':!apps/desktop/drizzle/meta/**' ':!*.snap')

pr_base_sha="${PR_BASE_SHA:-}"
pr_head_sha="${PR_HEAD_SHA:-}"
has_pr_range=false
if [ -n "$pr_base_sha" ] && [ -n "$pr_head_sha" ]; then
  has_pr_range=true
fi

if [ "$has_pr_range" = "true" ]; then
  # CI: exactly what the PR's "Files changed" tab shows, the head against its own target branch.
  # Stacked example: PR 2 targets feature-a, so only PR 2's lines count, not PR 1's.
  diff_args=("$pr_base_sha...$pr_head_sha")
  scope_label="this PR against its target branch ${PR_BASE_LABEL:-$pr_base_sha}"
elif git rev-parse --verify --quiet "$base_branch" >/dev/null && [ "$(git rev-parse HEAD)" != "$(git rev-parse "$base_branch")" ]; then
  diff_args=("$base_branch...HEAD")
  scope_label="commits on this branch since $base_branch"
else
  diff_args=("HEAD")
  scope_label="uncommitted changes against HEAD"
fi

changed_lines=$(git diff --numstat "${diff_args[@]}" -- . "${excluded_paths[@]}" | awk '{ added += $1; removed += $2 } END { print added + removed + 0 }')
changed_files=$(git diff --numstat "${diff_args[@]}" -- . "${excluded_paths[@]}" | wc -l | tr -d ' ')

if [ "${diff_args[0]}" = "HEAD" ]; then
  # New files that are not committed yet do not show in git diff; count their lines too.
  untracked_files=$(git ls-files --others --exclude-standard -- . "${excluded_paths[@]}")
  if [ -n "$untracked_files" ]; then
    untracked_lines=$(printf '%s\n' "$untracked_files" | xargs wc -l | awk 'END { print $1 + 0 }')
    untracked_count=$(printf '%s\n' "$untracked_files" | wc -l | tr -d ' ')
    changed_lines=$((changed_lines + untracked_lines))
    changed_files=$((changed_files + untracked_count))
  fi
fi

if [ "$changed_lines" -le 200 ]; then verdict="Small: ideal"
elif [ "$changed_lines" -le 400 ]; then verdict="Normal: within the target ceiling"
elif [ "$changed_lines" -le 800 ]; then verdict="Large: add a reason to the PR description and consider splitting"
else verdict="Too large: split it (only mechanical changes may exceed 800)"
fi

echo "Scope:         $scope_label"
echo "Changed lines: $changed_lines (added + removed, excluding lock files and generated migration snapshots)"
echo "Changed files: $changed_files"
echo "Verdict:       $verdict"

# CI mode (spec 017, FR-005): PR_SIZE_FAIL_OVER=800 makes the script fail above that many lines,
# unless PR_SIZE_EXEMPT=true (the PR carries the "mechanical" label: a rename tool or formatter run).
fail_over="${PR_SIZE_FAIL_OVER:-}"
if [ -n "$fail_over" ] && [ "$changed_lines" -gt "$fail_over" ]; then
  if [ "${PR_SIZE_EXEMPT:-false}" = "true" ]; then
    echo "Exempt:        over $fail_over lines, allowed because the PR is labelled mechanical"
  else
    echo "Failed:        over $fail_over lines. Split the PR, or label it mechanical if it is only a rename or format run." >&2
    exit 1
  fi
fi
