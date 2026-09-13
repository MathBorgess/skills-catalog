#!/usr/bin/env bash
set -euo pipefail

REPO="$(cd "$(dirname "$0")/.." && pwd)"

cd "$REPO"
for skill_md in skills/*/SKILL.md; do
  printf '%s\n' "$skill_md"
done | sort
