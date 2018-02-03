import * as path from 'path';
import * as fs from 'fs';
import * as Funnel from 'broccoli-funnel';
import findPlugins from 'find-plugins';
import { Tree } from 'broccoli';
import * as MergeTree from 'broccoli-merge-trees';
import * as writeFile from 'broccoli-file-creator';
import { sync as readPkg } from 'read-pkg';
import AddonBuilder from './addon';
import globify from '../utils/globify';
import UnitTests from '../trees/unit-tests';
import * as createDebug from 'debug';
// import { debug } from 'broccoli-stew';

const debug = createDebug('denali-cli:builder');

export default class BaseBuilder {

  /**
   * Creates the appropriate builder instance for the given directory.
   *
   * @param dir
   * @param environment
   * @param parent
   */
  static createFor(dir: string, environment: string, parent?: BaseBuilder): BaseBuilder {
    debug(`creating builder for ${ dir }`);
    let localBuilderPath = path.join(dir, 'denali-build');
    let Builder: typeof BaseBuilder;
    // Use the local denali-build.js file if present
    if (fs.existsSync(localBuilderPath + '.js')) {
      let LocalBuilderModule = require(localBuilderPath);
      Builder = LocalBuilderModule.default || LocalBuilderModule;
      debug('using local builder');
    // Dummy apps
    } else if (path.basename(dir) === 'dummy') {
      Builder = require('./dummy').default;
      debug('using default dummy builder');
    } else {
      let pkg = readPkg(dir);
      // Addons
      if (pkg.keywords && pkg.keywords.includes('denali-addon')) {
        Builder = require('./addon').default;
        debug('using default addon builder');
      // Apps
      } else {
        Builder = require('./app').default;
        debug('using default app builder');
      }
    }
    return new Builder(dir, environment, parent);
  }

  dir: string;

  environment: string;

  parent: BaseBuilder;

  addons: AddonBuilder[];

  pkg: any;

  ejections: Map<string, Tree[]> = new Map();

  processSelf: (tree: Tree, dir: string) => Tree;

  unitTestDir = path.join('test', 'unit');

  packageFiles = [ 'package.json' ];

  private _cachedTree: Tree;

  protected debug: (msg: string) => void;

  get logicalDependencyPath() {
    let builder: BaseBuilder = this;
    let depPath = [ builder.pkg.name ];
    while (builder = builder.parent) {
      depPath.unshift(builder.pkg.name);
    }
    return depPath;
  }

  constructor(dir: string, environment: string, parent: BaseBuilder) {
    this.dir = dir;
    this.environment = environment;
    this.parent = parent;
    this.pkg = readPkg(dir);

    this.debug = createDebug(`denali-cli:builder:${ this.logicalDependencyPath.join('>') }`);
    this.debug(`created builder for ${ this.pkg.name }@${ this.pkg.version }`);

    this.addons = this.discoverAddons();
  }

  /**
   * Look for addons in the node_modules folder. Only search packages explicitly
   * mentioned in package.json, and look for the `denali-addon` keyword in their
   * package.json's. Then create a Builder for each one.
   */
  protected discoverAddons(): AddonBuilder[] {
    this.debug(`searching for child addons in ${ this.dir }`);
    return findPlugins({
      dir: this.dir,
      keyword: 'denali-addon',
      sort: true,
      includeDev: !this.parent, // only include devdeps if this is the root builder
      configName: 'denali'
    }).map((addon) => {
      this.debug(`discovered child addon: ${ addon.pkg.name }`);
      return <AddonBuilder>BaseBuilder.createFor(addon.dir, this.environment, this);
    });
  }

  /**
   * Which directories should be considered "source" directories to be fed into
   * the main build pipeline?
   */
  protected sources(): (string | Tree)[] {
    let dirs = [ 'app', 'config', 'lib', 'blueprints', 'commands', 'config', 'test' ];
    return dirs;
  }

