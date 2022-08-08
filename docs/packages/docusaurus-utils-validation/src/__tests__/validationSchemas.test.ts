/**
 * Copyright (c) Facebook, Inc. and its affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import Joi from '../Joi';

import {
  AdmonitionsSchema,
  RehypePluginsSchema,
  RemarkPluginsSchema,
  PluginIdSchema,
  URISchema,
  PathnameSchema,
} from '../validationSchemas';

function createTestHelpers({
  schema,
  defaultValue,
}: {
  schema: Joi.Schema;
  defaultValue?: unknown;
}) {
  function testOK(value: unknown) {
    expect(Joi.attempt(value, schema)).toEqual(value ?? defaultValue);
  }

  function testFail(value: unknown) {
    expect(() => Joi.attempt(value, schema)).toThrowErrorMatchingSnapshot(
      `for value=${JSON.stringify(value)}`,
    );
  }

  return {testOK, testFail};
}

function testMarkdownPluginSchemas(schema: Joi.Schema) {
  const {testOK, testFail} = createTestHelpers({
    schema,
    defaultValue: [],
  });

  testOK(undefined);
  testOK([() => {}]);
  testOK([[() => {}, {attr: 'val'}]]);
  testOK([[() => {}, {attr: 'val'}], () => {}, [() => {}, {attr: 'val'}]]);
  // cSpell:ignore remarkjs
  // official `remarkjs/remark-frontmatter` plugin accepts string options
  testOK([[() => {}, 'string-option']]);
  testOK([[() => {}, true]]);

  testFail(null);
  testFail(false);
  testFail(3);
  testFail([null]);
  testFail([false]);
  testFail([3]);
  testFail([[]]);
  testFail([[() => {}, undefined]]);
}

describe('validation schemas', () => {
  it('pluginIdSchema', () => {
    const {testOK, testFail} = createTestHelpers({
      schema: PluginIdSchema,
      defaultValue: 'default',
    });

    testOK(undefined);
    testOK('docs');
    testOK('default');
    testOK('plugin-id_with-simple-special-chars');
    testOK('doc1');

    testFail('/docs');
    testFail('docs/');
    testFail('do/cs');
    testFail('do cs');
    testFail(null);
    testFail(3);
    testFail(true);
    testFail([]);
  });

  it('admonitionsSchema', () => {
    const {testOK, testFail} = createTestHelpers({
      schema: AdmonitionsSchema,
      defaultValue: true,
    });

    testOK(undefined);
    testOK(true);
    testOK(false);
    testOK({});
    testOK({tag: '+++'});
    testOK({keywords: ['info', 'tip']});
    testOK({tag: '+++', keywords: ['info', 'tip']});

    testFail(3);
    testFail([]);
    testFail({unknownAttribute: 'val'});
    testFail({tag: ''});
    testFail({keywords: []});

    // Legacy types
    testFail({
      infima: true,
    });
    testFail({
      icons: 'emoji',
    });
    testFail({
      customTypes: {
        myKeyword: {
          keyword: `myKeyword`,
          infima: true,
          svg: '<svg width="512px" height="512px" viewBox="0 0 512 512" xmlns="http://www.w3.org/2000/svg"></svg>',
        },
      },
    });
  });

  it('remarkPluginsSchema', () => {
    testMarkdownPluginSchemas(RemarkPluginsSchema);
  });

  it('rehypePluginsSchema', () => {
    testMarkdownPluginSchemas(RehypePluginsSchema);
  });

  it('uRISchema', () => {
    const {testFail, testOK} = createTestHelpers({schema: URISchema});

    const validURL = 'https://docusaurus.io';
    const doubleHash = 'https://docusaurus.io#github#/:';
    const invalidURL = 'spaces are invalid in a URL';
    const relativeURL = 'relativeURL';
    const relativeURLWithParent = '../relativeURLWithParent';
    const urlFromIssue = 'https://riot.im/app/#/room/#ligo-public:matrix.org';
    testOK(validURL);
    testOK(doubleHash);
    testFail(invalidURL);
    testOK(relativeURL);
    testOK(relativeURLWithParent);
    testOK(urlFromIssue);

    const protocolRelativeUrl1 = '//docusaurus.io/path';
    const protocolRelativeUrl2 = '//docusaurus.io/docs/doc1#hash';
    testOK(protocolRelativeUrl1);
    testOK(protocolRelativeUrl2);
  });

  it('pathnameSchema', () => {
    const {testFail, testOK} = createTestHelpers({schema: PathnameSchema});

    testOK('/foo');
    testFail('foo');
    testFail('https://github.com/foo');
  });
});
