#!/bin/bash
set -e

echo "=== EpubAnything — Harness Init ==="

echo ""
echo "--- Backend tests ---"
cd backend
.venv/bin/python -m pytest -v
cd ..

echo ""
echo "--- TypeScript type check ---"
cd frontend
npx tsc --noEmit
cd ..

echo ""
echo "=== All checks passed ==="
echo ""
echo "Next steps:"
echo "1. Read feature_list.json — pick ONE not-started or in-progress feature"
echo "2. Implement only that feature"
echo "3. Re-run ./init.sh before claiming done"
