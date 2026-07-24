# CMSIT Query Assistant

CMSIT Query Assistant is a Grafana app plugin that converts natural-language
CMS Inner Tracker monitoring requests into PromQL and visualization panels.
Each generated specification remains editable before it is added to the page.

## Features

- PromQL generation through Grafana Assistant
- Multiple independently removable and resizable panels
- Time series, detector map, stat, gauge, bar gauge, table, histogram, bar
  chart, and pie chart visualizations
- CMSIT physical and virtual register support
- Editable titles, PromQL, units, visualization type, and detector-map scope
- Complete and quadrant detector maps for TBPX, TFPX, and TEPX geometry
- Shared Grafana time range and refresh controls
- Unit handling for physical and derived quantities

## Data Flow

```text
RD53 monitoring
       |
       v
PrometheusExporter
       |
       v
cmsit_monitor_* metrics
       |
       v
Prometheus
       |
       v
Grafana Assistant -> panel specification
       |
       +--> standard Grafana panel
       |
       `--> Business Charts detector map
```

The app reads Prometheus only. It does not modify Ph2_ACF, RealtimeMonitor, the
exporter, or the Prometheus configuration.

## Requirements

- Grafana 12.3.0 or newer; tested with Grafana 13.1.0
- Grafana Assistant installed, enabled, and connected
- Business Charts (`volkovlabs-echarts-panel`) installed; tested with 7.2.5
- A working Prometheus data source containing `cmsit_monitor_*` metrics
- Permission to load this unsigned development plugin
- Node.js 22.23.1 and npm for source builds

The exact Node.js version is recorded in `.nvmrc`. Grafana Assistant and
Business Charts are runtime dependencies and are not bundled in this
repository.

## Build

```bash
git clone https://github.com/atharphy/cmsit-query-assistant.git
cd cmsit-query-assistant

nvm install
nvm use

./scripts/build.sh
```

`build.sh` uses `npm ci`, then runs type checking, linting, unit tests, and the
production build. Output is written to `dist/`.

To independently verify that only committed files are required:

```bash
./scripts/validate-clone.sh
```

That command creates an isolated Git archive, installs dependencies from the
lockfile, runs all checks, and builds the plugin.

## Install

For the standalone CMSIT Grafana installation:

```bash
./scripts/install.sh /home/bootcamp/grafana
```

The installer backs up the previous installation, copies `dist/`, removes
macOS AppleDouble files, and verifies the installed `module.js` checksum.

Add this to `/home/bootcamp/grafana/conf/custom.ini`:

```ini
[plugins]
allow_loading_unsigned_plugins = atharphy-cmsitqueryassistant-app
```

Restart only the Grafana process using `/home/bootcamp/grafana`:

```bash
cd /home/bootcamp/grafana

./bin/grafana server \
  --homepath=/home/bootcamp/grafana \
  cfg:server.http_port=3300
```

Verify it:

```bash
curl http://localhost:3300/api/health

curl -s \
  http://localhost:3300/public/plugins/atharphy-cmsitqueryassistant-app/plugin.json
```

Open:

```text
http://localhost:3300/a/atharphy-cmsitqueryassistant-app/home
```

See [docs/INSTALL.md](docs/INSTALL.md) for the complete setup procedure.

## Prometheus Data

Expected metrics:

```text
cmsit_monitor_value
cmsit_monitor_error
cmsit_monitor_last_update_seconds
```

Typical labels:

```text
board
optical_group
hybrid
chip
register
unit
```

Physical and virtual registers are selected through the same `register` label,
so no app change is required when a new virtual register appears in
Prometheus.

## Usage

Choose a visualization, enter a request, select **Generate**, review the
generated fields, and add the panel.

Time-series example:

```text
Plot the hourly average of VINA for every chip over the last seven days.
```

Derived-value example:

```text
Plot VINA divided by VDDA for each chip as a dimensionless ratio.
```

Detector-map example:

```text
Show a detector map of TBPX Layer 3 modules whose INTERNAL_NTC_REL remained
above 20 C during the last two days. Use the complete layer view and aggregate
the four chips into one module value.
```

Detector-map requests can target a complete layer, disk, or ring, or a
quadrant. The map resolves Prometheus series to detector modules using the
embedded parts-dashboard mapping.

## Detector Mapping

The committed file
`src/pages/Home/detectorMap/detectorMapTemplate.json` contains the map geometry,
module mapping, and rendering code used by detector-map panels. Building or
installing the plugin does not require the original dashboard JSON.

When the source parts dashboard changes, regenerate the embedded asset:

```bash
npm run sync:detector-map -- \
  /path/to/cmsit_internal_ntc_rel_parts_dashboard.json
```

Review and commit the resulting template change. Only modules present in the
mapping can receive live values; the remaining geometry is still drawn.

## Repository Layout

```text
src/             Grafana plugin source and detector-map asset
scripts/         Build, installation, validation, and map-sync scripts
deployment/      Standalone deployment examples
provisioning/    Development provisioning
docs/            Installation and troubleshooting documentation
.github/         CI and release workflows
```

`node_modules/`, `dist/`, Grafana databases, credentials, Prometheus storage,
and local Grafana installations are deliberately excluded from Git.

## Security

Never commit Grafana Cloud tokens, API keys, Assistant credentials, GitHub
tokens, Grafana databases, or Prometheus storage. The repository contains only
non-secret configuration examples.

## License

See [LICENSE](LICENSE).
