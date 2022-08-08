/**
 * Copyright (c) Facebook, Inc. and its affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import {getAllFinalRoutes} from '../utils';
import type {RouteConfig} from '@docusaurus/types';

describe('getAllFinalRoutes', () => {
  it('gets final routes correctly', () => {
    const routes: RouteConfig[] = [
      {
        path: '/docs',
        component: '',
        routes: [
          {path: '/docs/someDoc', component: ''},
          {path: '/docs/someOtherDoc', component: ''},
        ],
      },
      {
        path: '/community',
        component: '',
      },
    ];
    expect(getAllFinalRoutes(routes)).toEqual([
      routes[0]!.routes![0],
      routes[0]!.routes![1],
      routes[1],
    ]);
  });
});
