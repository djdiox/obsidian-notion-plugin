/**
 * Copyright (c) Facebook, Inc. and its affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import importFresh from 'import-fresh';
import {createConfigFile} from '../index';
import type {VersionOneConfig} from '../types';

describe('create config', () => {
  it('simple test', () => {
    const v1Config: VersionOneConfig = importFresh(
      `${__dirname}/__fixtures__/sourceSiteConfig.js`,
    );
    const siteDir = 'website';
    const newDir = 'websiteMigrated';

    const result = createConfigFile({v1Config, siteDir, newDir});

    const output = importFresh(
      `${__dirname}/__fixtures__/expectedSiteConfig.js`,
    );
    expect(result).toEqual(output);
  });
});
