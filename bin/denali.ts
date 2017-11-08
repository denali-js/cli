#!/usr/bin/env node

import { satisfies } from 'semver';
import * as chalk from 'chalk';
import * as path from 'path';
import * as fs from 'fs';
import * as NestedError from 'nested-error-stacks';
import * as resolve from 'resolve';
import findup = require('findup-sync');

/* tslint:disable:no-console */

process.title = 'denali';

let version = process.version;

if (!satisfies(process.version, '>=7.6')) {
  throw new Error(`Denali requires node version >= 7.6, you used ${ version }`);
}

let localPkg: any = null;
let cliPkg: any;
let cliBootstrapPath: string;
let source: string;

try {
  let pkgPath = findup('package.json');
  if (pkgPath) {
    try {
      localPkg = require(pkgPath);
      let pkgDir = path.dirname(path.resolve(pkgPath));
      let localCliMain = resolve.sync('denali-cli', { basedir: pkgDir });
      let localCliDir = path.dirname(findup('package.json', { cwd: localCliMain }));
      cliPkg = require(path.join(localCliDir, 'package.json'));
      process.chdir(pkgDir);
      source = fs.lstatSync(localCliDir).isSymbolicLink() ? 'linked' : 'local';
      cliBootstrapPath = path.join(localCliDir, 'dist/lib/bootstrap');
    } catch (e) {
      cliPkg = path.join(__dirname, '../package.json');
      cliBootstrapPath = path.join(__dirname, '../lib/bootstrap');
      source = 'global';
    }

    process.stdout.write(`cli v${ cliPkg.version } [${ source }]`);

    try {
      require(cliBootstrapPath).default(localPkg);
    } catch (error) {
      throw new NestedError('\nError encountered while starting up denali-cli', error);
    }
  }
} catch (e) {
  console.error(chalk.red(e.stack || e.message || e));
  process.exit(1);
}
