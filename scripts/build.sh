#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
EXPECTED_NODE="$(tr -d '[:space:]' < "${ROOT_DIR}/.nvmrc")"

command -v node >/dev/null 2>&1 || {
  echo "ERROR: Node.js is not available." >&2
  exit 1
}

command -v npm >/dev/null 2>&1 || {
  echo "ERROR: npm is not available." >&2
  exit 1
}

ACTUAL_NODE="$(node --version | sed 's/^v//')"

if [[ "${ACTUAL_NODE}" != "${EXPECTED_NODE}" ]]; then
  echo "ERROR: Node.js ${EXPECTED_NODE} is required; found ${ACTUAL_NODE}." >&2
  exit 1
fi

cd "${ROOT_DIR}"

echo "Installing locked dependencies..."
npm ci

echo "Running TypeScript checks..."
npm run typecheck

echo "Running ESLint..."
npm run lint

echo "Running unit tests..."
npm run test:ci

echo "Building production plugin..."
npm run build

if [[ ! -f "${ROOT_DIR}/dist/plugin.json" ]]; then
  echo "ERROR: Build completed without creating dist/plugin.json." >&2
  exit 1
fi

if [[ ! -f "${ROOT_DIR}/dist/module.js" ]]; then
  echo "ERROR: Build completed without creating dist/module.js." >&2
  exit 1
fi

echo
echo "Build completed successfully."
echo "Output directory: ${ROOT_DIR}/dist"
