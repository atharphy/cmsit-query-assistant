import { config } from '@grafana/runtime';
import pluginJson from './plugin.json';

export const PLUGIN_BASE_URL = `/a/${pluginJson.id}`;

export enum ROUTES {
  Home = 'home',
}

export interface DataSourceRef {
  uid: string;
  type: string;
}

const CMSIT_PROMETHEUS_UID = 'cmsit-prometheus';

export function getPrometheusDataSource(): DataSourceRef | undefined {
  const datasources = Object.values(config.datasources);
  const datasource =
    datasources.find(
      (item) =>
        item.type === 'prometheus' &&
        item.uid === CMSIT_PROMETHEUS_UID
    ) ?? datasources.find((item) => item.type === 'prometheus');

  if (!datasource) {
    return undefined;
  }

  return {
    uid: datasource.uid,
    type: datasource.type,
  };
}
