# CMSIT Query Assistant Installation

## Tested Stack

```text
Grafana:             13.1.0
Node.js:             22.23.1
npm:                 10.9.8
Grafana Assistant:   installed and enabled
Business Charts:     7.2.5
Plugin ID:           atharphy-cmsitqueryassistant-app
Plugin version:      1.1.0
```

The app is frontend-only. It does not require a Go backend or changes to
Ph2_ACF.

## 1. Verify Grafana Dependencies

For the standalone installation used during development:

```bash
GRAFANA_HOME=/home/bootcamp/grafana

"${GRAFANA_HOME}/bin/grafana" server -v

test -d "${GRAFANA_HOME}/data/plugins/grafana-assistant-app" \
  && echo "Grafana Assistant present"

test -d "${GRAFANA_HOME}/data/plugins/volkovlabs-echarts-panel" \
  && echo "Business Charts present"
```

Grafana Assistant must also be enabled and connected to its configured Grafana
Cloud backend. A working Prometheus data source must be available in Grafana.

## 2. Install Node.js Without Root Access

Skip this section when `node --version` already returns `v22.23.1`.

```bash
mkdir -p "$HOME/.local"
cd "$HOME/.local"

curl -fLO \
  https://nodejs.org/dist/v22.23.1/node-v22.23.1-linux-x64.tar.xz
curl -fLO \
  https://nodejs.org/dist/v22.23.1/SHASUMS256.txt

grep ' node-v22.23.1-linux-x64.tar.xz$' SHASUMS256.txt \
  | sha256sum -c -

tar -xJf node-v22.23.1-linux-x64.tar.xz

export PATH="$HOME/.local/node-v22.23.1-linux-x64/bin:$PATH"
hash -r
```

Add this line to `~/.bashrc`:

```bash
export PATH="$HOME/.local/node-v22.23.1-linux-x64/bin:$PATH"
```

Verify:

```bash
node --version
npm --version
```

Do not accept the operating system's interactive `nodejs` installation prompt
when you do not have administrator privileges.

## 3. Clone and Build

```bash
mkdir -p /home/bootcamp/grafana-plugin-src
cd /home/bootcamp/grafana-plugin-src

git clone \
  https://github.com/atharphy/cmsit-query-assistant.git \
  atharphy-cmsitqueryassistant-app

cd atharphy-cmsitqueryassistant-app

./scripts/build.sh
```

The build script performs:

1. `npm ci`
2. TypeScript checking
3. ESLint checking
4. Unit tests
5. Production build

All steps must complete successfully. A webpack asset-size warning is
non-fatal.

For a release or a new machine, also run:

```bash
./scripts/validate-clone.sh
```

This verifies that a clean archive of committed files builds without relying
on local untracked files.

## 4. Configure Prometheus

The app discovers a Grafana Prometheus data source. The supplied provisioning
example uses:

```text
Name: CMSIT Prometheus
UID:  cmsit-prometheus
```

Set the server URL:

```bash
export CMSIT_PROMETHEUS_URL=http://localhost:9090
```

Install `deployment/cmsit-prometheus.yaml.example` in the provisioning
directory used by the target Grafana instance, or configure the data source
through the Grafana UI.

Verify these queries in Grafana Explore:

```promql
cmsit_monitor_value
```

```promql
cmsit_monitor_value{register="VINA"}
```

## 5. Allow the Unsigned Plugin

Add this to `/home/bootcamp/grafana/conf/custom.ini`:

```ini
[plugins]
allow_loading_unsigned_plugins = atharphy-cmsitqueryassistant-app
```

The example is also available at `deployment/custom.ini.example`.

## 6. Install the Build

```bash
cd /home/bootcamp/grafana-plugin-src/atharphy-cmsitqueryassistant-app

./scripts/install.sh /home/bootcamp/grafana
```

The installer:

- Validates the built plugin ID
- Backs up an existing installation
- Copies the complete `dist/` directory
- Removes macOS `._*` AppleDouble files
- Verifies the installed `module.js` checksum

Deploy the complete build, not only `module.js`. Webpack chunks change between
builds and an incomplete copy causes `ChunkLoadError`.

## 7. Restart Grafana

Check that no second standalone Grafana process is using the same data
directory:

```bash
pgrep -u bootcamp -af \
  'grafana server.*homepath=/home/bootcamp/grafana'
```

Start the intended instance:

```bash
cd /home/bootcamp/grafana

./bin/grafana server \
  --homepath=/home/bootcamp/grafana \
  cfg:server.http_port=3300
```

Verify:

```bash
curl http://localhost:3300/api/health

curl -s \
  http://localhost:3300/public/plugins/atharphy-cmsitqueryassistant-app/plugin.json
```

The served plugin metadata must report version `1.1.0`.

## 8. Open and Test

Enable **CMSIT Query Assistant** under Grafana's plugin administration page,
then open:

```text
http://localhost:3300/a/atharphy-cmsitqueryassistant-app/home
```

Test a normal panel:

```text
Plot the hourly average of VINA for each chip over the last seven days.
```

Test a detector map:

```text
Show a complete TBPX Layer 3 detector map of modules whose INTERNAL_NTC_REL
remained above 20 C during the last two days.
```

Review the generated PromQL, unit, visualization, and detector-map selections
before adding the panel.

## Updating

```bash
cd /home/bootcamp/grafana-plugin-src/atharphy-cmsitqueryassistant-app

git pull --ff-only
./scripts/build.sh
./scripts/install.sh /home/bootcamp/grafana
```

Restart Grafana and perform an empty-cache hard reload. See
`docs/TROUBLESHOOTING.md` if an old chunk remains cached.

## Updating Detector Geometry

The detector map is already embedded in the repository. Regeneration is needed
only after the parts-dashboard map changes:

```bash
npm run sync:detector-map -- \
  /path/to/cmsit_internal_ntc_rel_parts_dashboard.json

./scripts/build.sh
```

Commit the regenerated
`src/pages/Home/detectorMap/detectorMapTemplate.json`.
