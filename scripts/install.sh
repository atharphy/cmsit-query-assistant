#!/usr/bin/env bash
set -euo pipefail

PLUGIN_ID="atharphy-cmsitqueryassistant-app"
ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
GRAFANA_HOME="${1:-${GRAFANA_HOME:-}}"

if [[ -z "${GRAFANA_HOME}" ]]; then
  echo "Usage: $0 /path/to/grafana" >&2
  echo "Alternatively, set the GRAFANA_HOME environment variable." >&2
  exit 1
fi

if [[ ! -d "${GRAFANA_HOME}" ]]; then
  echo "ERROR: Grafana home does not exist: ${GRAFANA_HOME}" >&2
  exit 1
fi

if [[ ! -d "${GRAFANA_HOME}/data" ]]; then
  echo "ERROR: Grafana data directory does not exist:" >&2
  echo "  ${GRAFANA_HOME}/data" >&2
  exit 1
fi

if [[ ! -f "${ROOT_DIR}/dist/plugin.json" ]]; then
  echo "ERROR: dist/plugin.json is missing." >&2
  echo "Run ./scripts/build.sh before installation." >&2
  exit 1
fi

if [[ ! -f "${ROOT_DIR}/dist/module.js" ]]; then
  echo "ERROR: dist/module.js is missing." >&2
  echo "Run ./scripts/build.sh before installation." >&2
  exit 1
fi

BUILT_ID="$(
  awk -F'"' \
    '/^[[:space:]]*"id"[[:space:]]*:/ {print $4; exit}' \
    "${ROOT_DIR}/dist/plugin.json"
)"

if [[ -z "${BUILT_ID}" ]]; then
  echo "ERROR: Could not read the plugin ID from dist/plugin.json." >&2
  exit 1
fi

if [[ "${BUILT_ID}" != "${PLUGIN_ID}" ]]; then
  echo "ERROR: Unexpected plugin ID." >&2
  echo "Expected: ${PLUGIN_ID}" >&2
  echo "Found:    ${BUILT_ID}" >&2
  exit 1
fi

PLUGIN_ROOT="${GRAFANA_HOME}/data/plugins"
TARGET="${PLUGIN_ROOT}/${PLUGIN_ID}"
BACKUP_ROOT="${GRAFANA_HOME}/data/plugin-backups"

mkdir -p "${PLUGIN_ROOT}"

if [[ -d "${TARGET}" ]]; then
  mkdir -p "${BACKUP_ROOT}"
  BACKUP="${BACKUP_ROOT}/${PLUGIN_ID}.$(date +%Y%m%d-%H%M%S)"
  mv "${TARGET}" "${BACKUP}"
  echo "Previous plugin installation moved to:"
  echo "  ${BACKUP}"
fi

mkdir -p "${TARGET}"
cp -a "${ROOT_DIR}/dist/." "${TARGET}/"
find "${TARGET}" -name '._*' -type f -delete

SOURCE_HASH="$(
  sha256sum "${ROOT_DIR}/dist/module.js" |
  awk '{print $1}'
)"

TARGET_HASH="$(
  sha256sum "${TARGET}/module.js" |
  awk '{print $1}'
)"

if [[ "${SOURCE_HASH}" != "${TARGET_HASH}" ]]; then
  echo "ERROR: Installed module checksum does not match the build." >&2
  exit 1
fi

INSTALLED_ID="$(
  awk -F'"' \
    '/^[[:space:]]*"id"[[:space:]]*:/ {print $4; exit}' \
    "${TARGET}/plugin.json"
)"

if [[ "${INSTALLED_ID}" != "${PLUGIN_ID}" ]]; then
  echo "ERROR: Installed plugin metadata is invalid." >&2
  exit 1
fi

echo
echo "Plugin installed successfully:"
echo "  ${TARGET}"
echo
echo "SHA-256:"
echo "  ${TARGET_HASH}"
echo
echo "Ensure this configuration exists in:"
echo "  ${GRAFANA_HOME}/conf/custom.ini"
echo
echo "[plugins]"
echo "allow_loading_unsigned_plugins = ${PLUGIN_ID}"
echo
echo "Restart only the Grafana instance using:"
echo "  ${GRAFANA_HOME}"
