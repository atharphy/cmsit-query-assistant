import { buildDetectorMapCode } from './detectorMapCode';
import type { PanelSpecification } from '../panelSpecification';

function mapSpecification(
  overrides: Partial<PanelSpecification> = {}
): PanelSpecification {
  return {
    title: 'Layer 3 temperature',
    visualization: 'detector-map',
    promql:
      'cmsit_monitor_value{register="INTERNAL_NTC_REL"}',
    unit: 'C',
    register: 'INTERNAL_NTC_REL',
    detectorMap: {
      subdetector: 'TBPX',
      element: 3,
      part: 'complete',
      level: 'module',
    },
    ...overrides,
  };
}

describe('buildDetectorMapCode', () => {
  it('injects the requested detector view and register', () => {
    const code = buildDetectorMapCode(mapSpecification());

    expect(code).toContain(
      '"register":"INTERNAL_NTC_REL"'
    );
    expect(code).toContain('"subdetector":"TBPX"');
    expect(code).toContain('"element":"3"');
    expect(code).toContain('"part":"complete"');
  });

  it('isolates local storage between generated panels', () => {
    const first = buildDetectorMapCode(mapSpecification());
    const second = buildDetectorMapCode(mapSpecification());

    expect(first).toContain('"instanceKey":"assistant-map-');
    expect(second).toContain('"instanceKey":"assistant-map-');
    expect(first).not.toEqual(second);
  });

  it('adds module aggregation only when selected at runtime', () => {
    const code = buildDetectorMapCode(mapSpecification());

    expect(code).toContain('if (cfg.level === "module")');
    expect(code).toContain('"level":"module"');
  });

  it('produces syntactically valid Business Charts code', () => {
    const code = buildDetectorMapCode(mapSpecification());

    expect(() => new Function('context', code)).not.toThrow();
  });
});
