import {
  noop,
  dropWhile,
  takeWhile
} from 'lodash';
import * as path from 'path';
import * as fs from 'fs';
import dedent from 'dedent-js';
import * as nsp from 'nsp';
import * as broccoli from 'broccoli';
import * as rimraf from 'rimraf';
import printSlowNodes from 'broccoli-slow-trees';
import { sync as copyDereferenceSync } from 'copy-dereference';
import * as chalk from 'chalk';
import * as MergeTree from 'broccoli-merge-trees';
import * as Funnel from 'broccoli-funnel';
import * as createDebug from 'debug';
import * as tryRequire from 'try-require';
import * as semver from 'semver';
import * as NestedError from 'nested-error-stacks';
import Builder, { Tree } from './builder';
import Watcher from './watcher';
import ui from './ui';
import spinner from './spinner';
import startTimer from './timer';

const debug = createDebug('denali-cli:project');

export interface ProjectOptions {
  dir?: string;
  environment?: string;
  printSlowTrees?: boolean;
  lint?: boolean;
  audit?: boolean;
  buildDummy?: boolean;
}

export interface WatchOptions {
  outputDir: string;
  onBuild?(project: Project): void;
  beforeRebuild?(): Promise<void> | void;
}

export interface Vulnerability {
  path: string[];
  module: string;
  version: string;
  recommendation: string;
}

/**
 * The Project class represents the build process for the root directory. Denali packages are
 * composed of a root package, either an app or an addon, with a graph of addon dependencies below
 * that. Each node in the addon graph (along with the root app or addon) is represented by a
 * Builder instance, which is responsible for building that one node. The Project class coordinates
 * these builders, and produces the final output: a `dist/` folder ready to run.
 *
 * @module denali-cli
 */
export default class Project {

  /**
   * An internal cache of builders, stored by their realpath on disk. This allows us to maintain
   * the logical deeply nested, possibly circular dependency graph, while only create a single
   * Builder per real disk location, so we avoid duplication and cycles.
   */
  public builders: Map<string, Builder> = new Map();

  /**
   * The root dir of the project's package
   */
  public dir: string;

  /**
   * The build target environment, defaults to 'development'
   */
  public environment: string;

  /**
   * Should we print slow broccoli trees on build?
   */
  public printSlowTrees: boolean;

  /**
   * The package.json for this project's package
   */
  public pkg: any;

  /**
   * Should we run linting? This is an advisory only flag for linting addons - denali-cli does not
   * enforce this, nor does it have first-class knowledge of addons that perform linting or not.
   */
  public lint: boolean;

  /**
   * Should we run an nsp audit of the project's dependencies? Defaults to true in development
   */
  public audit: boolean;

  /**
   * Should we build the dummy app, assuming this is an addon/
   */
  public buildDummy: boolean;

  /**
   * The root Builder instance that represents the top level builder for the package (might be
   * the package itself, or the dummy app for an addon under test)
   */
  public rootBuilder: Builder;

  /**
   * The root Tree for the main build process.
   */
  public rootTree: Tree;

  /**
   * The root Tree for the main build process.
   */
  protected broccoliBuilder: any;

  /**
   * Creates an instance of Project
   */
  constructor(options: ProjectOptions = {}) {
    this.dir = options.dir || process.cwd();
    debug(`creating project for ${ this.dir }`);
    this.environment = options.environment || 'development';
    this.printSlowTrees = options.printSlowTrees;
    this.pkg = require(path.join(this.dir, 'package.json'));
    this.lint = options.lint;
    this.audit = options.audit;
    this.buildDummy = options.buildDummy;

    this.createRootBuilderAndTree();
  }

  /**
   * Is this Project instance for an addon?
   */
  public get isAddon(): boolean {
    return this.pkg.keywords && this.pkg.keywords.includes('denali-addon');
  }

