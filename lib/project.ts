import {
  noop,
  dropWhile,
  takeWhile
} from 'lodash';
import * as path from 'path';
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
   * The root Builder instance that represent's the Project's own package
   */
  protected rootBuilder: Builder;

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
  }

  /**
   * Is this Project instance for an addon?
   */
  protected get isAddon(): boolean {
    return this.pkg.keywords && this.pkg.keywords.includes('denali-addon');
  }

  /**
   * Get the root builder and it's tree for this Project. Also returns the broccoli.Builder instance
   * based on the root tree
   */
  protected getBuilderAndTree(): { builder: Builder, tree: Tree, broccoliBuilder: any } {
    let rootBuilder = this.rootBuilder = Builder.createFor(this.dir, this);
    let rootTree = rootBuilder.toTree();

    if (this.isAddon && this.buildDummy) {
      rootTree = this.buildDummyTree(rootTree);
    }

    let broccoliBuilder = new broccoli.Builder(rootTree);
    // tslint:disable-next-line:completed-docs
    function onExit() {
      broccoliBuilder.cleanup();
      process.exit(1);
    }
    process.on('SIGINT', onExit);
    process.on('SIGTERM', onExit);

    debug(`building ${ this.pkg.name }`);
    return {
      builder: rootBuilder,
      tree: rootTree,
      broccoliBuilder
    };
  }

  /**
   * Given the root tree for this project, return the dummy app's tree. This creates a Builder for
   * the dummy app itself, plus moves the addon's test suite into the dummy app's tree.
   */
  protected buildDummyTree(rootTree: Tree): Tree {
    debug(`building ${ this.pkg.name }'s dummy app`);
    let dummyBuilder = Builder.createFor(path.join(this.dir, 'test', 'dummy'), this, [ this.dir ]);
    let dummyTree = dummyBuilder.toTree();
    let addonTests = new Funnel(rootTree, {
      include: [ 'test/**/*' ],
      exclude: [ 'test/dummy/**/*' ]
    });
    rootTree = new Funnel(rootTree, {
      exclude: [ 'test/**/*' ],
      destDir: path.join('node_modules', this.pkg.name)
    });
    return new MergeTree([ rootTree, dummyTree, addonTests ], { overwrite: true });
  }

  /**
   * Build the project and return a Promise that resolves with the output directory once the build
   * is complete.
   */
  public async build(outputDir: string = 'dist'): Promise<string> {
    debug('building project');
    let { broccoliBuilder, builder } = this.getBuilderAndTree();
    await spinner.start(`Building ${ builder.buildDescription() }`);
    let timer = startTimer();
    try {
      let results = await broccoliBuilder.build();
      debug('broccoli build finished');
      this.finishBuild(results, outputDir);
      debug('build finalized');
      await spinner.succeed(`${ this.pkg.name } build complete (${ timer.stop() }s)`);
    } catch (err) {
      await spinner.fail('Build failed');
      if (err.file) {
        throw new NestedError(`Build failed on file: ${ err.file }`, err);
      }
      throw new NestedError('Project failed to build', err);
    } finally {
      await broccoliBuilder.cleanup();
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
    let { broccoliBuilder, builder } = this.getBuilderAndTree();
    await spinner.start(`Building ${ builder.buildDescription() }`);
    let watcher = new Watcher(broccoliBuilder, { beforeRebuild: options.beforeRebuild, interval: 100 });

    let spinnerStart: Promise<void>;

    // Handle watcher events
    watcher.on('buildstart', async () => {
      debug('changes detected, rebuilding');
      timer = startTimer();
      spinnerStart = spinner.start(`Building ${ this.pkg.name }`, this.pkg.name);
      await spinnerStart;
    });
    watcher.on('change', async (results: { directory: string, graph: any }) => {
      debug('rebuild finished, wrapping up');
      this.finishBuild(results, options.outputDir);
      await spinnerStart;
      await spinner.succeed(`${ this.pkg.name } build complete (${ timer.stop() }s)`, this.pkg.name);
      spinnerStart = null;
      options.onBuild(this);
    });
    watcher.on('error', async (error: any) => {
      await spinnerStart;
      await spinner.fail('Build failed', this.pkg.name);
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
    if (!path.isAbsolute(buildResultDir)) {
      buildResultDir = path.resolve(buildResultDir);
    }

    rimraf.sync(destDir);
    copyDereferenceSync(buildResultDir, destDir);
  }

  /**
   * Run the package.json through nsp to check for any security vulnerabilities, hiding any that
   * match the root builder's `ignoreVulnerabilities` array.
   */
  protected auditPackage() {
    let pkg = path.join(this.dir, 'package.json');
    nsp.check({ package: pkg }, (err: any, vulnerabilities: Vulnerability[]) => {
      if (err && [ 'ENOTFOUND', 'ECONNRESET' ].indexOf(err.code) > -1) {
        ui.warn('Error trying to scan package dependencies for vulnerabilities with nsp, unable to reach server. Skipping scan ...');
        ui.warn(err);
      }
      if (vulnerabilities && vulnerabilities.length > 0) {
        vulnerabilities = this.filterIgnoredVulnerabilities(vulnerabilities, this.rootBuilder.ignoreVulnerabilities);
        if (vulnerabilities.length > 0) {
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
