import { SceneAppPage } from '@grafana/scenes';

import { ROUTES } from '../../constants';
import { prefixRoute } from '../../utils/utils.routing';
import { homeScene } from './homeScene';

export const homePage = new SceneAppPage({
  title: 'CMSIT Query Assistant',
  url: prefixRoute(ROUTES.Home),
  routePath: ROUTES.Home,
  subTitle: 'Create CMSIT monitoring plots from natural-language requests.',
  getScene: () => homeScene(),
});
