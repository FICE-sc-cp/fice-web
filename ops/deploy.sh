#!/usr/bin/env bash
# Auto-deploy and boot check for fice-sc.kpi.ua (run by cron on the server).
# A new commit on main: DB backup, git pull, rebuild, health check, Telegram report.
#   bash ops/deploy.sh           deploy if main has a commit that wasn't tried yet (every 2 minutes)
#   bash ops/deploy.sh --force   deploy even if this commit was already tried
#   bash ops/deploy.sh --boot    after a reboot: start whatever isn't running, report (@reboot)
set -uo pipefail

APP_DIR=/home/ubuntu/fice-web
STATE_DIR=/home/ubuntu/.fice-deploy
LOG_DIR=/home/ubuntu/deploy-logs

run() {
  echo "+ $*" >> "$LOG"
  "$@" >> "$LOG" 2>&1
}

notify() {
  local token chats chat sent=1
  token=$(grep -m1 '^TELEGRAM_BOT_TOKEN=' "$APP_DIR/.env" | cut -d= -f2-)
  chats=$(grep -m1 '^DEPLOY_NOTIFY_CHAT_ID=' "$APP_DIR/.env" | cut -d= -f2-)
  if [ -z "$token" ] || [ -z "$chats" ]; then return 0; fi
  for chat in ${chats//,/ }; do
    curl -fsS --max-time 15 -o /dev/null "https://api.telegram.org/bot$token/sendMessage" \
      --data-urlencode "chat_id=$chat" --data-urlencode "text=$1" && sent=0
  done
  return $sent
}

fail() {
  echo "$(date '+%F %T') FAILED: $1" | tee -a "$LOG"
  notify "❌ Деплой $short не вдався: $1. Лог: $LOG"
  exit 1
}

healthy() {
  [ "$(docker inspect -f '{{.State.Health.Status}}' "$1" 2>/dev/null)" = healthy ]
}

wait_ready() {
  for _ in $(seq 60); do
    if healthy fice-server \
      && curl -fs -o /dev/null --max-time 5 http://127.0.0.1:3002/ \
      && curl -fs -o /dev/null --max-time 5 http://127.0.0.1:3000/admin \
      && curl -fs --max-time 5 http://127.0.0.1:3001/department | grep -q '"id"'; then
      return 0
    fi
    sleep 3
  done
  return 1
}

boot_check() {
  sleep 60
  exec 9> "$STATE_DIR/lock"
  flock 9
  cd "$APP_DIR" || exit 1
  LOG="$LOG_DIR/$(date +%F-%H%M%S)-boot.log"
  local booted
  booted=$(uptime -s)
  for _ in 1 2 3; do
    run docker compose up -d && break
    sleep 30
  done
  local msg="🔌 Сервер перезавантажився ($booted). Сайт працює ✅"
  wait_ready || msg="🔌❌ Сервер перезавантажився ($booted), але сайт або база не відповідають. Лог: $LOG"
  for _ in $(seq 15); do
    notify "$msg" && break
    sleep 60
  done
}

main() {
  mkdir -p "$STATE_DIR" "$LOG_DIR"
  if [ "${1:-}" = "--boot" ]; then boot_check; exit; fi
  exec 9> "$STATE_DIR/lock"
  flock -n 9 || exit 0

  cd "$APP_DIR" || exit 1
  local remote last
  remote=$(git ls-remote origin refs/heads/main 2> /dev/null | cut -f1)
  [ -n "$remote" ] || exit 0
  last=$(cat "$STATE_DIR/last" 2> /dev/null)
  if [ "$remote" = "$last" ] && [ "${1:-}" != "--force" ]; then exit 0; fi
  healthy fice-postgres || exit 0

  echo "$remote" > "$STATE_DIR/last"
  short=${remote:0:7}
  LOG="$LOG_DIR/$(date +%F-%H%M%S)-$short.log"
  echo "$(date '+%F %T') deploying $short, log: $LOG"

  run bash ops/backup.sh db pre-deploy || fail "не вдався бекап бази. Сайт не змінювався"
  run git pull --ff-only origin main   || fail "не вдався git pull. Сайт не змінювався"
  run docker compose up -d --build     || fail "не вдалася збірка або запуск. Сайт працює на попередній версії"
  run docker image prune -f
  wait_ready                           || fail "сайт або база не відповідають вже 3 хвилини після оновлення. Перевір терміново"

  echo "$(date '+%F %T') done $short" | tee -a "$LOG"
  notify "✅ Сайт оновлено: $(git log -1 --format='%h %s (%an)')"
  find "$LOG_DIR" -name '*.log' -mtime +30 -delete
}

main "$@"; exit