  /**
   * Get the root builder and it's tree for this Project. Also returns the broccoli.Builder instance
   * based on the root tree
   */
  protected createRootBuilderAndTree() {
    debug('assembling project build tree');
    let isAddonUnderTest = this.isAddon && this.buildDummy;

    // For addons under test, our root build tree is the dummy app, and the addon gets built as
    // an on-the-fly child addon build
    if (isAddonUnderTest) {
      this.rootBuilder = Builder.createFor(path.join(this.dir, 'test', 'dummy'), this, [ this.dir ]);
      this.rootTree = this.rootBuilder.toTree();
      // Reach into the dummy app's build and pull out the in-flight builder for this root addon
      // Normally this tree is just ejected, so we grab a direct handle to it so we can extract the
      // tests from it
      let addonBuilder = this.rootBuilder.childBuilders.find((builder) => builder.pkg.name === this.pkg.name);
      let addonTests = new Funnel(addonBuilder.tree, {
        include: [ 'test/**/*' ],
        exclude: [ 'test/dummy/**/*' ]
      });
      this.rootTree = new MergeTree([ this.rootTree, addonTests ], { overwrite: true });
    } else {
      this.rootBuilder = Builder.createFor(this.dir, this);
      this.rootTree = this.rootBuilder.toTree();
    }

    let broccoliBuilder = this.broccoliBuilder = new broccoli.Builder(this.rootTree);
    // tslint:disable-next-line:completed-docs
    function onExit() {
      broccoliBuilder.cleanup();
      process.exit(1);
    }
    process.on('SIGINT', onExit);
    process.on('SIGTERM', onExit);
  }

  /**
   * Build the project and return a Promise that resolves with the output directory once the build
   * is complete.
   */
  public async build(outputDir: string = 'dist'): Promise<string> {
    debug('building project');
    spinner.start(`Building ${ this.rootBuilder.buildDescription() }`);
    let timer = startTimer();
    try {
      let results = await this.broccoliBuilder.build();
      debug('broccoli build finished');
      this.finishBuild(results, outputDir);
      debug('build finalized');
      spinner.succeed(`${ this.pkg.name } build complete (${ timer.stop() }s)`);
    } catch (err) {
      spinner.fail('Build failed');
      if (err.file) {
        throw new NestedError(`Build failed on file: ${ err.file }`, err);
      }
      throw new NestedError('Project failed to build', err);
    } finally {
      await this.broccoliBuilder.cleanup();
    }
    return outputDir;
  }

  /**
   * Build the project and start watching the source files for changes, rebuilding when they occur
   */
  public async watch(options: WatchOptions) {
    options.outputDir = options.outputDir || 'dist';
    options.onBuild = options.onBuild || noop;
    // Start watcher
    let timer = startTimer();
    spinner.start(`Building ${ this.rootBuilder.buildDescription() }`);
    let watcher = new Watcher(this.broccoliBuilder, { beforeRebuild: options.beforeRebuild, interval: 100 });

    // Handle watcher events
    watcher.on('buildstart', async () => {
      debug('changes detected, rebuilding');
      timer = startTimer();
      spinner.start(`Building ${ this.pkg.name }`, this.pkg.name);
    });
    watcher.on('change', async (results: { directory: string, graph: any }) => {
      debug('rebuild finished, wrapping up');
      this.finishBuild(results, options.outputDir);
      spinner.succeed(`${ this.pkg.name } build complete (${ timer.stop() }s)`, this.pkg.name);
      options.onBuild(this);
    });
    watcher.on('error', async (error: any) => {
      spinner.fail('Build failed', this.pkg.name);
      if (error.file) {
        if (error.line && error.column) {
          ui.error(`File: ${ error.treeDir }/${ error.file }:${ error.line }:${ error.column }`);
        } else {
          ui.error(`File: ${ error.treeDir }/${ error.file }`);
        }
      }
      if (error.message) {
        ui.error(`Error: ${ error.message }`);
      }
      if (error.stack) {
        ui.error(`Stack trace:\n${ error.stack.replace(/(^.)/mg, '  $1') }`);
      }
    });
  }

  /**
   * Build the project and create an application instance for this app. Useful if you want to
   * perform actions based on the runtime state of the application, i.e. print a list of routes.
   *
   * Note: we don't type the return here as Promise<Application> in the code because that would
   * introduce a hornet's nest of circular dependency (i.e. denali-cli -> denali -> denali-cli ...).
   * But the documentation is correct here - the resolved value of the promise is an Applciation
   * instance. And consuming apps/addons already have a dependency on denali, so they can cast the
   * return value here to an Application.
   */
  public async createApplication(): Promise<any> {
    try {
      let outputDir = await this.build();
      let applicationPath = path.resolve(path.join(outputDir, 'app', 'application'));
      let Application = tryRequire(applicationPath);
      Application = Application.default || Application;
      if (!Application) {
        throw new Error(`Denali was unable to load app/application.js from ${ applicationPath }`);
      }
      return new Application({
        dir: path.resolve(outputDir),
        environment: this.environment
      });
    } catch (error) {
      throw new NestedError('Failed to create application', error);
    }
  }

