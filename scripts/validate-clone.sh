#!/usr/bin/env bash

set -Eeuo pipefail

PLUGIN_ID="atharphy-cmsitqueryassistant-app"

fail() {
    echo "ERROR: $*" >&2
    exit 1
}

pass() {
    echo "OK: $*"
}

command -v git >/dev/null || fail "git is not installed"
command -v node >/dev/null || fail "node is not available"
command -v npm >/dev/null || fail "npm is not available"
command -v tar >/dev/null || fail "tar is not available"

ROOT="$(git rev-parse --show-toplevel 2>/dev/null)" ||
    fail "Run this script inside the plugin Git repository"

cd "$ROOT"

echo "Repository: $ROOT"
echo "Branch:     $(git branch --show-current)"
echo "Commit:     $(git rev-parse --short HEAD)"
echo "Node:       $(node --version)"
echo "npm:        $(npm --version)"
echo

EXPECTED_NODE="$(tr -d '[:space:]' < .nvmrc)"
ACTUAL_NODE="$(node --version | sed 's/^v//')"

if [[ "$ACTUAL_NODE" != "$EXPECTED_NODE" ]]; then
    fail "Node.js ${EXPECTED_NODE} is required; found ${ACTUAL_NODE}"
fi
pass "Node.js version is supported"

REQUIRED_FILES=(
    package.json
    package-lock.json
    src/plugin.json
    src/module.tsx
    src/constants.ts
    src/components/App/App.tsx
    src/pages/Home/homePage.ts
    src/pages/Home/homeScene.ts
    src/pages/Home/CustomSceneObject.tsx
    docs/INSTALL.md
    docs/TROUBLESHOOTING.md
)

for file in "${REQUIRED_FILES[@]}"; do
    [[ -f "$file" ]] || fail "Required file is missing: $file"

    git ls-files --error-unmatch "$file" >/dev/null 2>&1 ||
        fail "Required file is not tracked by Git: $file"
done
pass "All required files exist and are tracked"

if git status --porcelain | grep -q .; then
    echo
    echo "The working tree contains uncommitted changes:"
    git status --short
    echo
    fail "Commit the changes before testing clone reproducibility"
fi
pass "Git working tree is clean"

if git ls-files | grep -Eq '(^|/)(node_modules|dist)/'; then
    echo "Tracked generated files:"
    git ls-files | grep -E '(^|/)(node_modules|dist)/'
    fail "node_modules or dist must not be committed"
fi
pass "node_modules and dist are not tracked"

if git grep -nE '^(<<<<<<<|>>>>>>>)' -- . ':!package-lock.json'; then
    fail "Unresolved merge-conflict markers were found"
fi
pass "No unresolved merge-conflict markers found"

if git grep -n 'gdev-testdata' -- src; then
    fail "The old generated TestData dependency is still present"
fi
pass "No gdev-testdata dependency remains in src"

node <<'NODE'
const fs = require('fs');

const packageJson = JSON.parse(fs.readFileSync('package.json', 'utf8'));
const pluginJson = JSON.parse(fs.readFileSync('src/plugin.json', 'utf8'));

const expectedId = 'atharphy-cmsitqueryassistant-app';

if (pluginJson.id !== expectedId) {
  throw new Error(`Unexpected plugin ID: ${pluginJson.id}`);
}

if (pluginJson.type !== 'app') {
  throw new Error(`Unexpected plugin type: ${pluginJson.type}`);
}

if (!packageJson.dependencies?.['@grafana/assistant']) {
  throw new Error('@grafana/assistant is missing from package.json');
}

if (!packageJson.dependencies?.['@grafana/scenes']) {
  throw new Error('@grafana/scenes is missing from package.json');
}

const assistantDependency = pluginJson.dependencies?.plugins?.some(
  (plugin) => plugin.id === 'grafana-assistant-app'
);

if (!assistantDependency) {
  throw new Error(
    'grafana-assistant-app is missing from src/plugin.json dependencies'
  );
}

const defaultPages = pluginJson.includes?.filter(
  (entry) => entry.type === 'page' && entry.defaultNav === true
);

if (defaultPages?.length !== 1) {
  throw new Error('Exactly one default application page is required');
}

console.log('OK: package.json and plugin.json metadata are valid');
NODE

TEMP_DIR="$(mktemp -d "${TMPDIR:-/tmp}/cmsit-plugin-clone.XXXXXX")"

cleanup() {
    rm -rf "$TEMP_DIR"
}

trap cleanup EXIT

echo
echo "Creating isolated copy from committed Git content..."

git archive --format=tar HEAD | tar -xf - -C "$TEMP_DIR"

cd "$TEMP_DIR"

[[ ! -d node_modules ]] ||
    fail "The isolated archive unexpectedly contains node_modules"

[[ ! -d dist ]] ||
    fail "The isolated archive unexpectedly contains dist"

pass "Isolated committed-source copy created"

echo
echo "Installing dependencies with npm ci..."
npm ci --no-audit --no-fund

echo
echo "Running TypeScript checks..."
npm run typecheck

echo
echo "Running lint..."
npm run lint

echo
echo "Running unit tests..."
npm run test:ci

echo
echo "Building production plugin..."
npm run build

[[ -f dist/module.js ]] ||
    fail "Production build did not create dist/module.js"

[[ -f dist/plugin.json ]] ||
    fail "Production build did not create dist/plugin.json"

node <<'NODE'
const fs = require('fs');

const packageJson = JSON.parse(fs.readFileSync('package.json', 'utf8'));
const pluginJson = JSON.parse(fs.readFileSync('dist/plugin.json', 'utf8'));

if (pluginJson.id !== 'atharphy-cmsitqueryassistant-app') {
  throw new Error(`Incorrect built plugin ID: ${pluginJson.id}`);
}

if (pluginJson.type !== 'app') {
  throw new Error(`Incorrect built plugin type: ${pluginJson.type}`);
}

if (pluginJson.info?.version !== packageJson.version) {
  throw new Error(
    `Built version ${pluginJson.info?.version} does not match package version ${packageJson.version}`
  );
}

console.log('OK: built plugin metadata is valid');
NODE

echo
echo "============================================================"
echo "Clone validation completed successfully"
echo "Plugin ID: $PLUGIN_ID"
echo "Source commit: $(git -C "$ROOT" rev-parse --short HEAD)"
echo "============================================================"
