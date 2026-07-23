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

export function getPrometheusDataSource(): DataSourceRef | undefined {
  const datasource = Object.values(config.datasources).find(
    (item) => item.type === 'prometheus'
  );

  if (!datasource) {
    return undefined;
  }

  return {
    uid: datasource.uid,
    type: datasource.type,
  };
}
