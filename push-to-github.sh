#!/usr/bin/env bash
#
# Push the `sliders` branch to a GitHub repository.
#
# This machine has no GitHub credentials and no `gh` CLI, so publishing is a
# manual step. Create an empty repo on GitHub, then run:
#
#   ./push-to-github.sh git@github.com:you/sliders-format.git
#
# The upstream Chapbook remote is left alone, so `git fetch upstream` keeps
# working for pulling in Chapbook changes later.

set -euo pipefail

BRANCH=sliders

if [ $# -lt 1 ]; then
	echo "usage: $0 <repo-url>" >&2
	echo "  e.g. $0 git@github.com:you/sliders-format.git" >&2
	exit 1
fi

REPO_URL="$1"

cd "$(dirname "$0")"

if ! git rev-parse --verify "$BRANCH" >/dev/null 2>&1; then
	echo "error: branch '$BRANCH' does not exist in $(pwd)" >&2
	exit 1
fi

if git remote get-url origin >/dev/null 2>&1; then
	CURRENT="$(git remote get-url origin)"

	if [ "$CURRENT" != "$REPO_URL" ]; then
		echo "origin already set to $CURRENT; pointing it at $REPO_URL"
		git remote set-url origin "$REPO_URL"
	fi
else
	echo "adding origin -> $REPO_URL"
	git remote add origin "$REPO_URL"
fi

echo "pushing $BRANCH to origin"
git push -u origin "$BRANCH"

echo
echo "Done. Remotes:"
git remote -v
