export const VISUALIZATION_TYPES = [
  'timeseries',
  'detector-map',
  'stat',
  'gauge',
  'bar-gauge',
  'table',
  'histogram',
  'bar-chart',
  'pie-chart',
] as const;

export type VisualizationType = (typeof VISUALIZATION_TYPES)[number];

export const VISUALIZATION_LABELS: Record<VisualizationType, string> = {
  timeseries: 'Time series',
  'detector-map': 'Detector map',
  stat: 'Stat',
  gauge: 'Gauge',
  'bar-gauge': 'Bar gauge',
  table: 'Table',
  histogram: 'Histogram',
  'bar-chart': 'Bar chart',
  'pie-chart': 'Pie chart',
};

export const SUBDETECTORS = ['TBPX', 'TEPX', 'TFPX'] as const;
export type Subdetector = (typeof SUBDETECTORS)[number];

export type DetectorMapPart =
  | 'complete'
  | 'ladder+z+'
  | 'ladder+z-'
  | 'ladder-z+'
  | 'ladder-z-'
  | 'left+z'
  | 'right+z'
  | 'left-z'
  | 'right-z';

export interface DetectorMapSpecification {
  subdetector: Subdetector;
  element: number;
  part: DetectorMapPart;
  level: 'chip' | 'module';
}

export interface PanelSpecification {
  title: string;
  visualization: VisualizationType;
  promql: string;
  unit: string;
  register: string;
  detectorMap?: DetectorMapSpecification;
}

const BARREL_PARTS = new Set<DetectorMapPart>([
  'complete',
  'ladder+z+',
  'ladder+z-',
  'ladder-z+',
  'ladder-z-',
]);

const RING_PARTS = new Set<DetectorMapPart>([
  'complete',
  'left+z',
  'right+z',
  'left-z',
  'right-z',
]);

function removeCodeFences(value: string): string {
  return value
    .trim()
    .replace(/^```(?:json)?\s*/i, '')
    .replace(/\s*```$/, '')
    .trim();
}

function isVisualizationType(value: unknown): value is VisualizationType {
  return (
    typeof value === 'string' &&
    VISUALIZATION_TYPES.includes(value as VisualizationType)
  );
}

function inferRegister(promql: string): string {
  return (
    promql.match(/\bregister\s*=\s*"([^"]+)"/)?.[1] ??
    promql.match(/\bregister\s*=\s*'([^']+)'/)?.[1] ??
    ''
  );
}

function parseDetectorMap(
  value: unknown
): DetectorMapSpecification {
  if (typeof value !== 'object' || value === null) {
    throw new Error(
      'A detector-map response must include detectorMap settings.'
    );
  }

  const map = value as Record<string, unknown>;

  if (
    typeof map.subdetector !== 'string' ||
    !SUBDETECTORS.includes(map.subdetector as Subdetector)
  ) {
    throw new Error(
      'detectorMap.subdetector must be TBPX, TEPX, or TFPX.'
    );
  }

  const subdetector = map.subdetector as Subdetector;
  const maximumElement =
    subdetector === 'TBPX' ? 4 : subdetector === 'TFPX' ? 8 : 4;

  if (
    typeof map.element !== 'number' ||
    !Number.isInteger(map.element) ||
    map.element < 1 ||
    map.element > maximumElement
  ) {
    throw new Error(
      `detectorMap.element must be an integer from 1 to ${maximumElement} for ${subdetector}.`
    );
  }

  if (typeof map.part !== 'string') {
    throw new Error('detectorMap.part is missing.');
  }

  const part = map.part as DetectorMapPart;
  const validParts =
    subdetector === 'TBPX' ? BARREL_PARTS : RING_PARTS;

  if (!validParts.has(part)) {
    throw new Error(
      `detectorMap.part "${part}" is not valid for ${subdetector}.`
    );
  }

  if (map.level !== 'chip' && map.level !== 'module') {
    throw new Error(
      'detectorMap.level must be either "chip" or "module".'
    );
  }

  return {
    subdetector,
    element: map.element,
    part,
    level: map.level,
  };
}

export function parsePanelSpecification(
  value: string
): PanelSpecification {
  const parsed: unknown = JSON.parse(removeCodeFences(value));

  if (typeof parsed !== 'object' || parsed === null) {
    throw new Error('Assistant response is not a JSON object.');
  }

  const result = parsed as Record<string, unknown>;

  if (typeof result.title !== 'string' || !result.title.trim()) {
    throw new Error('Assistant response is missing a panel title.');
  }

  if (typeof result.promql !== 'string' || !result.promql.trim()) {
    throw new Error('Assistant response is missing PromQL.');
  }

  if (typeof result.unit !== 'string') {
    throw new Error('Assistant response is missing a unit field.');
  }

  const visualization =
    result.visualization === undefined
      ? 'timeseries'
      : result.visualization;

  if (!isVisualizationType(visualization)) {
    throw new Error(
      `Unsupported visualization "${String(visualization)}".`
    );
  }

  const promql = result.promql.trim();
  const register =
    typeof result.register === 'string' && result.register.trim()
      ? result.register.trim()
      : inferRegister(promql);

  const specification: PanelSpecification = {
    title: result.title.trim(),
    visualization,
    promql,
    unit: result.unit.trim(),
    register,
  };

  if (visualization === 'detector-map') {
    if (!register) {
      throw new Error(
        'A detector-map response must identify one register.'
      );
    }

    specification.detectorMap = parseDetectorMap(
      result.detectorMap
    );
  }

  return specification;
}

export function isDimensionlessUnit(unit: string): boolean {
  return ['', '1', 'none', 'dimensionless'].includes(
    unit.trim().toLowerCase()
  );
}
