#!/usr/bin/env bash
set -Eeuo pipefail

EXPECTED_SHA="${1:-}"
OLD_ROOT="/opt/jarvis/gateway-v3"
RELEASE_BASE="/opt/jarvis/releases/gateway-v3"
SERVICE="jarvis-gateway-v3.service"
HEALTH_URL="http://127.0.0.1:8793/health"
DROPIN_DIR="/etc/systemd/system/${SERVICE}.d"
DROPIN_FILE="${DROPIN_DIR}/90-bluegreen-release.conf"

[[ "$EXPECTED_SHA" =~ ^[a-f0-9]{40}$ ]] || { echo "invalid_expected_sha" >&2; exit 2; }
[[ "$(id -u)" -eq 0 ]] || { echo "root_required" >&2; exit 3; }
test -d "$OLD_ROOT/.git"

cd "$OLD_ROOT"
BEFORE_HEAD="$(git rev-parse HEAD)"
BRANCH="$(git branch --show-current)"
ORIGIN_URL="$(git remote get-url origin)"
STATUS_BEFORE="$(git status --porcelain)"

test "$BRANCH" = "main" || { echo "unexpected_branch=$BRANCH" >&2; exit 4; }
HOME=/opt/jarvis XDG_CONFIG_HOME=/opt/jarvis/.config GIT_TERMINAL_PROMPT=0 git fetch --no-tags origin main
REMOTE_HEAD="$(git rev-parse origin/main)"
test "$REMOTE_HEAD" = "$EXPECTED_SHA" || { echo "origin_main_mismatch expected=$EXPECTED_SHA actual=$REMOTE_HEAD" >&2; exit 5; }

CURRENT_WORKDIR="$(systemctl show "$SERVICE" -p WorkingDirectory --value)"
EXECSTART_PROPERTY="$(systemctl show "$SERVICE" -p ExecStart --value)"
test "$CURRENT_WORKDIR" = "$OLD_ROOT" || { echo "unsupported_working_directory=$CURRENT_WORKDIR" >&2; exit 6; }
EXPECTED_EXECSTART="/usr/bin/node $OLD_ROOT/src/server.mjs"
if [[ "$EXECSTART_PROPERTY" != *"argv[]=$EXPECTED_EXECSTART ;"* ]]; then
  printf 'EXECSTART_PROPERTY=%s\n' "$EXECSTART_PROPERTY"
  echo "unsupported_execstart_contract" >&2
  exit 7
fi

TS="$(date +%Y%m%d-%H%M%S)"
BACKUP_DIR="/opt/jarvis/backups/gateway-v3/bluegreen-$TS"
RELEASE_ROOT="$RELEASE_BASE/$EXPECTED_SHA"
RELEASE_TMP="$RELEASE_BASE/.${EXPECTED_SHA}.tmp-$TS"
mkdir -p "$BACKUP_DIR" "$RELEASE_BASE" "$DROPIN_DIR"

printf '%s\n' "$BEFORE_HEAD" > "$BACKUP_DIR/before-head.txt"
printf '%s\n' "$CURRENT_WORKDIR" > "$BACKUP_DIR/before-working-directory.txt"
printf '%s\n' "$ORIGIN_URL" > "$BACKUP_DIR/origin-url.txt"
if test -f "$DROPIN_FILE"; then
  cp -a "$DROPIN_FILE" "$BACKUP_DIR/90-bluegreen-release.conf.before"
  printf '%s\n' present > "$BACKUP_DIR/dropin-state.txt"
else
  printf '%s\n' absent > "$BACKUP_DIR/dropin-state.txt"
fi

rollback() {
  local rc=$?
  set +e
  echo "BLUEGREEN_ROLLBACK rc=$rc backup=$BACKUP_DIR" >&2
  if test "$(cat "$BACKUP_DIR/dropin-state.txt" 2>/dev/null)" = present; then
    cp -a "$BACKUP_DIR/90-bluegreen-release.conf.before" "$DROPIN_FILE"
  else
    rm -f "$DROPIN_FILE"
  fi
  systemctl daemon-reload
  systemctl restart "$SERVICE"
  for _ in $(seq 1 30); do
    curl -fsS --max-time 5 "$HEALTH_URL" >/dev/null 2>&1 && break
    sleep 2
  done
  rm -rf "$RELEASE_TMP"
  exit "$rc"
}
trap rollback ERR

if test -e "$RELEASE_ROOT"; then
  test -d "$RELEASE_ROOT/.git"
  test "$(git -C "$RELEASE_ROOT" rev-parse HEAD)" = "$EXPECTED_SHA"
  test -z "$(git -C "$RELEASE_ROOT" status --porcelain)"
else
  rm -rf "$RELEASE_TMP"
  git clone --no-local --no-checkout "$OLD_ROOT" "$RELEASE_TMP"
  git -C "$RELEASE_TMP" remote set-url origin "$ORIGIN_URL"
  git -C "$RELEASE_TMP" checkout --detach "$EXPECTED_SHA"
  test "$(git -C "$RELEASE_TMP" rev-parse HEAD)" = "$EXPECTED_SHA"
  test -z "$(git -C "$RELEASE_TMP" status --porcelain)"
  mv "$RELEASE_TMP" "$RELEASE_ROOT"
fi

OLD_OWNER="$(stat -c '%u:%g' "$OLD_ROOT")"
chown -R "$OLD_OWNER" "$RELEASE_ROOT"

for dir in state backups logs tmp temp .cache tasks voice inbox outbox; do
  mkdir -p "$OLD_ROOT/$dir"
  rm -rf "$RELEASE_ROOT/$dir"
  ln -s "$OLD_ROOT/$dir" "$RELEASE_ROOT/$dir"