  /**
   * Which directories should be bundled into runtime bundles/fragments?
   */
  protected bundledSources(): string[] {
    let dirs = [ 'app', 'config', 'lib' ];
    return dirs;
  }

  /**
   * Assemble the main build pipeline
   */
  assembleTree() {
    let baseTree = this.toBaseTree();
    let finalTrees: Tree[] = [];

    let compiledTree = this.compile(baseTree);
    finalTrees.push(compiledTree);

    let bundleTree = new Funnel(compiledTree, {
      include: globify(this.bundledSources()),
      annotation: 'combined tree (bundled files)'
    });
    bundleTree = this.bundle(bundleTree);
    finalTrees.push(bundleTree);

    if (this.environment === 'test') {
      this.debug('including unit tests in output');
      let unitTestsTree = this.compileUnitTests(compiledTree);
      finalTrees.push(unitTestsTree);
    }

    finalTrees.push(this.packageFilesTree());

    let tree = new MergeTree(finalTrees, { overwrite: true });

    return tree;
  }

  /**
   * Create trees that copy top level files over. Broccoli can't pick up
   * top level files one-off, because Broccoli can't do one-off files.
   * Which means Broccoli would have to watch the root directory, which
   * includes the tmp directory where intermediate build steps are stored,
   * resulting in an infinite loop (watch triggers build, touches tmp,
   * triggers watch).
   */
  packageFilesTree() {
    let files = this.packageFiles;
    return new MergeTree(files.map((filepath) => {
      let sourcepath = path.join(this.dir, filepath);
      return writeFile(filepath, fs.readFileSync(sourcepath, 'utf-8'));
    }));
  }

  /**
   * Compile the unit tests - see UnitTestsTree for more details
   */
  compileUnitTests(compiledTree: Tree) {
    let unitTestsTree = new Funnel(compiledTree, {
      include: globify([this.unitTestDir]),
      annotation: 'unit tests'
    });
    return new UnitTests(unitTestsTree, {
      bundleName: this.unitTestBundleName(),
      baseDir: this.dir,
      sourceRoot: this.unitTestDir
    });
  }

  unitTestBundleName() {
    return this.pkg.name;
  }

  /**
   * Wrapper method over assembleTree, used to cache the results
   */
  toTree() {
    if (!this._cachedTree) {
      this._cachedTree = this.assembleTree();
    }
    return this._cachedTree;
  }

  /**
   * Create a single base tree from the source directories. Multiple
   * consumers can use this base tree to ensure deduplication of the
   * starting point.
   */
  protected toBaseTree(): Tree {
    let sources = this.sources();
    this.debug(`creating base tree from: ${ sources.map((s) => `${s}/`).join(',') }`);
    sources = sources.map((dir) => {
      if (typeof dir === 'string') {
        let localpath = path.join(this.dir, dir);
        if (fs.existsSync(localpath)) {
          return new Funnel(localpath, { destDir: dir });
        }
        return false;
      }
      return dir;
    }).filter(Boolean);
    return new MergeTree(sources, { overwrite: true, annotation: 'baseTree' });
  }

  /**
   * Compile the project. Defaults to running the process* hooks, but
   * can be extended to do more.
   */
  protected compile(tree: Tree): Tree {
    this.debug('compiling');
    tree = this.processHooks(tree);
    return tree;
  }

  /**
   * Run processSelf and processParent hooks
   */
  protected processHooks(tree: Tree): Tree {
    this.debug('running hooks');
    if (this.processSelf) {
      this.debug('running processSelf');
      tree = this.processSelf(tree, this.dir);
    }
    this.addons.forEach((addonBuilder) => {
      if (addonBuilder.processParent) {
        this.debug(`running processParent hook from ${ addonBuilder.pkg.name }`);
        tree = addonBuilder.processParent(tree, this.dir);
      }
    });
    return tree;
  }

  bundle(tree: Tree): Tree {
    throw new Error('Bundle method not implemented!');
  }

}
