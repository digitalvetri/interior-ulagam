#!/usr/bin/env bash
# Shadow Market Dev Stopper (macOS/Linux/WSL)
set -u

echo "Stopping Shadow Market dev servers..."

# Backend: uvicorn processes
pkill -f "uvicorn app.main:app" 2>/dev/null && echo "  Backend (uvicorn) stopped." || echo "  No uvicorn process found."

# Frontend: vite processes
pkill -f "vite" 2>/dev/null && echo "  Frontend (vite) stopped." || echo "  No vite process found."

# Optional: stop Postgres
read -r -p "Stop PostgreSQL too? (y/N): " STOP_PG
if [[ "${STOP_PG:-N}" =~ ^[Yy]$ ]]; then
  if command -v brew >/dev/null 2>&1 && brew services list 2>/dev/null | grep -q postgresql; then
    brew services stop postgresql >/dev/null 2>&1 && echo "  PostgreSQL stopped (brew)."
  elif command -v systemctl >/dev/null 2>&1; then
    sudo systemctl stop postgresql >/dev/null 2>&1 && echo "  PostgreSQL stopped (systemd)."
  else
    echo "  Could not stop PostgreSQL automatically."
  fi
else
  echo "  PostgreSQL left running."
fi

echo "Done."
