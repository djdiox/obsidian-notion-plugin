/**
 * Copyright (c) Facebook, Inc. and its affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import jscodeshift, {
  type ArrowFunctionExpression,
  AssignmentExpression,
  type ASTPath,
  type Collection,
  type TemplateElement,
  VariableDeclarator,
  type CallExpression,
  type MemberExpression,
  type Identifier,
} from 'jscodeshift';

const empty = () =>
  jscodeshift.arrowFunctionExpression(
    [jscodeshift.identifier('props')],
    jscodeshift.jsxElement(
      jscodeshift.jsxOpeningElement(jscodeshift.jsxIdentifier('div'), [
        jscodeshift.jsxSpreadAttribute(jscodeshift.identifier('props')),
      ]),
      jscodeshift.jsxClosingElement(jscodeshift.jsxIdentifier('div')),
    ),
  );

const property = (key: string, value: ArrowFunctionExpression) =>
  jscodeshift.objectProperty(jscodeshift.identifier(key), value);

const processCallExpression = (node: ASTPath<VariableDeclarator>) => {
  const args = (node?.value?.init as CallExpression)?.arguments[0];
  if (!args) {
    return;
  }
  if (args.type === 'Literal') {
    if (
      typeof args.value === 'string' &&
      args.value.includes('../../core/CompLibrary')
    ) {
      const newDeclarator = jscodeshift.variableDeclarator(
        node.value.id,
        jscodeshift.objectExpression([
          property('Container', empty()),
          property('GridBlock', empty()),
          property('MarkdownBlock', empty()),
        ]),
      );
      jscodeshift(node).replaceWith(newDeclarator);
    }
  }
  if (args.type === 'TemplateLiteral') {
    if (
      args.quasis
        .map((element: TemplateElement) => element.value.raw)
        .join('')
        .match(/\/core\//)
    ) {
      const newDeclarator = jscodeshift.variableDeclarator(
        node.value.id,
        empty(),
      );
      jscodeshift(node).replaceWith(newDeclarator);
    }
  }
};

const processMemberExpression = (node: ASTPath<VariableDeclarator>) => {
  const object = (node?.value?.init as MemberExpression)?.object;
  if (!(object.type === 'CallExpression')) {
    return;
  }
  const args = object.arguments[0];
  if (!args) {
    return;
  }
  if (args.type === 'Literal') {
    if (args.value === '../../core/CompLibrary.js') {
      const newDeclarator = jscodeshift.variableDeclarator(
        node.value.id,
        jscodeshift.objectExpression([
          property('Container', empty()),
          property('GridBlock', empty()),
          property('MarkdownBlock', empty()),
        ]),
      );
      jscodeshift(node).replaceWith(newDeclarator);
    } else if (typeof args.value === 'string' && args.value.match(/server/)) {
      const newDeclarator = jscodeshift.variableDeclarator(
        node.value.id,
        empty(),
      );
      jscodeshift(node).replaceWith(newDeclarator);
    }
  }
  if (args.type === 'TemplateLiteral') {
    if (
      args.quasis
        .map((ele: TemplateElement) => ele.value.raw)
        .join('')
        .match(/\/core\//)
    ) {
      const newDeclarator = jscodeshift.variableDeclarator(
        node.value.id,
        empty(),
      );
      jscodeshift(node).replaceWith(newDeclarator);
    }
  }
};

export default function transformer(file: string): string {
  const root = jscodeshift(file);
  const r = getImportDeclaratorPaths(root);
  r.forEach((node) => {
    if (node?.value?.init?.type === 'CallExpression') {
      processCallExpression(node);
    } else if (node?.value?.init?.type === 'MemberExpression') {
      processMemberExpression(node);
    }
  });
  if (r[r.length - 1]) {
    jscodeshift(r[r.length - 1]!.parent).insertAfter(
      jscodeshift.importDeclaration(
        [jscodeshift.importDefaultSpecifier(jscodeshift.identifier('Layout'))],
        jscodeshift.literal('@theme/Layout'),
      ),
    );
  }

  root
    .find(AssignmentExpression, {
      operator: '=',
      left: {
        type: 'MemberExpression',
        object: {
          name: 'module',
        },
        property: {
          name: 'exports',
        },
      },
      right: {
        type: 'Identifier',
      },
    })
    .filter((p) => p.parentPath.parentPath.name === 'body')
    .forEach((p) => {
      const exportDecl = jscodeshift.exportDeclaration(
        true,
        jscodeshift.arrowFunctionExpression(
          [jscodeshift.identifier('props')],
          jscodeshift.jsxElement(
            jscodeshift.jsxOpeningElement(
              jscodeshift.jsxIdentifier('Layout'),
              [],
            ),
            jscodeshift.jsxClosingElement(jscodeshift.jsxIdentifier('Layout')),
            [
              jscodeshift.jsxElement(
                jscodeshift.jsxOpeningElement(
                  jscodeshift.jsxIdentifier((p.value.right as Identifier).name),
                  [
                    jscodeshift.jsxSpreadAttribute(
                      jscodeshift.identifier('props'),
                    ),
                  ],
                  true,
                ),
              ),
            ],
          ),
        ),
      );
      exportDecl.comments = p.parentPath.value.comments;
      jscodeshift(p.parentPath).replaceWith(exportDecl);
    });
  return root.toSource();
}

function getDefaultImportDeclarations(rootAst: Collection) {
  // var ... = require('y')
  return rootAst
    .find(VariableDeclarator, {
      init: {
        callee: {
          name: 'require',
        },
      },
    })
    .filter((variableDeclarator) => !!variableDeclarator.value);
}

function getNamedImportDeclarations(rootAst: Collection) {
  // var ... = require('y').x
  return rootAst.find(VariableDeclarator, {
    init: {
      object: {
        callee: {
          name: 'require',
        },
      },
    },
  });
}

function getImportDeclaratorPaths(variableDeclaration: Collection) {
  const defaultImports = getDefaultImportDeclarations(variableDeclaration);

  const namedImports = getNamedImportDeclarations(variableDeclaration);

  return [...defaultImports.paths(), ...namedImports.paths()];
}
