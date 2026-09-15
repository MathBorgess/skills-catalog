#!/usr/bin/env bash
set -euo pipefail

# Maintainer install: symlink every skill in this repo into the local skill
# directories used by Claude Code, Cursor, Codex, and other Agent Skills
# harnesses. Not a supported end-user installer — that is the plugin or
# `npx skills add`. A `git pull` is enough to refresh the linked copy.

REPO="$(cd "$(dirname "$0")/.." && pwd)"
DESTS=(
  "$HOME/.claude/skills"
  "$HOME/.agents/skills"
  "$HOME/.cursor/skills"
  "$HOME/.codex/skills"
)

realpath_portable() {
  python3 -c "import os, sys; print(os.path.realpath(sys.argv[1]))" "$1"
}

names=()
srcs=()
for skill_md in "$REPO"/skills/*/SKILL.md; do
  src="$(dirname "$skill_md")"
  names+=("$(basename "$src")")
  srcs+=("$src")
done

if [ "${#names[@]}" -eq 0 ]; then
  echo "error: no skills/*/SKILL.md under $REPO" >&2
  exit 1
fi

for DEST in "${DESTS[@]}"; do
  if [ -L "$DEST" ]; then
    resolved="$(realpath_portable "$DEST")"
    case "$resolved" in
      "$REPO"|"$REPO"/*)
        echo "error: $DEST is a symlink into this repo ($resolved)." >&2
        echo "Remove it (rm \"$DEST\") and re-run; the script will recreate it as a real dir." >&2
        exit 1
        ;;
    esac
  fi

  mkdir -p "$DEST"

  for i in "${!names[@]}"; do
    name="${names[$i]}"
    src="${srcs[$i]}"
    target="$DEST/$name"

    if [ -e "$target" ] && [ ! -L "$target" ]; then
      rm -rf "$target"
    fi

    ln -sfn "$src" "$target"
    echo "linked $name -> $src ($DEST)"
  done
done

# A README line asking someone to run `git config core.hooksPath .githooks` is
# guidance; setting it here is what makes the post-merge hook actually fire, and
# this script is the one command a maintainer cannot skip. Only claimed when
# nothing else has: a clone that points somewhere else keeps its own choice and
# is told, rather than overridden.
if [ -d "$REPO/.githooks" ] && git -C "$REPO" rev-parse --git-dir >/dev/null 2>&1; then
  current="$(git -C "$REPO" config --local --get core.hooksPath || true)"
  if [ -z "$current" ]; then
    git -C "$REPO" config core.hooksPath .githooks
    echo "enabled .githooks — a pull on main that adds or removes a skill now relinks automatically"
  elif [ "$current" != ".githooks" ]; then
    echo "note: core.hooksPath is '$current', so .githooks/post-merge will not run;" >&2
    echo "      re-run this script after a pull that adds or removes a skill." >&2
  fi
fi