done

mkdir -p "$RELEASE_ROOT/memory"
if test -d "$OLD_ROOT/memory"; then
  while IFS= read -r -d '' source; do
    rel="${source#"$OLD_ROOT/"}"
    if git -C "$OLD_ROOT" ls-files --error-unmatch "$rel" >/dev/null 2>&1; then
      continue
    fi
    target="$RELEASE_ROOT/$rel"
    if ! test -e "$target" && ! test -L "$target"; then
      ln -s "$source" "$target"
    fi
  done < <(find "$OLD_ROOT/memory" -mindepth 1 -maxdepth 1 -print0)
fi

while IFS= read -r -d '' env_file; do
  name="$(basename "$env_file")"
  target="$RELEASE_ROOT/$name"
  if ! test -e "$target" && ! test -L "$target"; then
    ln -s "$env_file" "$target"
  fi
done < <(find "$OLD_ROOT" -maxdepth 1 -type f -name '.env*' -print0)

if test -d "$OLD_ROOT/node_modules"; then
  if git -C "$OLD_ROOT" diff --quiet "$BEFORE_HEAD" "$EXPECTED_SHA" -- package.json package-lock.json npm-shrinkwrap.json; then
    rm -rf "$RELEASE_ROOT/node_modules"
    ln -s "$OLD_ROOT/node_modules" "$RELEASE_ROOT/node_modules"
  elif test -f "$RELEASE_ROOT/package-lock.json"; then
    (cd "$RELEASE_ROOT" && npm ci --ignore-scripts)
  else
    (cd "$RELEASE_ROOT" && npm install --ignore-scripts)
  fi
fi

cd "$RELEASE_ROOT"
test -z "$(git status --porcelain)"
HOME=/opt/jarvis XDG_CONFIG_HOME=/opt/jarvis/.config npm run check:deploy

cat > "$DROPIN_FILE.tmp" <<EOF
[Service]
WorkingDirectory=$RELEASE_ROOT
ExecStart=
ExecStart=/usr/bin/node $RELEASE_ROOT/src/server.mjs
EOF
mv "$DROPIN_FILE.tmp" "$DROPIN_FILE"
systemctl daemon-reload
systemctl restart "$SERVICE"

HEALTH_OK=0
for _ in $(seq 1 40); do
  if curl -fsS --max-time 5 "$HEALTH_URL" > "$BACKUP_DIR/health-after.json"; then
    HEALTH_OK=1
    break
  fi
  sleep 2
done
test "$HEALTH_OK" = 1
node -e 'const fs=require("fs"); const p=JSON.parse(fs.readFileSync(process.argv[1],"utf8")); if(p.ok!==true || p.name!=="JARVIS Gateway v3") process.exit(1)' "$BACKUP_DIR/health-after.json"

test "$(systemctl is-active "$SERVICE")" = active
test "$(systemctl show "$SERVICE" -p WorkingDirectory --value)" = "$RELEASE_ROOT"
LIVE_EXECSTART="$(systemctl show "$SERVICE" -p ExecStart --value)"
[[ "$LIVE_EXECSTART" == *"argv[]=/usr/bin/node $RELEASE_ROOT/src/server.mjs ;"* ]]
HOME=/opt/jarvis XDG_CONFIG_HOME=/opt/jarvis/.config npm run check:live

HOME=/opt/jarvis XDG_CONFIG_HOME=/opt/jarvis/.config node -e "import('./src/jarvis-index.mjs').then(async m=>{const r=await m.rebuildJarvisIndex({root:process.cwd(),stateDir:process.env.JARVIS_V3_STATE||'$OLD_ROOT/state'}); console.log(JSON.stringify({ok:true,documents:r.summary.documents,vector_layer:r.summary.vector_layer}))})"

KNOWN_GOOD_TMP="$BACKUP_DIR/known-good"
mkdir -p "$KNOWN_GOOD_TMP"
rsync -a --delete \
  --exclude '.git' \
  --exclude 'node_modules' \
  --exclude 'state' \
  --exclude 'logs' \
  --exclude 'backups' \
  --exclude 'tmp' \
  "$RELEASE_ROOT"/ "$KNOWN_GOOD_TMP"/
mkdir -p "$OLD_ROOT/state/known-good"
rm -rf "$OLD_ROOT/state/known-good/current"
cp -a "$KNOWN_GOOD_TMP" "$OLD_ROOT/state/known-good/current"

REGRESSION_UNIT="jarvis-regression-${EXPECTED_SHA:0:12}-$TS"
systemd-run --unit="$REGRESSION_UNIT" --collect \
  --property="WorkingDirectory=$RELEASE_ROOT" \
  --property="RuntimeMaxSec=3600" \
  --property="TimeoutStopSec=30" \
  --property="KillMode=mixed" \
  --description="JARVIS post-deploy blue-green regression ${EXPECTED_SHA:0:12}" \
  /usr/bin/env HOME=/opt/jarvis XDG_CONFIG_HOME=/opt/jarvis/.config \
  /bin/bash -lc "npm run check && npm run acceptance" >/dev/null

trap - ERR
printf 'JARVIS_V3_BLUEGREEN_OK exact_head=%s previous_head=%s dirty_checkout_preserved=%s release_root=%s service=active health=ok full_regression_unit=%s backup=%s\n' \
  "$EXPECTED_SHA" "$BEFORE_HEAD" "$([ -n "$STATUS_BEFORE" ] && echo true || echo false)" "$RELEASE_ROOT" "$REGRESSION_UNIT" "$BACKUP_DIR"
