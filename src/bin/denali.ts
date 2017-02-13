#!/usr/bin/env node
import SourceMapSupport = require('source-map-support');
import { satisfies } from 'semver';
import * as chalk from 'chalk';
import * as path from 'path';
import * as resolve from 'resolve';
import findup = require('findup-sync');

SourceMapSupport.install();

process.title = 'denali';

let version = process.version;

if (!satisfies(process.version, '>=6')) {
  console.error(chalk.red('`denali` requires node version >= 6, you used ' + version));
  process.exit(1);
}

let pkgPath = findup('package.json');

function loadGlobalCli() {
  let pkg = require('../../package.json');
  console.log('denali-cli ' + pkg.version + ' [global]');
  try {
    require('../bootstrap').default();
  } catch (error) {
    console.error('Error encountered while starting up denali-cli:');
    console.error(error.stack);
  }
}

// No package.json found, revert to global install
if (!pkgPath) {
  loadGlobalCli();
// Package.json found
} else {
  let pkg = require(pkgPath);
  // Special case Denali itself - when you try to run a command on the Denali source itself it will
  // look like an addon (because it is!) but won't have a local version of Denali as a dependency
  // to draw the core commands from. So we special case it here, and tell the CLI to use the global
  // copy of denali
  if (pkg.name === 'denali') {
    loadGlobalCli();
  } else {
    let pkgDir = path.dirname(path.resolve(pkgPath));
    // If a local copy of denali exists, use that, unless we are actually running
    // this in the denali repo itself
    try {
      let localDenaliCli = resolve.sync('denali-cli', { basedir: pkgDir });
      let localDenaliPkgDir = path.dirname(findup('package.json', { cwd: localDenaliCli }));
      let localDenaliCliPkg = require(path.join(localDenaliPkgDir, 'package.json'));
      console.log('denali-cli ' + localDenaliCliPkg.version + ' [local]');
      try {
        require(path.join(localDenaliPkgDir, 'dist', 'bootstrap')).default(true);
      } catch (error) {
        console.error('Error encountered while starting up denali-cli:');
        console.error(error.stack);
      }
    } catch (e) {
      loadGlobalCli();
    }
  }
}