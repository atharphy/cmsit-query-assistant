
# CMSIT Query Assistant

A Grafana app plugin for creating CMS Inner Tracker monitoring plots from
natural-language requests.

The application uses Grafana Assistant to generate PromQL expressions and
displays the results as Grafana time-series panels. Multiple panels can be
configured before creation and removed independently.

## Features

- Natural-language monitoring requests
- PromQL generation through Grafana Assistant
- Multiple vertically arranged time-series panels
- Editable panel titles, PromQL expressions, and display units
- Shared Grafana time-range and refresh controls
- Per-panel removal and a global clear-all action
- Support for CMSIT detector labels and corrected monitoring values
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
CMSIT Query Assistant
       |
       v
Grafana time-series panels
```

## Requirements

### Grafana

- Grafana 12.3.0 or newer
- Grafana Assistant installed and enabled
- A configured Prometheus data source
- Permission to load this unsigned development plugin

The application was developed and tested with Grafana 13.1.0.

### Build Environment

- Node.js 22.23.1
- npm
- Git

The exact Node.js version is recorded in `.nvmrc`.

## Important External Dependencies

Grafana Assistant is not included in this repository. It must be installed,
enabled, and connected to the required Grafana Cloud service separately.

Grafana Assistant credentials, Grafana databases, access tokens, and local
Grafana configuration files must not be committed to this repository.

## Build From Source

Clone the repository and enter it:

```bash
git clone git@github.com:atharphy/cmsit-query-assistant.git
cd cmsit-query-assistant
```

Activate Node.js 22.23.1. When `nvm` is available:

```bash
nvm install
nvm use
```

Build and validate the plugin:

```bash
./scripts/build.sh
```

The script performs:

1. Locked dependency installation with `npm ci`
2. TypeScript checking
3. ESLint checking
4. Unit tests
5. Production build

The completed plugin is written to `dist/`.

## Install Into Grafana

Build the plugin first, then run:

```bash
./scripts/install.sh /path/to/grafana
```

For the CMSIT standalone installation:

```bash
./scripts/install.sh /home/bootcamp/grafana
```

The installer:

- Validates the plugin ID
- Backs up an existing installation
- Copies the production build
- Verifies the installed `module.js` checksum
- Prints the required Grafana configuration

## Allow the Unsigned Plugin

Add the following to `GRAFANA_HOME/conf/custom.ini`:

```ini
[plugins]
allow_loading_unsigned_plugins = atharphy-cmsitqueryassistant-app
```

Restart only the Grafana instance associated with that `GRAFANA_HOME`.

Example:

```bash
cd /home/bootcamp/grafana

./bin/grafana server \
  --homepath=/home/bootcamp/grafana \
  cfg:server.http_port=3300
```

Verify the server:

```bash
curl http://localhost:3300/api/health
```

## Prometheus Data Source

Set the Prometheus URL before starting Grafana:

```bash
export CMSIT_PROMETHEUS_URL=http://localhost:9090
```

A provisioning template is provided at:

```text
deployment/cmsit-prometheus.yaml.example
```

For the standalone Grafana installation, place the provisioning file under the
Grafana provisioning data-source directory before starting Grafana.

The expected data-source identity is:

```text
Name: CMSIT Prometheus
UID:  cmsit-prometheus
Type: prometheus
```

## Expected CMSIT Metrics

The application is designed for the following metrics:

```text
cmsit_monitor_value
cmsit_monitor_error
cmsit_monitor_last_update_seconds
```

Typical labels include:

```text
board
optical_group
hybrid
chip
register
unit
```

Example:

```promql
cmsit_monitor_value{register="VINA"}
```

## Grafana Assistant Usage

Example natural-language requests:

```text
Plot the hourly average of VINA for every chip over the last seven days.
```

```text
Plot the ratio of VINA to VDDA for each chip and use a dimensionless unit.
```

```text
Calculate analog power from VINA multiplied by ANA_IN_CURR and display it in
microwatts.
```

The Assistant produces:

- A panel title
- A PromQL expression
- A display unit

These fields can be reviewed and edited before adding the panel.

## Deployment Files

```text
deployment/custom.ini.example
```

Contains the unsigned-plugin setting.

```text
deployment/environment.example
```

Documents the expected Grafana and Prometheus environment variables.

```text
deployment/cmsit-prometheus.yaml.example
```

Provides the Prometheus data-source provisioning configuration.

## Repository Contents

```text
src/             Grafana plugin source
scripts/         Build and installation scripts
deployment/      Deployment templates
provisioning/    Development provisioning
.github/         Continuous integration and release workflows
docs/            Installation and troubleshooting documentation
```

The following are deliberately excluded from Git:

```text
node_modules/
dist/
Grafana databases
Grafana Assistant credentials
access tokens
local Grafana installations
Prometheus storage
```

## Verification

Before committing a release, run:

```bash
./scripts/build.sh
```

After installation, verify that Grafana serves the plugin metadata:

```bash
curl -s \
  http://localhost:3300/public/plugins/atharphy-cmsitqueryassistant-app/plugin.json
```

Then open:

```text
http://localhost:3300/a/atharphy-cmsitqueryassistant-app/home
```

## Security

Never commit:

- Grafana Cloud tokens
- API keys
- Assistant credentials
- GitHub personal access tokens
- Grafana SQLite databases
- Prometheus time-series storage

Only example configuration containing non-secret placeholders belongs in this
repository.

## License

See `LICENSE`.
