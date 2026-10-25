# TV Hub service manager — runs inside Termux, invoked as: bash svc.sh <command> ...
# Keeps one PID file and one log per service under $TVHUB_HOME (default ~/.tvhub).
# Output is machine-read: one "name|state|pid|uptime" line per service, or "ok|..."/"err|...".
set -u
BASE="${TVHUB_HOME:-$HOME/.tvhub}"
RUN="$BASE/run"; LOGS="$BASE/logs"
mkdir -p "$RUN" "$LOGS"

valid() { [[ "$1" =~ ^[A-Za-z0-9_-]{1,40}$ ]] || { echo "err|$1|invalid name"; exit 2; }; }
pid_of() { cat "${RUN:?}/${1:?}.pid" 2>/dev/null; }
# A zombie (exited, not yet reaped) still answers kill -0: read its state from /proc instead.
alive() {
  local p state
  p=$(pid_of "$1"); [ -n "$p" ] && kill -0 "$p" 2>/dev/null || return 1
  state=$(awk '{print $3}' "/proc/$p/stat" 2>/dev/null)
  [ "$state" != "Z" ] && [ "$state" != "X" ]
}

# Children first, then the parent, found through /proc (no pkill in a bare Termux).
kill_tree() {
  local parent=$1 sig=$2 p ppid
  for p in /proc/[0-9]*; do
    ppid=$(awk '{print $4}' "$p/stat" 2>/dev/null) || continue
    [ "$ppid" = "$parent" ] && kill_tree "${p#/proc/}" "$sig"
  done
  kill "-$sig" "$parent" 2>/dev/null
}

forget() { rm -f -- "${RUN:?}/${1:?}.pid" "${RUN:?}/${1:?}.start"; }

status_line() {
  local n=$1 p now start
  if alive "$n"; then
    p=$(pid_of "$n"); now=$(date +%s); start=$(cat "${RUN:?}/$n.start" 2>/dev/null || echo "$now")
    echo "$n|running|$p|$((now - start))"
  elif [ -f "$RUN/$n.pid" ]; then
    echo "$n|crashed||"
  else
    echo "$n|stopped||"
  fi
}

cmd="${1:-}"; shift || true
case "$cmd" in
  start)
    name=$1; dir=$2; shift 2; command="$*"; valid "$name"
    if alive "$name"; then echo "ok|$name|already running"; exit 0; fi
    cd "$dir" 2>/dev/null || { echo "err|$name|no such folder: $dir"; exit 2; }
    echo "--- start $(date '+%F %T'): $command" >> "$LOGS/$name.log"
    nohup bash -c "$command" >> "$LOGS/$name.log" 2>&1 < /dev/null &
    echo $! > "$RUN/$name.pid"; date +%s > "$RUN/$name.start"
    sleep 0.3
    if alive "$name"; then echo "ok|$name|$(pid_of "$name")"; else echo "err|$name|exited at once, see logs"; fi
    ;;
  stop)
    name=$1; valid "$name"
    if alive "$name"; then
      p=$(pid_of "$name"); kill_tree "$p" TERM
      for _ in 1 2 3 4 5 6 7 8 9 10; do kill -0 "$p" 2>/dev/null || break; sleep 0.5; done
      kill -0 "$p" 2>/dev/null && kill_tree "$p" KILL
      echo "--- stop $(date '+%F %T')" >> "$LOGS/$name.log"
    fi
    forget "$name"; echo "ok|$name|stopped"
    ;;
  status)
    if [ $# -gt 0 ]; then for n in "$@"; do valid "$n"; status_line "$n"; done
    else for f in "$RUN"/*.pid; do [ -e "$f" ] || continue; n=$(basename "$f" .pid); status_line "$n"; done; fi
    ;;
  logs)
    name=$1; lines=${2:-200}; valid "$name"
    tail -n "$lines" "$LOGS/$name.log" 2>/dev/null || true
    ;;
  *) echo "err|-|usage: start|stop|status|logs"; exit 2 ;;
esac
