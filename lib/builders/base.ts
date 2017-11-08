import * as path from 'path';
import * as fs from 'fs';
import * as Funnel from 'broccoli-funnel';
import findPlugins from 'find-plugins';
import { Tree } from 'broccoli';
import * as MergeTree from 'broccoli-merge-trees';
import { sync as readPkg } from 'read-pkg';
// import { uniq } from 'lodash';
import AddonBuilder from './addon';
import EjectTree from '../trees/eject';
import AppBuilder from './app';
import globify from '../utils/globify';
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

  protected sources(): string[] {
    let dirs = [ 'app', 'config', 'lib', 'blueprints', 'commands', 'config' ];
    if (this.environment === 'test') {
      dirs.push('test');
    }
    return dirs;
  }

  protected bundledSources(): string[] {
    let dirs = [ 'app', 'config', 'lib' ];
    if (this.environment === 'test') {
      dirs.push('test');
    }
    return dirs;
  }

  toTree() {
    let tree = this.toBaseTree();
    tree = this.compile(tree);

    let bundleTree = new Funnel(tree, {
      include: globify(this.bundledSources()),
      annotation: 'combined tree (bundled files)'
    });
    bundleTree = this.bundle(bundleTree);
    tree = new MergeTree([tree, bundleTree]);

    return this.mergeEjections(tree);
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
    sources = sources.filter((dir) => typeof dir !== 'string' || fs.existsSync(path.join(this.dir, dir)));
    sources = sources.map((dir) => {
      if (typeof dir === 'string') {
        return new Funnel(path.join(this.dir, dir), { destDir: dir });
      }
      return dir;
    });
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
