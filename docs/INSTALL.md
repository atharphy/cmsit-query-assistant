```markdown
# CMSIT Query Assistant Installation

## Overview

CMSIT Query Assistant is a Grafana Scenes app plugin that converts
natural-language monitoring requests into PromQL and displays results from the
CMSIT Prometheus data source.

The plugin uses:

- Grafana 13.1.0
- Grafana Scenes
- Grafana Assistant
- Prometheus
- Node.js 22
- npm

It does not require changes to Ph2_ACF, RealtimeMonitor, PrometheusExporter, or
Prometheus configuration.

## Installation Paths

The installation documented here uses:

```text
Grafana home:
  /home/bootcamp/grafana

Plugin source:
  /home/bootcamp/grafana-plugin-src/atharphy-cmsitqueryassistant-app

Installed plugin:
  /home/bootcamp/grafana/data/plugins/atharphy-cmsitqueryassistant-app

Plugin ID:
  atharphy-cmsitqueryassistant-app

Grafana URL:
  http://localhost:3300
```

## Prerequisites

Verify Grafana:

```bash
/home/bootcamp/grafana/bin/grafana server -v
```

The tested version is:

```text
Grafana 13.1.0
```

Verify that Grafana Assistant is installed:

```bash
ls /home/bootcamp/grafana/data/plugins/grafana-assistant-app
```

Grafana Assistant must also be enabled and connected to a Grafana Cloud
Assistant backend.

A Prometheus data source must be configured in Grafana.

## Install Node.js Locally

Node.js was installed under the `bootcamp` account without root access.

```bash
cd /home/bootcamp
mkdir -p /home/bootcamp/.local
cd /home/bootcamp/.local

curl -fLO \
  https://nodejs.org/dist/v22.23.1/node-v22.23.1-linux-x64.tar.xz

curl -fLO \
  https://nodejs.org/dist/v22.23.1/SHASUMS256.txt
```

Verify the archive:

```bash
grep ' node-v22.23.1-linux-x64.tar.xz$' SHASUMS256.txt \
  | sha256sum -c -
```

Extract it:

```bash
tar -xJf node-v22.23.1-linux-x64.tar.xz
```

Enable it:

```bash
export PATH="$HOME/.local/node-v22.23.1-linux-x64/bin:$PATH"
hash -r
```

Make the configuration persistent by adding this line to `~/.bashrc`:

```bash
export PATH="$HOME/.local/node-v22.23.1-linux-x64/bin:$PATH"
```

Verify:

```bash
node --version
npm --version
npx --version
```

Tested versions:

```text
Node.js: v22.23.1
npm:     10.9.8
npx:     10.9.8
```

## Create the Plugin Scaffold

```bash
mkdir -p /home/bootcamp/grafana-plugin-src
cd /home/bootcamp/grafana-plugin-src

npx @grafana/create-plugin@latest \
  --plugin-type=scenesapp \
  --plugin-name=cmsitqueryassistant \
  --org-name=atharphy \
  --no-backend
```

This creates:

```text
atharphy-cmsitqueryassistant-app
```

The plugin is frontend-only. No Go backend or Mage installation is required.

## Install Dependencies

```bash
cd /home/bootcamp/grafana-plugin-src/atharphy-cmsitqueryassistant-app

npm install
npm install @grafana/assistant
```

The tested Assistant SDK version is:

```text
@grafana/assistant@0.1.30
```

Verify it:

```bash
npm list @grafana/assistant
```

Do not run:

```bash
npm audit fix --force
```

That command may introduce breaking dependency changes.

## Build Verification

Run all verification commands from the plugin root:

```bash
npm run typecheck
npm run lint
npm run build
```

All commands must return exit status zero.

The production files are generated under:

```text
dist/
```

Important generated files include:

```text
dist/module.js
dist/plugin.json
```

## Configure Grafana for the Development Plugin

Create or update:

```text
/home/bootcamp/grafana/conf/custom.ini
```

Add:

```ini
[plugins]
allow_loading_unsigned_plugins = atharphy-cmsitqueryassistant-app
```

This permits only the CMSIT development plugin to run unsigned.

## Deploy the Plugin

```bash
cd /home/bootcamp/grafana-plugin-src/atharphy-cmsitqueryassistant-app

mkdir -p \
  /home/bootcamp/grafana/data/plugins/atharphy-cmsitqueryassistant-app

cp -a dist/. \
  /home/bootcamp/grafana/data/plugins/atharphy-cmsitqueryassistant-app/
```

Verify the deployment:

```bash
sha256sum dist/module.js

sha256sum \
  /home/bootcamp/grafana/data/plugins/atharphy-cmsitqueryassistant-app/module.js
```

The two checksums must match.

## Start Grafana

Only one `bootcamp` Grafana process may use the data directory.

Check for an existing process:

```bash
pgrep -u bootcamp -af \
  'grafana server.*homepath=/home/bootcamp/grafana'
```

Start Grafana:

```bash
cd /home/bootcamp/grafana

./bin/grafana server \
  --homepath=/home/bootcamp/grafana \
  cfg:server.http_port=3300
```

Verify its health from another terminal:

```bash
curl http://localhost:3300/api/health
```

Expected result:

```json
{
  "database": "ok",
  "version": "13.1.0"
}
```

## Enable and Open the App

In Grafana:

1. Open **Administration > Plugins and data > Plugins**.
2. Find **CMSIT Query Assistant**.
3. Enable the app.

Open:

```text
http://localhost:3300/a/atharphy-cmsitqueryassistant-app/home
```

## Updating the Plugin

After changing source files:

```bash
cd /home/bootcamp/grafana-plugin-src/atharphy-cmsitqueryassistant-app

npm run typecheck
npm run lint
npm run build
```

For a release-style update, increment the version:

```bash
npm version patch --no-git-tag-version
npm run build
```

Deploy again:

```bash
cp -a dist/. \
  /home/bootcamp/grafana/data/plugins/atharphy-cmsitqueryassistant-app/
```

Restart Grafana when `plugin.json` changes. For frontend-only changes, a browser
hard refresh may also be required.
```
