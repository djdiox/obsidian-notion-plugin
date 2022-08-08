/**
 * Copyright (c) Facebook, Inc. and its affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import path from 'path';
import {loadContext} from '@docusaurus/core/lib/server';
import {normalizePluginOptions} from '@docusaurus/utils-validation';

import pluginContentPages from '../index';
import {validateOptions} from '../options';

describe('docusaurus-plugin-content-pages', () => {
  it('loads simple pages', async () => {
    const siteDir = path.join(__dirname, '__fixtures__', 'website');
    const context = await loadContext({siteDir});
    const plugin = pluginContentPages(
      context,
      validateOptions({
        validate: normalizePluginOptions,
        options: {
          path: 'src/pages',
        },
      }),
    );
    const pagesMetadata = await plugin.loadContent!();

    expect(pagesMetadata).toMatchSnapshot();
  });

  it('loads simple pages with french translations', async () => {
    const siteDir = path.join(__dirname, '__fixtures__', 'website');
    const context = await loadContext({siteDir, locale: 'fr'});
    const plugin = pluginContentPages(
      context,
      validateOptions({
        validate: normalizePluginOptions,
        options: {
          path: 'src/pages',
        },
      }),
    );
    const pagesMetadata = await plugin.loadContent!();

    expect(pagesMetadata).toMatchSnapshot();
  });
});
