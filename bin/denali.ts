#!/usr/bin/env node
import 'main-dir';
import SourceMapSupport = require('source-map-support');
import { satisfies } from 'semver';
import * as chalk from 'chalk';
import * as path from 'path';
import * as fs from 'fs';
import * as NestedError from 'nested-error-stacks';
import * as resolve from 'resolve';
import findup = require('findup-sync');

/* tslint:disable:no-console */

SourceMapSupport.install();

process.title = 'denali';

let version = process.version;

if (!satisfies(process.version, '>=6.9')) {
  console.error(chalk.red('`denali` requires node version >= 6.9, you used ' + version));
  process.exit(1);
}

let pkgPath = findup('package.json');

/**
 * Load the globally installed version of the CLI and kick it off from there. Commands will be
 * loaded from the global package namespace.
 */
function loadGlobalCli() {
  let pkg = require('../../package.json');
  process.stdout.write(`cli v${ pkg.version } [global] `);
  try {
    require('../lib/bootstrap').default();
  } catch (error) {
    throw new NestedError('Globally installed CLI failed to load', error);
  }
}

// No package.json found, revert to global install
if (!pkgPath) {
  loadGlobalCli();
// Package.json found
} else {
  let pkg = require(pkgPath);
  let pkgDir = path.dirname(path.resolve(pkgPath));
  // If a local copy of denali exists, use that, unless we are actually running
  // this in the denali repo itself
  try {
    let localCliMain = resolve.sync('denali-cli', { basedir: pkgDir });
    let localCliDir = path.dirname(findup('package.json', { cwd: localCliMain }));
    let cliPkgType = fs.lstatSync(localCliDir).isSymbolicLink() ? 'linked' : 'local';
    let localCliPkg = require(path.join(localCliDir, 'package.json'));
    process.stdout.write(`cli v${ localCliPkg.version } [${ cliPkgType }] `);
    try {
      process.chdir(pkgDir);
      require(path.join(localCliDir, 'dist', 'lib', 'bootstrap')).default(pkg);
    } catch (error) {
      console.error('Error encountered while starting up denali-cli:');
      console.error(error.stack);
    }
  } catch (e) {
    loadGlobalCli();
  }
}
