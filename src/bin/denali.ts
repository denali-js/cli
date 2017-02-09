#!/usr/bin/env node
import SourceMapSupport = require('source-map-support');
import semver from 'semver';
import chalk from 'chalk';
import path from 'path';
import resolve from 'resolve';
import findup from 'findup-sync';

SourceMapSupport.install();

process.title = 'denali';

let version = process.version;

if (!semver.satisfies(process.version, '>=6')) {
  console.error(chalk.red('`denali` requires node version >= 6, you used ' + version));
  process.exit(1);
}

let pkgPath = findup('package.json');

function loadGlobalCli() {
  let pkg = require('../../package.json');
  console.log('denali ' + pkg.version + ' [global]');
  require('../bootstrap').default();
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
    let localDenaliCli = resolve.sync('denali', { basedir: pkgDir });
    let localDenaliPkgDir = path.dirname(findup('package.json', { cwd: localDenaliCli }));
    let localDenaliCliPkg = require(path.join(localDenaliPkgDir, 'package.json'));
    console.log('denali ' + localDenaliCliPkg.version + ' [local]');
    require(path.join(localDenaliPkgDir, 'dist', 'bootstrap')).default(true);
  } catch (e) {
    loadGlobalCli();
  }
}