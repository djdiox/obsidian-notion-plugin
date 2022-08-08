/**
 * Copyright (c) Facebook, Inc. and its affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

module.exports = function preset(context, opts = {}) {
  return {
    themes: [['@docusaurus/theme-classic', opts.test], null],
    plugins: [['@docusaurus/plugin-test', opts.test], false],
  };
};
