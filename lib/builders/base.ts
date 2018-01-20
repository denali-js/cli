import * as path from 'path';
import * as fs from 'fs';
import * as Funnel from 'broccoli-funnel';
import findPlugins from 'find-plugins';
import { Tree } from 'broccoli';
import * as MergeTree from 'broccoli-merge-trees';
import { sync as readPkg } from 'read-pkg';
import AddonBuilder from './addon';
import EjectTree from '../trees/eject';
import AppBuilder from './app';
import globify from '../utils/globify';
import UnitTests from '../trees/unit-tests';
// import { debug } from 'broccoli-stew';


export default abstract class BaseBuilder {

  /**
   * Creates the appropriate builder instance for the given directory.
   *
   * @param dir
   * @param environment
   * @param parent
   */
  static createFor(dir: string, environment: string, parent?: BaseBuilder): BaseBuilder {
    let localBuilderPath = path.join(dir, 'denali-build');
    let LocalBuilderModule = require(localBuilderPath);
    let LocalBuilder: typeof AddonBuilder | typeof AppBuilder = LocalBuilderModule.default || LocalBuilderModule;
    return new LocalBuilder(dir, environment, parent);
  }

  dir: string;

  environment: string;

  parent: BaseBuilder;

  addons: AddonBuilder[];

  pkg: any;

  ejections: Map<string, Tree[]> = new Map();

  processSelf: (tree: Tree, dir: string) => Tree;

  unitTestDir = path.join('test', 'unit');

  private _cachedTree: Tree;

  constructor(dir: string, environment: string, parent: BaseBuilder) {
    this.dir = dir;
    this.environment = environment;
    this.parent = parent;
    this.pkg = readPkg(dir);
    this.addons = this.discoverAddons();
  }

  protected discoverAddons(): AddonBuilder[] {
    return findPlugins({
      dir: this.dir,
      keyword: 'denali-addon',
      sort: true,
      includeDev: true,
      configName: 'denali'
    }).map((addon) => {
      return <AddonBuilder>BaseBuilder.createFor(addon.dir, this.environment, this);
    });
  }

  protected sources(): (string | Tree)[] {
    let dirs = [ 'app', 'config', 'lib', 'blueprints', 'commands', 'config', 'test' ];
    return dirs;
  }

  protected bundledSources(): string[] {
    let dirs = [ 'app', 'config', 'lib' ];
    return dirs;
  }

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
      let unitTestsTree = this.compileUnitTests(compiledTree);
      finalTrees.push(unitTestsTree);
    }

    let tree = new MergeTree(finalTrees, { overwrite: true });

    // Compiling on the fly, so eject the result. Only applies for addons really, but we
    // need to invoke it here to ensure the ejection is recorded before invoking
    // `mergeEjections`
    if (this.parent) {
      this.eject(tree, path.join(this.dir, 'dist'));
    }

    return tree;
  }

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

  toTree() {
    if (!this._cachedTree) {
      let tree = this.assembleTree();
      tree = this.mergeEjections(tree);
      this._cachedTree = tree;
    }
    return this._cachedTree;
  }

  /**
   * Takes any registered ejections and merges them into the build pipeline,
   * consolidating trees by ejection destination beforehand.
   *
   * Denali supports building addons on-the-fly. This is useful if you are
   * developing an addon and have it symlinked into an app for testing, or if
   * you include an addon via a git repo dependency (which means you won't get
   * the built result, since addons don't check their compiled versions into
   * source control).
   *
   * To optimize this process, Denali uses EjectTrees to take the result of the
   * on-the-fly compilation and "eject" it out to wherever the addon source was
   * read from. This means that if you have, for example, a git dep addon,
   * Denali will build it the first time you build your app, eject the addon's
   * compiled result to the addon's source folder in node_modules, and then
   * re-use that on subsequent builds.
   *
   * However, because the CLI might build the runtime, the devtime, or both,
   * we have to wait to insert the EjectTree into the build pipeline so that,
   * if it's both, the runtime and devtime trees don't end up overwriting each
   * other when they eject. In other words - for a given destination directory,
   * there can only be one EjectTree that ejects there (since EjectTree wipes
   * the output directory before ejecting).
   *
   * This method takes any ejections registered via `this.eject()`, and produces
   * one EjectTree per output directory, and merges those EjectTrees into the
   * build pipeline.
   *
   * @param tree the tree to merge eject trees into
   */
  protected mergeEjections(tree: Tree): Tree {
    if (this.ejections.size === 0) {
      return tree;
    }
    let ejections: Tree[] = Array.from(this.ejections).map(([ destination, ejectionTrees ]) => {
      let mergedEjectionsForDestination = new MergeTree(ejectionTrees, { overwrite: true, annotation: `merge ejections for ${ destination }` });
      return new EjectTree(mergedEjectionsForDestination, destination);
    });
    return new MergeTree(ejections.concat(tree), { overwrite: true, annotation: 'merge ejections' });
  }

  protected toBaseTree(): Tree {
    let sources = this.sources();
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

  protected compile(tree: Tree): Tree {
    tree = this.processHooks(tree);
    return tree;
  }

  protected processHooks(tree: Tree): Tree {
    if (this.processSelf) {
      tree = this.processSelf(tree, this.dir);
    }
    this.addons.forEach((addonBuilder) => {
      if (addonBuilder.processParent) {
        tree = addonBuilder.processParent(tree, this.dir);
      }
    });
    return tree;
  }

  protected eject(tree: Tree, destination: string) {
    if (!this.ejections.has(destination)) {
      this.ejections.set(destination, []);
    }
    this.ejections.get(destination).push(tree);
  }

  abstract bundle(tree: Tree): Tree;

}
