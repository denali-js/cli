import * as path from 'path';
import * as rimraf from 'rimraf';
import printSlowNodes from 'broccoli-slow-trees';
import { sync as copyDereferenceSync } from 'copy-dereference';
import * as createDebug from 'debug';
import { sync as glob } from 'glob';
import * as NestedError from 'nested-error-stacks';
import Builder, { BuilderOptions } from './builders/base';
import Watcher from './watcher';
import ui from './ui';
import spinner from './spinner';
import startTimer from './timer';

const debug = createDebug('denali-cli:project');

export interface ProjectOptions {
  dir?: string;
  docs?: true;
  environment?: string;
  printSlowTrees?: true;
}

export interface WatchOptions {
  builder?: Builder;
  destDir?: string;
  afterBuild?(project: Project): void;
  beforeRebuild?(): Promise<void> | void;
}

/**
 * The Project class represents a complete, self contained, root directory for
 * a Denali project (an app or an addon). The Project class exposes three
 * primary APIs:
 *
 *   1. **`build()`** performs a one-off build of the project, returning a promise
 *      that resolves when the build is complete.
 *   2. **`watch()`** builds the project, then watches the source directories for
 *      changes, rebuilding when detected
 *   3. **`createApplicationInstance()`** builds the project, then sets up an
 *      instance of the application in-memory, but without starting any of the
 *      network protocols. This is useful for commands like `console` or `routes`,
 *      which need to access to the Denali runtime environment, but without the
 *      overhead of starting the actual server.
 *
 * The Project class doesn't directly build the app/addon. Instead, it delegates to
 * the appropriate Builder class (AppBuilder/AddonBuilder), which in turn creates
 * AddonBuilders for any child addons in the dependency graph, and so on.
 *
 * @module denali-cli
 */

export default class Project {

  /**
   * The root dir of the project's package
   */
  dir: string;

  /**
   * The build target environment, defaults to 'development'
   */
  environment: string;

  /**
   * The package.json for this project's package
   */
  pkg: any;

  /**
   * Should the project print out the slowest parts of the build upon completion?
   */
  printSlowTrees: boolean;

  builderOptions: BuilderOptions;

  /**
   * Creates an instance of Project
   */
  constructor(options: ProjectOptions = {}) {
    this.dir = options.dir || process.cwd();
    debug(`creating project for ${ this.dir }`);
    this.environment = options.environment || 'development';
    this.builderOptions = {
      environment: this.environment,
      docs: options.docs
    };
    this.printSlowTrees = options.printSlowTrees;
    this.pkg = require(path.join(this.dir, 'package.json'));
  }

  get isAddon() {
    return this.pkg.keywords && this.pkg.keywords.includes('denali-addon');
  }

  // TODO build descriptions
  async _build(tree: any, destDir: string): Promise<void> {
    try {
      debug('building project');
      let timer = startTimer();
      spinner.start(`Building ...`);
      const Broccoli = require('broccoli').Builder;
      let broccoli = new Broccoli(tree);
      let results = await broccoli.build();
      this.finishBuild(results, destDir);
      debug('project build finished');
      spinner.succeed(`${ this.pkg.name } build complete (${ timer.stop() }s)`);
    } catch (err) {
      spinner.fail('Build failed');
      let failureMessage = 'Project failed to build';
      if (err.file) {
        failureMessage += ` (${ err.file })`;
      }
      throw new NestedError(failureMessage, err);
    }
  }

  async build(destDir: string = path.join(this.dir, 'dist')) {
    let builder = Builder.createFor(this.dir, this.builderOptions);
    let tree = builder.toTree();
    return this._build(tree, destDir);
  }

  async buildDummy(destDir: string = path.join(this.dir, 'dist')) {
    let builder = Builder.createFor(path.join(this.dir, 'test', 'dummy'), this.builderOptions);
    let tree = builder.toTree();
    return this._build(tree, destDir);
  }

  /**
   * Build the project and start watching the source files for changes, rebuilding when they occur
   */
  async _watch(tree: any, options: WatchOptions = {}) {
    spinner.start(`Watching ...`);
    let timer = startTimer();
    const Broccoli = require('broccoli').Builder;
    let broccoli = new Broccoli(tree);
    let watcher = new Watcher(broccoli, { beforeRebuild: options.beforeRebuild, interval: 100 });
    let destDir = options.destDir || path.join(this.dir, 'dist');

    // Handle watcher events
    watcher.on('buildstart', async () => {
      debug('changes detected, rebuilding');
      timer = startTimer();
      spinner.start(`Building ${ this.pkg.name }`, this.pkg.name);
    });
    watcher.on('change', async (results: { directory: string, graph: any }) => {
      debug('rebuild finished, wrapping up');
      this.finishBuild(results, destDir);
      spinner.succeed(`${ this.pkg.name } build complete (${ timer.stop() }s)`, this.pkg.name);
      options.afterBuild(this);
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

  async watch(options: WatchOptions = {}) {
    let builder = Builder.createFor(this.dir, this.builderOptions);
    let tree = builder.toTree();
    return this._watch(tree, options);
  }

  async watchDummy(options: WatchOptions = {}) {
    let builder = Builder.createFor(path.join(this.dir, 'test', 'dummy'), this.builderOptions);
    let tree = builder.toTree();
    return this._watch(tree, options);
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
  async createApplication(): Promise<any> {
    try {
      await this.build();
      let bundlePath = glob(path.join(this.dir, 'dist', '*.bundle.js'))[0];
      let bundle = require(bundlePath);
      let container = bundle();
      let Application = container.lookup('app:application');
      return new Application(container.loader, { environment: this.environment });
    } catch (error) {
      throw new NestedError('Failed to create application', error);
    }
  }

  /**
   * After a build completes, this method cleans up the result. It copies the results out of tmp and
   * into the output directory, and kicks off any optional behaviors post-build.
   */
  finishBuild(results: { directory: string, graph: any }, destDir: string) {
    debug(`copying broccoli build output to dist`);
    rimraf.sync(destDir);
    copyDereferenceSync(path.resolve(results.directory), destDir);
    if (this.printSlowTrees) {
      printSlowNodes(results.graph);
    }
  }

}
