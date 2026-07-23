import React from 'react';
import { AppRootProps } from '@grafana/data';
import { SceneApp, useSceneApp } from '@grafana/scenes';
import { Alert } from '@grafana/ui';

import { getPrometheusDataSource } from '../../constants';
import { homePage } from '../../pages/Home/homePage';
import { PluginPropsContext } from '../../utils/utils.plugin';

function getSceneApp() {
  return new SceneApp({
    pages: [homePage],
    urlSyncOptions: {
      updateUrlOnInit: true,
      createBrowserHistorySteps: true,
    },
  });
}

function AppWithScenes() {
  const scene = useSceneApp(getSceneApp);
  const datasource = getPrometheusDataSource();

  if (!datasource) {
    return (
      <Alert title="Prometheus data source not found">
        Configure a Prometheus data source before using the CMSIT Query
        Assistant.
      </Alert>
    );
  }

  return <scene.Component model={scene} />;
}

function App(props: AppRootProps) {
  return (
    <PluginPropsContext.Provider value={props}>
      <AppWithScenes />
    </PluginPropsContext.Provider>
  );
}

export default App;
