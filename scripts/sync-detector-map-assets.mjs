#!/usr/bin/env node

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '..'
);

const sourceArgument = process.argv[2];

if (!sourceArgument) {
  throw new Error(
    'Usage: npm run sync:detector-map -- /path/to/parts-dashboard.json'
  );
}

const dashboardPath = path.resolve(root, sourceArgument);

const outputPath = path.resolve(
  root,
  'src/pages/Home/detectorMap/detectorMapTemplate.json'
);

const dashboard = JSON.parse(
  fs.readFileSync(dashboardPath, 'utf8')
);

const panel = dashboard.panels?.find(
  (candidate) =>
    candidate.type === 'volkovlabs-echarts-panel' &&
    typeof candidate.options?.getOption === 'string'
);

if (!panel) {
  throw new Error(
    `No Business Charts detector-map panel found in ${dashboardPath}`
  );
}

const asset = {
  pluginId: panel.type,
  pluginVersion: panel.pluginVersion,
  options: {
    renderer: panel.options.renderer,
    editorMode: panel.options.editorMode,
    getOption: panel.options.getOption,
  },
};

fs.mkdirSync(path.dirname(outputPath), { recursive: true });
fs.writeFileSync(
  outputPath,
  `${JSON.stringify(asset, null, 2)}\n`
);

console.log(`Detector-map asset written to ${outputPath}`);
