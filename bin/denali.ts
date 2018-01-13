#!/usr/bin/env node

import { satisfies } from 'semver';
import * as chalk from 'chalk';
import * as path from 'path';
import * as fs from 'fs';
import * as NestedError from 'nested-error-stacks';
import * as resolve from 'resolve';
import { sync as readPkgUp } from 'read-pkg-up';
import * as pkgDir from 'pkg-dir';

/* tslint:disable:no-console */

process.title = 'denali';

let version = process.version;

if (!satisfies(process.version, '>=7.6')) {
  throw new Error(`Denali requires node version >= 7.6, you used ${ version }`);
}

let projectPkg: any = null;
let cliPkg: any;
let cliBootstrapPath: string;
let source: string;

try {
  try {
    projectPkg = readPkgUp().pkg;
    let projectDir = pkgDir();
    let localCliMain = resolve.sync('denali-cli', { basedir: projectDir });
    let localCliDir = pkgDir(localCliMain);
    cliPkg = readPkgUp({ cwd: localCliMain });
    process.chdir(projectDir);
    source = fs.lstatSync(localCliDir).isSymbolicLink() ? 'linked' : 'local';
    cliBootstrapPath = path.join(localCliDir, 'dist/lib/bootstrap');
  } catch (e) {
    cliPkg = readPkgUp({ cwd: __dirname }).pkg;
    cliBootstrapPath = path.join(__dirname, '../lib/bootstrap');
    source = 'global';
  }

  process.stdout.write(`cli v${ cliPkg.version } [${ source }]`);

  try {
    require(cliBootstrapPath).default(projectPkg);
  } catch (error) {
    throw new NestedError('\nError encountered while starting up denali-cli', error);
  }
} catch (e) {
  console.error(chalk.red(e.stack || e.message || e));
  process.exit(1);
}
