import {
  isDimensionlessUnit,
  parsePanelSpecification,
} from './panelSpecification';

describe('parsePanelSpecification', () => {
  it('keeps old responses compatible as time series', () => {
    expect(
      parsePanelSpecification(
        '{"title":" VINA ","promql":"cmsit_monitor_value{register=\\"VINA\\"}","unit":" V "}'
      )
    ).toEqual({
      title: 'VINA',
      visualization: 'timeseries',
      promql: 'cmsit_monitor_value{register="VINA"}',
      unit: 'V',
      register: 'VINA',
    });
  });

  it('parses a complete detector-map response', () => {
    expect(
      parsePanelSpecification(
        JSON.stringify({
          title: 'Hot TBPX modules',
          visualization: 'detector-map',
          promql:
            'min_over_time(cmsit_monitor_value{register="INTERNAL_NTC_REL"}[2d]) > 20',
          unit: 'C',
          register: 'INTERNAL_NTC_REL',
          detectorMap: {
            subdetector: 'TBPX',
            element: 3,
            part: 'complete',
            level: 'module',
          },
        })
      )
    ).toEqual({
      title: 'Hot TBPX modules',
      visualization: 'detector-map',
      promql:
        'min_over_time(cmsit_monitor_value{register="INTERNAL_NTC_REL"}[2d]) > 20',
      unit: 'C',
      register: 'INTERNAL_NTC_REL',
      detectorMap: {
        subdetector: 'TBPX',
        element: 3,
        part: 'complete',
        level: 'module',
      },
    });
  });

  it('rejects a barrel quadrant for a ring detector', () => {
    expect(() =>
      parsePanelSpecification(
        JSON.stringify({
          title: 'Invalid map',
          visualization: 'detector-map',
          promql: 'cmsit_monitor_value{register="VINA"}',
          unit: 'V',
          register: 'VINA',
          detectorMap: {
            subdetector: 'TEPX',
            element: 1,
            part: 'ladder+z+',
            level: 'chip',
          },
        })
      )
    ).toThrow('is not valid for TEPX');
  });

  it('rejects a detector map without a register', () => {
    expect(() =>
      parsePanelSpecification(
        JSON.stringify({
          title: 'No register',
          visualization: 'detector-map',
          promql: 'vector(1)',
          unit: '',
          detectorMap: {
            subdetector: 'TBPX',
            element: 1,
            part: 'complete',
            level: 'module',
          },
        })
      )
    ).toThrow('must identify one register');
  });
});

describe('isDimensionlessUnit', () => {
  it.each(['', '1', 'none', 'dimensionless', ' Dimensionless '])(
    'recognizes %p as dimensionless',
    (unit) => {
      expect(isDimensionlessUnit(unit)).toBe(true);
    }
  );

  it('keeps physical units', () => {
    expect(isDimensionlessUnit('V')).toBe(false);
  });
});
