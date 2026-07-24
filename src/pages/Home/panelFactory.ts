import {
  PanelBuilders,
  SceneQueryRunner,
  VizPanel,
} from '@grafana/scenes';

import type { DataSourceRef } from '../../constants';
import { buildDetectorMapPanel } from './detectorMap/detectorMapPanel';
import {
  isDimensionlessUnit,
  type PanelSpecification,
} from './panelSpecification';

export interface BuiltPanel {
  panel: VizPanel;
  minHeight: number;
}

function displayUnit(unit: string): string | undefined {
  return isDimensionlessUnit(unit)
    ? undefined
    : `suffix:${unit.trim()}`;
}

function buildRangeQuery(
  specification: PanelSpecification,
  datasource: DataSourceRef
): SceneQueryRunner {
  return new SceneQueryRunner({
    datasource,
    queries: [
      {
        refId: 'A',
        datasource,
        editorMode: 'code',
        expr: specification.promql,
        range: true,
        instant: false,
        legendFormat:
          '{{register}} board={{board}} optical_group={{optical_group}} hybrid={{hybrid}} chip={{chip}} {{unit}}',
      },
    ],
    maxDataPoints: 1000,
  });
}

function setUnit(panel: VizPanel, unit: string): void {
  const resolvedUnit = displayUnit(unit);
  if (!resolvedUnit) {
    return;
  }

  panel.setState({
    fieldConfig: {
      ...panel.state.fieldConfig,
      defaults: {
        ...panel.state.fieldConfig.defaults,
        unit: resolvedUnit,
      },
    },
  });
}

export function buildPanel(
  specification: PanelSpecification,
  datasource: DataSourceRef
): BuiltPanel {
  if (specification.visualization === 'detector-map') {
    return {
      panel: buildDetectorMapPanel(specification, datasource),
      minHeight: 900,
    };
  }

  const queryRunner = buildRangeQuery(specification, datasource);
  let panel: VizPanel;

  switch (specification.visualization) {
    case 'stat':
      panel = PanelBuilders.stat()
        .setTitle(specification.title)
        .setData(queryRunner)
        .build();
      break;
    case 'gauge':
      panel = PanelBuilders.gauge()
        .setTitle(specification.title)
        .setData(queryRunner)
        .build();
      break;
    case 'bar-gauge':
      panel = PanelBuilders.bargauge()
        .setTitle(specification.title)
        .setData(queryRunner)
        .build();
      break;
    case 'table':
      panel = PanelBuilders.table()
        .setTitle(specification.title)
        .setData(queryRunner)
        .build();
      break;
    case 'histogram':
      panel = PanelBuilders.histogram()
        .setTitle(specification.title)
        .setData(queryRunner)
        .build();
      break;
    case 'bar-chart':
      panel = PanelBuilders.barchart()
        .setTitle(specification.title)
        .setData(queryRunner)
        .build();
      break;
    case 'pie-chart':
      panel = PanelBuilders.piechart()
        .setTitle(specification.title)
        .setData(queryRunner)
        .build();
      break;
    case 'timeseries':
      panel = PanelBuilders.timeseries()
        .setTitle(specification.title)
        .setData(queryRunner)
        .build();
      break;
  }

  setUnit(panel, specification.unit);

  return {
    panel,
    minHeight:
      specification.visualization === 'table' ? 500 : 420,
  };
}
