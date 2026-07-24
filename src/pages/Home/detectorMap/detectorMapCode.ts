import type { PanelSpecification } from '../panelSpecification';
import detectorMapTemplate from './detectorMapTemplate.json';

const CONFIG_PREFIX = 'const cfg = ';
const STORAGE_EXPRESSION =
  'return "cmsit-parts-viewer:" + cfg.register + ":" + path;';
const MODULE_AGGREGATION_MARKER = '\nfunction colorFor(value) {';

let nextMapInstance = 1;

export interface DetectorMapTemplate {
  pluginId: string;
  pluginVersion: string;
  options: {
    renderer: string;
    editorMode: string;
    getOption: string;
  };
}

export function getDetectorMapTemplate(): DetectorMapTemplate {
  return detectorMapTemplate as DetectorMapTemplate;
}

function splitTemplate(source: string): {
  config: Record<string, unknown>;
  body: string;
} {
  if (!source.startsWith(CONFIG_PREFIX)) {
    throw new Error('Detector-map template has no configuration block.');
  }

  const configEnd = source.indexOf(';\n');
  if (configEnd === -1) {
    throw new Error('Detector-map template configuration is invalid.');
  }

  return {
    config: JSON.parse(
      source.slice(CONFIG_PREFIX.length, configEnd)
    ) as Record<string, unknown>,
    body: source.slice(configEnd + 2),
  };
}

function addInitialRuntime(
  body: string,
  specification: PanelSpecification
): string {
  const detectorMap = specification.detectorMap;
  if (!detectorMap) {
    throw new Error('Detector-map settings are missing.');
  }

  const selection = {
    subdetector: detectorMap.subdetector,
    element: String(detectorMap.element),
    part: detectorMap.part,
  };

  const initialRuntime =
    `selection: ${JSON.stringify(selection)},\n` +
    `  views: [${JSON.stringify({
      id: 1,
      ...selection,
      size: 'medium',
    })}],`;

  const defaultRuntime =
    'selection: { subdetector: "TBPX", element: "1", part: "complete" },\n' +
    '  views: [],';

  if (!body.includes(defaultRuntime)) {
    throw new Error(
      'Detector-map template runtime marker is missing.'
    );
  }

  return body.replace(defaultRuntime, initialRuntime);
}

function isolatePanelStorage(body: string): string {
  if (!body.includes(STORAGE_EXPRESSION)) {
    throw new Error(
      'Detector-map template storage marker is missing.'
    );
  }

  return body.replace(
    STORAGE_EXPRESSION,
    'return "cmsit-parts-viewer:" + cfg.register + ":" + path + ":" + cfg.instanceKey;'
  );
}

function addModuleAggregation(body: string): string {
  if (!body.includes(MODULE_AGGREGATION_MARKER)) {
    throw new Error(
      'Detector-map template aggregation marker is missing.'
    );
  }

  const aggregationCode = `
if (cfg.level === "module") {
  Object.keys(valuesByHardware).forEach(function(key) {
    const chips = Object.values(valuesByHardware[key]);
    if (chips.length === 0) return;
    const average = chips.reduce(function(sum, item) {
      return sum + item.value;
    }, 0) / chips.length;
    const source = chips[0];
    ["0", "1", "2", "3"].forEach(function(chip) {
      valuesByHardware[key][chip] = {
        value: average,
        board: source.board,
        optical_group: source.optical_group,
        hybrid: source.hybrid,
        chip: chip
      };
    });
  });
}
`;

  return body.replace(
    MODULE_AGGREGATION_MARKER,
    `${aggregationCode}${MODULE_AGGREGATION_MARKER}`
  );
}

export function buildDetectorMapCode(
  specification: PanelSpecification
): string {
  const detectorMap = specification.detectorMap;
  if (!detectorMap) {
    throw new Error('Detector-map settings are missing.');
  }

  const template = getDetectorMapTemplate();
  const { config, body } = splitTemplate(
    template.options.getOption
  );

  const dynamicConfig = {
    ...config,
    min: null,
    max: null,
    unit: specification.unit,
    register: specification.register,
    level: detectorMap.level,
    instanceKey: `assistant-map-${nextMapInstance++}`,
  };

  const configuredBody = addModuleAggregation(
    isolatePanelStorage(
      addInitialRuntime(body, specification)
    )
  );

  return `${CONFIG_PREFIX}${JSON.stringify(dynamicConfig)};\n${configuredBody}`;
}