  /**
   * After a build completes, this method cleans up the result. It copies the results out of tmp and
   * into the output directory, and kicks off any optional behaviors post-build.
   */
  protected finishBuild(results: { directory: string, graph: any }, destDir: string) {
    this.copyBuildOutput(results.directory, destDir);

    if (this.printSlowTrees) {
      printSlowNodes(results.graph);
    }

    if (this.audit) {
      this.auditPackage();
    }
  }

  protected copyBuildOutput(buildResultDir: string, destDir: string): void {
    debug(`copying broccoli build output to final destination dir: ${ destDir }`);
    if (!path.isAbsolute(buildResultDir)) {
      buildResultDir = path.resolve(buildResultDir);
    }

    rimraf.sync(destDir);
    copyDereferenceSync(buildResultDir, destDir);

    // If this is an addon under test (i.e. we are building the dummy app), then by now we
    // have the compiled dummy app inside destDir. Now we just symlink from destDir/node_modules
    // out to our addon's directory so you can load the addon from the built dummy app
    if (this.isAddon && this.buildDummy) {
      debug('symlinking root addon into dummy app build');
      fs.mkdirSync(path.join(destDir, 'node_modules'));
      fs.symlinkSync(this.dir, path.join(destDir, 'node_modules', this.pkg.name));
    }
  }

  /**
   * Run the package.json through nsp to check for any security vulnerabilities, hiding any that
   * match the root builder's `ignoreVulnerabilities` array.
   */
  protected auditPackage() {
    debug('sending package.json to nsp for audit');
    let pkg = path.join(this.dir, 'package.json');
    nsp.check({ package: pkg }, (err: any, vulnerabilities: Vulnerability[]) => {
      if (err && [ 'ENOTFOUND', 'ECONNRESET' ].indexOf(err.code) > -1) {
        ui.warn('Error trying to scan package dependencies for vulnerabilities with nsp, unable to reach server. Skipping scan ...');
        ui.warn(err);
      }
      if (vulnerabilities && vulnerabilities.length > 0) {
        vulnerabilities = this.filterIgnoredVulnerabilities(vulnerabilities, this.rootBuilder.ignoreVulnerabilities);
        if (vulnerabilities.length > 0) {
          debug('nsp found vulnerabilities');
          ui.warn('WARNING: Some packages in your package.json may have security vulnerabilities:');
          vulnerabilities.map(this.printVulnerability);
        }
      }
    });
  }

  /**
   * Filter the list of vulnerabilities by the ignored vulnerabilities passed in. Each ignore
   * pattern is an array of packages and versions, forming a path through the dependency graph. See
   * `Builder.ignoreVulnerabilities` for details.
   */
  protected filterIgnoredVulnerabilities(vulnerabilities: Vulnerability[], ignorePatterns: string[][]): Vulnerability[] {
    return vulnerabilities.filter((vulnerability) => {
      return !ignorePatterns.find((ignorePattern) => {
        let ignorePatternStart = ignorePattern[0].split('@');
        let potentialMatch = dropWhile(vulnerability.path, (dependency: string) => {
          let [ name, version ] = dependency.split('@');
          return !(name === ignorePatternStart[0] && semver.satisfies(version, ignorePatternStart[1]));
        });
        let matchingSequence = takeWhile(potentialMatch, (dependency, i) => {
          let [ name, version ] = dependency.split('@');
          if (!ignorePattern[i]) {
            return false;
          }
          let ignorePatternPart = ignorePattern[i].split('@');
          return name === ignorePatternPart[0] && semver.satisfies(version, ignorePatternPart[1]);
        });
        return potentialMatch.length > 0 && matchingSequence.length === ignorePattern.length;
      });
    });
  }

  /**
   * Print out a humanized warning message for the given vulnerability.
   */
  protected printVulnerability(vulnerability: Vulnerability) {
    let dependencyPath = vulnerability.path.join(' => ');
    let module = `*** ${ vulnerability.module }@${ vulnerability.version } ***`;
    let recommendation = (vulnerability.recommendation || '').replace(/\n/g, ' ');
    let message = dedent`${ chalk.bold.yellow(module) }
                          Found in: ${ dependencyPath }
                          Recommendation: ${ chalk.reset.cyan(recommendation) }`;
    ui.warn(message);
  }

}
