import {
  isDimensionlessUnit,
  parsePanelSpecification,
} from './panelSpecification';

describe('parsePanelSpecification', () => {
  it('parses and trims a valid response', () => {
    expect(
      parsePanelSpecification(
        '{"title":" VINA ","promql":" cmsit_monitor_value ","unit":" V "}'
      )
    ).toEqual({
      title: 'VINA',
      promql: 'cmsit_monitor_value',
      unit: 'V',
    });
  });

  it('accepts a JSON response wrapped in a code fence', () => {
    expect(
      parsePanelSpecification(
        '```json\n{"title":"Ratio","promql":"a / b","unit":""}\n```'
      )
    ).toEqual({
      title: 'Ratio',
      promql: 'a / b',
      unit: '',
    });
  });

  it('rejects a response without PromQL', () => {
    expect(() =>
      parsePanelSpecification('{"title":"VINA","unit":"V"}')
    ).toThrow('Assistant response is missing PromQL.');
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
