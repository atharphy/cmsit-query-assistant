import {
  EmbeddedScene,
  SceneControlsSpacer,
  SceneFlexItem,
  SceneFlexLayout,
  SceneRefreshPicker,
  SceneTimePicker,
  SceneTimeRange,
} from '@grafana/scenes';

import { getPrometheusDataSource } from '../../constants';
import { CustomSceneObject } from './CustomSceneObject';

export function homeScene() {
  const datasource = getPrometheusDataSource();

  if (!datasource) {
    throw new Error('Prometheus data source not found');
  }

  const panelLayout = new SceneFlexLayout({
    direction: 'column',
    children: [],
  });

  const assistantControl = new CustomSceneObject(
    panelLayout,
    datasource
  );

  return new EmbeddedScene({
    $timeRange: new SceneTimeRange({
      from: 'now-6h',
      to: 'now',
    }),

    body: new SceneFlexLayout({
      direction: 'column',
      children: [
        new SceneFlexItem({
          minHeight: 420,
          ySizing: 'content',
          body: assistantControl,
        }),
        panelLayout,
      ],
    }),

    controls: [
      new SceneControlsSpacer(),
      new SceneTimePicker({ isOnCanvas: true }),
      new SceneRefreshPicker({
        intervals: ['1s', '5s', '30s', '1m'],
        isOnCanvas: true,
      }),
    ],
  });
}
