#!/usr/bin/env bash
# Shadow Market Dev Starter (macOS/Linux/WSL)
set -u
cd "$(dirname "$0")"

echo "============================================="
echo " Shadow Market - Starting Dev Servers"
echo "============================================="

# 1) Postgres
echo "[1/4] Checking PostgreSQL..."
if pg_isready -q 2>/dev/null; then
  echo "       PostgreSQL already running."
else
  if command -v brew >/dev/null 2>&1 && brew services list 2>/dev/null | grep -q postgresql; then
    brew services start postgresql >/dev/null 2>&1 && echo "       PostgreSQL started via brew."
  elif command -v systemctl >/dev/null 2>&1; then
    sudo systemctl start postgresql >/dev/null 2>&1 && echo "       PostgreSQL started via systemd."
  else
    echo "[!] Could not start PostgreSQL automatically. Start it manually."
  fi
fi

# 2) Free port 8001
echo "[2/4] Freeing port 8001..."
if command -v lsof >/dev/null 2>&1; then
  lsof -ti:8001 | xargs -r kill -9 2>/dev/null || true
fi

# 3) Backend
echo "[3/4] Starting Backend (http://localhost:8001)..."
(cd backend && python -m uvicorn app.main:app --reload --port 8001) &
BACKEND_PID=$!
echo "       Backend PID: $BACKEND_PID"

# Wait up to 10s for backend
for i in 1 2 3 4 5; do
  sleep 2
  if curl -sf http://localhost:8001/health >/dev/null 2>&1; then
    echo "       Backend is up!"
    break
  fi
  [ "$i" = "5" ] && echo "[!] Backend did not respond in time — check terminal for errors."
done

# 4) Frontend
echo "[4/4] Starting Frontend (http://localhost:5173)..."
(cd frontend && npm run dev) &
FRONTEND_PID=$!
echo "       Frontend PID: $FRONTEND_PID"

echo ""
echo "============================================="
echo " Services started:"
echo "   PostgreSQL -> localhost:5432"
echo "   Backend    -> http://localhost:8001  (PID $BACKEND_PID)"
echo "   API Docs   -> http://localhost:8001/docs"
echo "   Frontend   -> http://localhost:5173  (PID $FRONTEND_PID)"
echo "============================================="
echo "Press Ctrl+C to stop, or run ./stop.sh from another terminal."
wait
