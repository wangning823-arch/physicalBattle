#!/usr/bin/env bash
# 从任意位置调用也可：始终以本脚本所在目录为根
cd "$(cd "$(dirname "$0")" && pwd)" || exit 1

if command -v pkill >/dev/null 2>&1; then
  pkill -f "node server.js" 2>/dev/null || true
fi
if command -v lsof >/dev/null 2>&1; then
  lsof -ti :8888 | xargs -r kill -9 2>/dev/null || true
fi
sleep 0.5

nohup node server.js > server.log 2>&1 &
echo $! > server.pid
sleep 1

if command -v ss >/dev/null 2>&1 && ss -tuln 2>/dev/null | grep -q :8888; then
  echo "OK http://localhost:8888/  (3D default, ?render=2d for 2D)"
elif command -v netstat >/dev/null 2>&1 && netstat -tuln 2>/dev/null | grep -q :8888; then
  echo "OK http://localhost:8888/  (3D default, ?render=2d for 2D)"
else
  echo "WARN port 8888 not confirmed; check server.log"
  cat server.log 2>/dev/null || true
fi
