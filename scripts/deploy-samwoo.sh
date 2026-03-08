#!/bin/bash

set -e

echo "=================================="
echo "Samwoo image deploy start"
echo "=================================="

echo ""
echo "[1/5] DNG -> JPG"
npm run dng:samwoo

echo ""
echo "[2/5] JPG -> WEBP"
npm run img:samwoo

echo ""
echo "[3/5] Git add"
git add .

echo ""
echo "[4/5] Git commit"
if git diff --cached --quiet; then
  echo "No changes to commit."
else
  git commit -m "update samwoo images"
fi

echo ""
echo "[5/5] Git push"
git push origin main

echo ""
echo "=================================="
echo "Samwoo image deploy done"
echo "=================================="