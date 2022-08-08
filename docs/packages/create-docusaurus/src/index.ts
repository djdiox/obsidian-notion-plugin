/**
 * Copyright (c) Facebook, Inc. and its affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import fs from 'fs-extra';
import {fileURLToPath} from 'url';
import path from 'path';
import _ from 'lodash';
import logger from '@docusaurus/logger';
import shell from 'shelljs';
import prompts, {type Choice} from 'prompts';
import supportsColor from 'supports-color';
import {escapeShellArg} from '@docusaurus/utils';

type CLIOptions = {
  packageManager?: PackageManager;
  skipInstall?: boolean;
  typescript?: boolean;
  gitStrategy?: GitStrategy;
};

// Only used in the rare, rare case of running globally installed create +
// using --skip-install. We need a default name to show the tip text
const defaultPackageManager = 'npm';

const lockfileNames = {
  npm: 'package-lock.json',
  yarn: 'yarn.lock',
  pnpm: 'pnpm-lock.yaml',
};

type PackageManager = keyof typeof lockfileNames;

const packageManagers = Object.keys(lockfileNames) as PackageManager[];

async function findPackageManagerFromLockFile(
  rootDir: string,
): Promise<PackageManager | undefined> {
  for (const packageManager of packageManagers) {
    const lockFilePath = path.join(rootDir, lockfileNames[packageManager]);
    if (await fs.pathExists(lockFilePath)) {
      return packageManager;
    }
  }
  return undefined;
}

function findPackageManagerFromUserAgent(): PackageManager | undefined {
  return packageManagers.find((packageManager) =>
    process.env.npm_config_user_agent?.startsWith(packageManager),
  );
}

async function askForPackageManagerChoice(): Promise<PackageManager> {
  const hasYarn = shell.exec('yarn --version', {silent: true}).code === 0;
  const hasPnpm = shell.exec('pnpm --version', {silent: true}).code === 0;

  if (!hasYarn && !hasPnpm) {
    return 'npm';
  }
  const choices = ['npm', hasYarn && 'yarn', hasPnpm && 'pnpm']
    .filter((p): p is string => Boolean(p))
    .map((p) => ({title: p, value: p}));

  return (
    (
      (await prompts(
        {
          type: 'select',
          name: 'packageManager',
          message: 'Select a package manager...',
          choices,
        },
        {
          onCancel() {
            logger.info`Falling back to name=${defaultPackageManager}`;
          },
        },
      )) as {packageManager?: PackageManager}
    ).packageManager ?? defaultPackageManager
  );
}

async function getPackageManager(
  dest: string,
  {packageManager, skipInstall}: CLIOptions,
): Promise<PackageManager> {
  if (packageManager && !packageManagers.includes(packageManager)) {
    throw new Error(
      `Invalid package manager choice ${packageManager}. Must be one of ${packageManagers.join(
        ', ',
      )}`,
    );
  }

  return (
    // If dest already contains a lockfile (e.g. if using a local template), we
    // always use that instead
    (await findPackageManagerFromLockFile(dest)) ??
    packageManager ??
    (await findPackageManagerFromLockFile('.')) ??
    findPackageManagerFromUserAgent() ??
    // This only happens if the user has a global installation in PATH
    (skipInstall ? defaultPackageManager : askForPackageManagerChoice())
  );
}

const recommendedTemplate = 'classic';
const typeScriptTemplateSuffix = '-typescript';
const templatesDir = fileURLToPath(new URL('../templates', import.meta.url));

type Template = {
  name: string;
  path: string;
  tsVariantPath: string | undefined;
};

async function readTemplates(): Promise<Template[]> {
  const dirContents = await fs.readdir(templatesDir);
  const templates = await Promise.all(
    dirContents
      .filter(
        (d) =>
          !d.startsWith('.') &&
          !d.startsWith('README') &&
          !d.endsWith(typeScriptTemplateSuffix) &&
          d !== 'shared',
      )
      .map(async (name) => {
        const tsVariantPath = path.join(
          templatesDir,
          `${name}${typeScriptTemplateSuffix}`,
        );
        return {
          name,
          path: path.join(templatesDir, name),
          tsVariantPath: (await fs.pathExists(tsVariantPath))
            ? tsVariantPath
            : undefined,
        };
      }),
  );

  // Classic should be first in list!
  return _.sortBy(templates, (t) => t.name !== recommendedTemplate);
}

async function copyTemplate(
  template: Template,
  dest: string,
  typescript: boolean,
): Promise<void> {
  await fs.copy(path.join(templatesDir, 'shared'), dest);

  // TypeScript variants will copy duplicate resources like CSS & config from
  // base template
  if (typescript) {
    await fs.copy(template.path, dest, {
      filter: async (filePath) =>
        (await fs.stat(filePath)).isDirectory() ||
        path.extname(filePath) === '.css' ||
        path.basename(filePath) === 'docusaurus.config.js',
    });
  }

  await fs.copy(typescript ? template.tsVariantPath! : template.path, dest, {
    // Symlinks don't exist in published npm packages anymore, so this is only
    // to prevent errors during local testing
    filter: async (filePath) => !(await fs.lstat(filePath)).isSymbolicLink(),
  });
}

function createTemplateChoices(templates: Template[]): Choice[] {
  function makeNameAndValueChoice(value: string | Template): Choice {
    if (typeof value === 'string') {
      return {title: value, value};
    }
    const title =
      value.name === recommendedTemplate
        ? `${value.name} (recommended)`
        : value.name;
    return {title, value};
  }

  return [
    ...templates.map((template) => makeNameAndValueChoice(template)),
    makeNameAndValueChoice('Git repository'),
    makeNameAndValueChoice('Local template'),
  ];
}

function isValidGitRepoUrl(gitRepoUrl: string): boolean {
  return ['https://', 'git@'].some((item) => gitRepoUrl.startsWith(item));
}

const gitStrategies = ['deep', 'shallow', 'copy', 'custom'] as const;
type GitStrategy = typeof gitStrategies[number];

async function getGitCommand(gitStrategy: GitStrategy): Promise<string> {
  switch (gitStrategy) {
    case 'shallow':
    case 'copy':
      return 'git clone --recursive --depth 1';
    case 'custom': {
      const {command} = (await prompts(
        {
          type: 'text',
          name: 'command',
          message:
            'Write your own git clone command. The repository URL and destination directory will be supplied. E.g. "git clone --depth 10"',
        },
        {
          onCancel() {
            logger.info`Falling back to code=${'git clone'}`;
          },
        },
      )) as {command?: string};
      return command ?? 'git clone';
    }
    case 'deep':
    default:
      return 'git clone';
  }
}

async function getSiteName(
  reqName: string | undefined,
  rootDir: string,
): Promise<string> {
  async function validateSiteName(siteName: string) {
    if (!siteName) {
      return 'A website name is required.';
    }
    const dest = path.resolve(rootDir, siteName);
    if (await fs.pathExists(dest)) {
      return logger.interpolate`Directory already exists at path=${dest}!`;
    }
    return true;
  }
  if (reqName) {
    const res = validateSiteName(reqName);
    if (typeof res === 'string') {
      throw new Error(res);
    }
    return reqName;
  }
  const {siteName} = (await prompts(
    {
      type: 'text',
      name: 'siteName',
      message: 'What should we name this site?',
      initial: 'website',
      validate: validateSiteName,
    },
    {
      onCancel() {
        logger.error('A website name is required.');
        process.exit(1);
      },
    },
  )) as {siteName: string};
  return siteName;
}

type Source =
  | {
      type: 'template';
      template: Template;
      typescript: boolean;
    }
  | {
      type: 'git';
      url: string;
      strategy: GitStrategy;
    }
  | {
      type: 'local';
      path: string;
    };

async function getSource(
  reqTemplate: string | undefined,
  templates: Template[],
  cliOptions: CLIOptions,
): Promise<Source> {
  if (reqTemplate) {
    if (isValidGitRepoUrl(reqTemplate)) {
      if (
        cliOptions.gitStrategy &&
        !gitStrategies.includes(cliOptions.gitStrategy)
      ) {
        logger.error`Invalid git strategy: name=${
          cliOptions.gitStrategy
        }. Value must be one of ${gitStrategies.join(', ')}.`;
        process.exit(1);
      }
      return {
        type: 'git',
        url: reqTemplate,
        strategy: cliOptions.gitStrategy ?? 'deep',
      };
    } else if (await fs.pathExists(path.resolve(reqTemplate))) {
      return {
        type: 'local',
        path: path.resolve(reqTemplate),
      };
    }
    const template = templates.find((t) => t.name === reqTemplate);
    if (!template) {
      logger.error('Invalid template.');
      process.exit(1);
    }
    if (cliOptions.typescript && !template.tsVariantPath) {
      logger.error`Template name=${reqTemplate} doesn't provide the TypeScript variant.`;
      process.exit(1);
    }
    return {
      type: 'template',
      template,
      typescript: cliOptions.typescript ?? false,
    };
  }
  const template = cliOptions.gitStrategy
    ? 'Git repository'
    : (
        (await prompts(
          {
            type: 'select',
            name: 'template',
            message: 'Select a template below...',
            choices: createTemplateChoices(templates),
          },
          {
            onCancel() {
              logger.error('A choice is required.');
              process.exit(1);
            },
          },
        )) as {template: Template | 'Git repository' | 'Local template'}
      ).template;
  if (template === 'Git repository') {
    const {gitRepoUrl} = (await prompts(
      {
        type: 'text',
        name: 'gitRepoUrl',
        validate: (url?: string) => {
          if (url && isValidGitRepoUrl(url)) {
            return true;
          }
          return logger.red('Invalid repository URL');
        },
        message: logger.interpolate`Enter a repository URL from GitHub, Bitbucket, GitLab, or any other public repo.
(e.g: url=${'https://github.com/ownerName/repoName.git'})`,
      },
      {
        onCancel() {
          logger.error('A git repo URL is required.');
          process.exit(1);
        },
      },
    )) as {gitRepoUrl: string};
    let strategy = cliOptions.gitStrategy;
    if (!strategy) {
      ({strategy} = (await prompts(
        {
          type: 'select',
          name: 'strategy',
          message: 'How should we clone this repo?',
          choices: [
            {title: 'Deep clone: preserve full history', value: 'deep'},
            {title: 'Shallow clone: clone with --depth=1', value: 'shallow'},
            {
              title: 'Copy: do a shallow clone, but do not create a git repo',
              value: 'copy',
            },
            {
              title: 'Custom: enter your custom git clone command',
              value: 'custom',
            },
          ],
        },
        {
          onCancel() {
            logger.info`Falling back to name=${'deep'}`;
          },
        },
      )) as {strategy?: GitStrategy});
    }
    return {
      type: 'git',
      url: gitRepoUrl,
      strategy: strategy ?? 'deep',
    };
  } else if (template === 'Local template') {
    const {templateDir} = (await prompts(
      {
        type: 'text',
        name: 'templateDir',
        validate: async (dir?: string) => {
          if (dir) {
            const fullDir = path.resolve(dir);
            if (await fs.pathExists(fullDir)) {
              return true;
            }
            return logger.red(
              logger.interpolate`path=${fullDir} does not exist.`,
            );
          }
          return logger.red('Please enter a valid path.');
        },
        message:
          'Enter a local folder path, relative to the current working directory.',
      },
      {
        onCancel() {
          logger.error('A file path is required.');
          process.exit(1);
        },
      },
    )) as {templateDir: string};
    return {
      type: 'local',
      path: templateDir,
    };
  }
  let useTS = cliOptions.typescript;
  if (!useTS && template.tsVariantPath) {
    ({useTS} = (await prompts({
      type: 'confirm',
      name: 'useTS',
      message:
        'This template is available in TypeScript. Do you want to use the TS variant?',
      initial: false,
    })) as {useTS?: boolean});
  }
  return {
    type: 'template',
    template,
    typescript: useTS ?? false,
  };
}

async function updatePkg(pkgPath: string, obj: {[key: string]: unknown}) {
  const pkg = (await fs.readJSON(pkgPath)) as {[key: string]: unknown};
  const newPkg = Object.assign(pkg, obj);

  await fs.outputFile(pkgPath, `${JSON.stringify(newPkg, null, 2)}\n`);
}

export default async function init(
  rootDir: string,
  reqName?: string,
  reqTemplate?: string,
  cliOptions: CLIOptions = {},
): Promise<void> {
  const templates = await readTemplates();
  const siteName = await getSiteName(reqName, rootDir);
  const dest = path.resolve(rootDir, siteName);
  const source = await getSource(reqTemplate, templates, cliOptions);

  logger.info('Creating new Docusaurus project...');

  if (source.type === 'git') {
    const gitCommand = await getGitCommand(source.strategy);
    const gitCloneCommand = `${gitCommand} ${escapeShellArg(
      source.url,
    )} ${escapeShellArg(dest)}`;
    if (shell.exec(gitCloneCommand).code !== 0) {
      logger.error`Cloning Git template failed!`;
      process.exit(1);
    }
    if (source.strategy === 'copy') {
      await fs.remove(path.join(dest, '.git'));
    }
  } else if (source.type === 'template') {
    try {
      await copyTemplate(source.template, dest, source.typescript);
    } catch (err) {
      logger.error`Copying Docusaurus template name=${source.template.name} failed!`;
      throw err;
    }
  } else {
    try {
      await fs.copy(source.path, dest);
    } catch (err) {
      logger.error`Copying local template path=${source.path} failed!`;
      throw err;
    }
  }

  // Update package.json info.
  try {
    await updatePkg(path.join(dest, 'package.json'), {
      name: _.kebabCase(siteName),
      version: '0.0.0',
      private: true,
    });
  } catch (err) {
    logger.error('Failed to update package.json.');
    throw err;
  }

  // We need to rename the gitignore file to .gitignore
  if (
    !(await fs.pathExists(path.join(dest, '.gitignore'))) &&
    (await fs.pathExists(path.join(dest, 'gitignore')))
  ) {
    await fs.move(path.join(dest, 'gitignore'), path.join(dest, '.gitignore'));
  }
  if (await fs.pathExists(path.join(dest, 'gitignore'))) {
    await fs.remove(path.join(dest, 'gitignore'));
  }

  // Display the most elegant way to cd.
  const cdpath = path.relative('.', dest);
  const pkgManager = await getPackageManager(dest, cliOptions);
  if (!cliOptions.skipInstall) {
    shell.cd(dest);
    logger.info`Installing dependencies with name=${pkgManager}...`;
    if (
      shell.exec(
        pkgManager === 'yarn' ? 'yarn' : `${pkgManager} install --color always`,
        {
          env: {
            ...process.env,
            // Force coloring the output, since the command is invoked by
            // shelljs, which is not an interactive shell
            ...(supportsColor.stdout ? {FORCE_COLOR: '1'} : {}),
          },
        },
      ).code !== 0
    ) {
      logger.error('Dependency installation failed.');
      logger.info`The site directory has already been created, and you can retry by typing:

  code=${`cd ${cdpath}`}
  code=${`${pkgManager} install`}`;
      process.exit(0);
    }
  }

  const useNpm = pkgManager === 'npm';
  logger.success`Created name=${cdpath}.`;
  logger.info`Inside that directory, you can run several commands:

  code=${`${pkgManager} start`}
    Starts the development server.

  code=${`${pkgManager} ${useNpm ? 'run ' : ''}build`}
    Bundles your website into static files for production.

  code=${`${pkgManager} ${useNpm ? 'run ' : ''}serve`}
    Serves the built website locally.

  code=${`${pkgManager} deploy`}
    Publishes the website to GitHub pages.

We recommend that you begin by typing:

  code=${`cd ${cdpath}`}
  code=${`${pkgManager} start`}

Happy building awesome websites!
`;
}
