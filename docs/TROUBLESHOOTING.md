# CMSIT Query Assistant Troubleshooting

## `node` or `npm` Is Not Found

Example:

```text
bash: npm: command not found
```

Enable the local Node.js installation:

```bash
export PATH="$HOME/.local/node-v22.23.1-linux-x64/bin:$PATH"
hash -r
```

Verify:

```bash
node --version
npm --version
```

Do not accept the automatic operating-system package installation. It offers
Node.js 16, which is older than the Node.js 22 required by the plugin tooling.

## PATH Entry Exists but Is Not Active

Check:

```bash
grep -n 'node-v22.23.1-linux-x64' ~/.bashrc
```

Reload it:

```bash
source ~/.bashrc
```

If necessary, export the path manually in the current terminal.

## npm Deprecation Warnings

`npm install` may report warnings for packages such as `glob`, `inflight`, or
other transitive dependencies.

These warnings originate from the generated Grafana development toolchain and
do not mean that installation failed.

Check the command result:

```bash
echo $?
```

A result of zero means installation succeeded.

Do not run:

```bash
npm audit fix --force
```

## Missing `gdev-testdata` Data Source

The original Scenes scaffold uses Grafana's development-only TestData source:

```text
gdev-testdata
```

This source is not required by CMSIT Query Assistant.

The generated demonstration pages were removed:

```text
src/pages/HelloWorld
src/pages/WithTabs
src/pages/WithDrilldown
```

The CMSIT application uses the configured Prometheus data source instead.

## TypeScript Errors from Removed Routes

Errors involving these names indicate that old scaffold pages still exist:

```text
ROUTES.HelloWorld
ROUTES.WithTabs
ROUTES.WithDrilldown
DATASOURCE_REF
```

Remove the unused generated demonstration directories and rerun:

```bash
npm run typecheck
```

## Grafana Search Index Is Locked

Example:

```text
index is locked by another process
```

This means two Grafana processes are using the same data directory.

List only the standalone `bootcamp` instance:

```bash
pgrep -u bootcamp -af \
  'grafana server.*homepath=/home/bootcamp/grafana'
```

Stop the old PID:

```bash
kill <PID>
sleep 3
```

Do not kill the system Grafana instance under `/usr/share/grafana`.

Do not delete the Grafana search index. The lock is released when the duplicate
process stops normally.

## Plugin Is Unsigned

Development logs may contain:

```text
Plugin is unsigned
Permitting unsigned plugin
```

This is expected when `custom.ini` contains:

```ini
[plugins]
allow_loading_unsigned_plugins = atharphy-cmsitqueryassistant-app
```

The configuration permits only this exact plugin ID.

## Plugin Shows an Old Interface

First compare the source and deployed build:

```bash
sha256sum dist/module.js

sha256sum \
  /home/bootcamp/grafana/data/plugins/atharphy-cmsitqueryassistant-app/module.js
```

Verify what Grafana serves:

```bash
curl -s \
  http://localhost:3300/public/plugins/atharphy-cmsitqueryassistant-app/plugin.json
```

If the checksums and metadata are correct, clear the browser cache:

1. Open browser Developer Tools.
2. Select **Network**.
3. Enable **Disable cache**.
4. Select **Empty Cache and Hard Reload**.

An Incognito window can also be used.

Incrementing the plugin version provides reliable cache invalidation:

```bash
npm version patch --no-git-tag-version
npm run build
```

## Grafana Assistant Is Unavailable

Confirm that the Assistant plugin is installed:

```bash
ls /home/bootcamp/grafana/data/plugins/grafana-assistant-app
```

In Grafana, verify that it is enabled and connected to the configured Grafana
Cloud Assistant backend.

The CMSIT app disables generation while Assistant is unavailable.

## Prometheus Data Source Is Not Found

The application detects the first data source whose type is:

```text
prometheus
```

Verify the data source under:

```text
Connections > Data sources
```

Confirm that its connection test succeeds before using the app.

## Query Returns No Data

Check the basic metric in Prometheus:

```promql
cmsit_monitor_value
```

Then check a register:

```promql
cmsit_monitor_value{register="VINA"}
```

Also verify:

- RealtimeMonitor is running.
- Prometheus successfully scrapes the exporter.
- The Grafana time picker includes the available samples.
- The requested register exists.
- Detector labels match the query filters.

## Arithmetic Between Registers Returns No Data

Different registers have different `register` and possibly `unit` labels.
PromQL binary arithmetic may require vector matching:

```promql
cmsit_monitor_value{register="VINA"}
/
ignoring(register, unit)
cmsit_monitor_value{register="VDDA"}
```

Prometheus performs numeric arithmetic but does not perform dimensional unit
analysis.

## Plot Unit Is Missing or Incorrect

The exporter provides `unit` as a Prometheus label. Grafana does not
automatically convert that label into the panel y-axis unit.

CMSIT Query Assistant therefore stores a separate display unit with each
generated panel. Review the generated unit before adding the panel.

Examples:

```text
V / V   -> dimensionless
V * uA  -> uW
V / uA  -> MOhm
V - V   -> V
```

For virtual registers or expressions containing scaling constants, manually
verify the display unit.

## Build Reports a Large Asset Warning

Webpack may report that the Assistant SDK bundle exceeds its recommended asset
size.

This is a performance warning, not a build failure. Deployment is allowed when:

```bash
npm run typecheck
npm run lint
npm run build
```

all return exit status zero.
