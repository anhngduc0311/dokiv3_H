#!/usr/bin/env bash
set -euo pipefail
umask 027

root=/opt/dokiv3h
state=/var/lib/dokiv3h-deploy
remote=git@github.com:anhngduc0311/dokiv3_H.git
repo="$state/repo.git"
export GIT_SSH_COMMAND="ssh -i $state/github_ed25519 -o IdentitiesOnly=yes -o BatchMode=yes -o ConnectTimeout=10 -o StrictHostKeyChecking=yes -o UserKnownHostsFile=$state/known_hosts"

exec 9>"$state/deploy.lock"
flock -n 9 || exit 0

if [[ ! -d "$repo" ]]; then
  git init --bare "$repo"
fi
git --git-dir="$repo" fetch --no-tags --depth=1 "$remote" refs/heads/main
commit=$(git --git-dir="$repo" rev-parse FETCH_HEAD)
if [[ -f "$state/deployed" && $(<"$state/deployed") == "$commit" ]]; then
  exit 0
fi

previous=$(readlink -f "$root/current")
release=$(mktemp -d "$root/releases/auto-${commit:0:12}.XXXXXX")
activated=false
complete=false

activate() {
  ln -sfnT "$1" "$root/current"
  systemctl restart dokiv3h
}

cleanup() {
  if "$complete"; then return; fi
  if "$activated"; then
    echo "Restoring $previous" >&2
    activate "$previous" || return
  fi
  rm -rf -- "$release"
}
trap cleanup EXIT

git --git-dir="$repo" archive "$commit" | tar -x -C "$release"
ln -s "$root/shared/.env.production" "$release/.env.production"
chown -R dokiv3h:dokiv3h "$release"

cd "$release"
runuser -u dokiv3h -- env npm_config_cache="$root/shared/npm-cache" npm ci --no-audit --no-fund
runuser -u dokiv3h -- npm run test:seo
runuser -u dokiv3h -- env NEXT_TELEMETRY_DISABLED=1 NODE_OPTIONS=--max-old-space-size=1536 npm run build

# A newer push may have arrived while this commit was building.
head=$(git ls-remote --exit-code "$remote" refs/heads/main)
if [[ "${head%%$'\t'*}" != "$commit" ]]; then
  echo "Skipping $commit because main advanced during build."
  exit 0
fi

activated=true
activate "$release"
for attempt in {1..20}; do
  if curl -fsS --max-time 5 http://127.0.0.1:3000/api/health |
    node -e 'let body=""; process.stdin.on("data", chunk => body+=chunk); process.stdin.on("end", () => { try { process.exitCode = JSON.parse(body).status === "healthy" ? 0 : 1; } catch { process.exitCode = 1; } });'; then
    printf '%s\n' "$commit" >"$state/deployed.next"
    mv -f "$state/deployed.next" "$state/deployed"
    complete=true
    echo "Deployed $commit"
    # Keep the previous release for rollback, plus any manual deployments.
    for old in "$root"/releases/auto-*; do
      if [[ -d "$old" && ! -L "$old" && "$old" != "$release" && "$old" != "$previous" ]]; then
        rm -rf -- "$old"
      fi
    done
    exit 0
  fi
  sleep 2
done
echo "Health check failed for $commit" >&2
exit 1
