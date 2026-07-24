import { SceneQueryRunner, VizPanel } from '@grafana/scenes';

import type { DataSourceRef } from '../../../constants';
import type { PanelSpecification } from '../panelSpecification';
import {
  buildDetectorMapCode,
  getDetectorMapTemplate,
} from './detectorMapCode';

export function buildDetectorMapPanel(
  specification: PanelSpecification,
  datasource: DataSourceRef
): VizPanel {
  const template = getDetectorMapTemplate();
  const queryRunner = new SceneQueryRunner({
    datasource,
    queries: [
      {
        refId: 'A',
        datasource,
        editorMode: 'code',
        expr: specification.promql,
        instant: true,
        range: false,
        format: 'time_series',
        legendFormat:
          '{{register}} board={{board}} optical_group={{optical_group}} hybrid={{hybrid}} chip={{chip}}',
      },
    ],
  });

  return new VizPanel({
    pluginId: template.pluginId,
    pluginVersion: template.pluginVersion,
    title: specification.title,
    description:
      'Interactive CMSIT detector map generated from the Assistant request.',
    options: {
      renderer: template.options.renderer,
      editorMode: template.options.editorMode,
      getOption: buildDetectorMapCode(specification),
    },
    fieldConfig: {
      defaults: {},
      overrides: [],
    },
    $data: queryRunner,
  });
}
