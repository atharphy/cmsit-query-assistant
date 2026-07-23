export interface PanelSpecification {
  title: string;
  promql: string;
  unit: string;
}

function removeCodeFences(value: string): string {
  return value
    .trim()
    .replace(/^```(?:json)?\s*/i, '')
    .replace(/\s*```$/, '')
    .trim();
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

  return {
    title: result.title.trim(),
    promql: result.promql.trim(),
    unit: result.unit.trim(),
  };
}

export function isDimensionlessUnit(unit: string): boolean {
  return ['', '1', 'none', 'dimensionless'].includes(
    unit.trim().toLowerCase()
  );
}
