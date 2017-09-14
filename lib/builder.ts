import {
  upperFirst
} from 'lodash';
import * as fs from 'fs';
import * as path from 'path';
import * as Funnel from 'broccoli-funnel';
import * as MergeTree from 'broccoli-merge-trees';
import { sync as readPkg } from 'read-pkg';
import PackageTree from './package-tree';
import EjectTree from './eject-tree';
import Project from './project';
import * as createDebug from 'debug';
import findPlugins, { PluginSummary } from 'find-plugins';

const debug = createDebug('denali-cli:builder');

// Because it's nice to have a named type for this
// tslint:disable-next-line:no-empty-interface
export interface Tree {}

export interface TreeForMethod {
  (dir: string): string | Tree;
}

/**
 * The Builder class is responsible for taking a Denali package (an app or an addon), and performing
 * any build steps necessary to produce the final, compiled output. Often times this includes
 * transpiling, precompiling template files, etc. The base Builder class also performs some basic
 * copying of package files (package.json, Readme, etc).
 *
 * Projects can define their own Builder in `/denali-build.js`, which can customize how the package
 * is built via the `processSelf` hook. Addon Builders can also contribute to their parent package's
 * build via the processParent() hook, allowing for purely build-related addons like denali-babel or
 * denali-typescript
 *
 * @export
 * @class Builder
 * @module denali-cli
 */
export default class Builder {

  /**
   * An internal cache that maps real disk locations to Builder instances. This lets us accurately
   * model the deeply nested and even circular dependencies of an app's addon graph, but take
   * advantage of npm/yarn flattening by only using one Builder instance per disk location.
   */
  public static buildersCache: { [dir: string]: Builder } = {};

  /**
   * A factory method that checks for a local Builder class in `/denali-build.js`, and instantiates
   * that if present.
   */
  public static createFor(dir: string, project: Project, parentBuilder: Builder, preseededAddons?: string[]): Builder {
    if (!this.buildersCache[dir]) {
      // Use the local denali-build.js if present
      let denaliBuildPath = path.join(dir, 'denali-build');
      if (fs.existsSync(`${ denaliBuildPath }.js`)) {
        let LocalBuilderModule = require(denaliBuildPath);
        let LocalBuilder: typeof Builder = LocalBuilderModule.default || LocalBuilderModule;
        this.buildersCache[dir] = new LocalBuilder(dir, project, parentBuilder, preseededAddons);
      } else {
        this.buildersCache[dir] = new this(dir, project, parentBuilder, preseededAddons);
      }
    }
    return this.buildersCache[dir];
  }

  /**
   * Denali automatically checks the Node Security Project for any vulnerabilities in your app's
   * dependencies. Sometimes it will pick up vulnerabilities that you want to ignore, i.e. a
   * vulnerability in a package that is only used at build time.
   *
   * This array defines a blacklist of vulnerabilities to ignore. Each entry is an array that
   * describes the path through the dependency graph. Any vulnerabilities from that point and
   * farther down the graph will be ignored.
   *
   * So for example, if your dependencies include:
   *
   *   foo@1.2.3
   *     bar@4.5.6
   *       buzz@7.8.9
   *
   * Then adding `[ 'foo', 'bar@~4.2.1' ]` would ignore any vulnerabilities from the "bar" package
   * (as long as the version of "bar" satisfied "~4.2.1"), as well as any vulnerabilities from
   * "buzz"
   */
  public ignoreVulnerabilities: string[][] = [
    [ 'broccoli@*' ],
    [ 'jscodeshift@*' ]
  ];

  /**
   * A list of files that should be copied as-is into the final build
   */
  public packageFiles: string[] = [
    'package.json'
  ];

  /**
   * A list of directories that should be copied as-is into the final build
   */
  public packageDirs: string[] = [];

  /**
   * The dist directory potentially containing the compiled package that should be built.
   */
  public distDir: string;

  /**
   * The directory containing the package to be built.
   */
  public pkgDir: string;

  /**
   * The package.json for this package
   */
  public pkg: any;

  /**
   * The Project instance that represents the root package being built
   */
  public project: Project;

  /**
   * A list of directories containing addons that are children to this package
   */
  public addons: PluginSummary[];

  /**
   * An array of builder instances for child addons of this package
   */
  public childBuilders: Builder[];

  /**
   * Modify the build of the parent package that is consuming this addon.
   *
   * @param tree the tree representing the parent package
   * @param dir the absolute path to the parent package source
   */
  public processParent: (tree: Tree, dir: string) => Tree;

  /**
   * Modify this package's build
   *
   * @param tree the tree representing the package
   * @param dir the absolute path to the package source
   */
  public processSelf: (tree: Tree, dir: string) => Tree;

  /**
   * Cached instance of build tree. We cache this in case the same builder gets toTree() invoked
   * more than once, due to appearring in child addons multiple times.
   */
  public tree: Tree;

  public parentBuilder: Builder;

  protected addonsUnderTest: string[];

  /**
   * Creates an instance of Builder for the given directory, as a child of the given Project. If
   * addonsUnderTest are supplied, they will be included as child addons of this Builder instance.
   */
  constructor(pkgDir: string, project: Project, parentBuilder: Builder, addonsUnderTest: string[] = []) {
    let relativeBuilderPath = path.relative(project.dir, pkgDir);
    debug(`creating builder for ${ relativeBuilderPath === '' ? 'project root' : relativeBuilderPath }`);

    this.pkgDir = pkgDir;
    this.pkg = readPkg(pkgDir);
    this.distDir = this.pkg.mainDir ? path.join(this.pkgDir, this.pkg.mainDir) : this.pkgDir;
    this.project = project;
    this.parentBuilder = parentBuilder;
    this.addonsUnderTest = addonsUnderTest;
    this.addons = findPlugins({
      dir: this.distDir,
      keyword: 'denali-addon',
      sort: true,
      includeDev: true,
      configName: 'denali',
      include: addonsUnderTest
    });
  }

  /**
   * If true, when the root Project is built, it will create a child Project for this package,
   * which will watch for changes and trigger a rebuild of this package as well as the root Project.
   */
  public isDevelopingAddon() { return false; } // tslint:disable-line

  /**
   * Return a single broccoli tree that represents the completed build output for this package
   */
  public toTree(): Tree {
    if (!this.tree) {
      let tree = this._prepareSelf();

      // Find child addons
      this.childBuilders = this.addons.map((addon) => Builder.createFor(addon.dir, this.project, this));

      let childTrees: Tree[] = [];
      this.childBuilders.forEach((builder) => {
        if (builder.needsCompile && builder.needsCompile() || this.addonsUnderTest.includes(builder.pkgDir)) {
          debug(`adding ${ builder.pkg.name } to build queue for on-the-fly compilation`);
          // TODO these aren't caching properly, not being reused
          childTrees.push(this.compileChildBuilder(builder));
        } else {
          debug(`${ builder.pkg.name } is precompiled, using that`);
        }

        // Run processParent hooks
        if (builder.processParent) {
          tree = builder.processParent(tree, this.pkgDir);
        }
      });
      let combinedChildTree = new MergeTree(childTrees);
      tree = new MergeTree([ combinedChildTree, tree ], { overwrite: true });

      // Run processSelf hooks
      if (this.processSelf) {
        tree = this.processSelf(tree, this.pkgDir);
      }

      let unbuiltTrees: Tree[] = [];
      this.packageDirs.forEach((dir) => {
        if (fs.existsSync(path.join(this.pkgDir, dir))) {
          unbuiltTrees.push(new Funnel(path.join(this.pkgDir, dir), { destDir: dir }));
        }
      });
      if (unbuiltTrees.length > 0) {
        tree = new MergeTree(unbuiltTrees.concat(tree), { overwrite: true });
      }

      this.tree = tree;
    }

    return this.tree;
  }

  /**
   * Checks if the this package is precompiled. You can override this to force on-the-fly
   * compliation of this addon, but this is generally *not* recommended.
   */
  public needsCompile(): boolean {
    let isDeveloping = this.isDevelopingAddon();
    let isSymlinkedNodeModule = false;
    try {
      isSymlinkedNodeModule = fs.lstatSync(path.join(this.project.dir, 'node_modules', this.pkg.name)).isSymbolicLink();
    } catch (e) { /* file might not exist at all */ }
    let isMissingCompiledOutput = !fs.existsSync(this.distDir);

    return isDeveloping || isSymlinkedNodeModule || isMissingCompiledOutput;
  }

  /**
   * Takes a builder instance for a child addon that isn't precompiled and
   * build it into the special `__child_addons__` folder in our output. We also
   * write the original location of the addon to a file in output, so we can
   * later move the compiled output to the original source location once the
   * broccoli build finishes.
   */
  protected compileChildBuilder(builder: Builder): Tree {
    let childTree = builder.toTree();
    return new EjectTree(childTree, builder.distDir);
  }

  /**
   * Returns an array of top-level directories within this package that should go through the build
   * process. Note that top-level files cannot be built. You can include them (unbuilt) in the final
   * output via the `packageFiles` property; see https://github.com/broccolijs/broccoli/issues/173#issuecomment-47584836
   */
  public sourceDirs(): string[] {
    let dirs = [ 'app', 'blueprints', 'commands', 'config', 'lib' ];
    if (this.project.environment === 'test') {
      dirs.push('test');
    }
    return dirs;
  }

  /**
   * Generic treeFor method that simply returns the supplied directory as is. You could override
   * this to customize the build process for all files.
   */
  public treeFor(dir: string): string | Tree {
    return dir;
  }

  /**
   * Compiles the base build tree which will be passed to the user-defined build hooks. Grabs all
   * the top-level directories to be built, runs the treeFor hooks on each, adds package files
   */
  private _prepareSelf(): Tree {
    // Get the various source dirs we'll use. This is important because broccoli
    // cannot pick files at the root of the project directory.
    let dirs = this.sourceDirs();

    // Give any subclasses a chance to override the source directories by defining
    // a treeFor* method
    let sourceTrees = dirs.map((dir) => {
      let treeFor = <TreeForMethod>(<any>this)[`treeFor${ upperFirst(dir) }`] || this.treeFor;
      let tree = treeFor.call(this, path.join(this.pkgDir, dir));
      if (typeof tree !== 'string' || fs.existsSync(tree)) {
        return new Funnel(tree, { annotation: dir, destDir: dir });
      }
      return false;
    }).filter(Boolean);

    // Copy top level files into our build output (this special tree is
    // necessary because broccoli can't pick a file from the root dir).
    sourceTrees.push(new PackageTree(this, { files: this.packageFiles }));

    // Combine everything into our unified source tree, ready for building
    return new MergeTree(sourceTrees, { overwrite: true });
  }

  public buildDescription(): string {
    let activeChildBuilders = this.childBuilders.filter((builder) => builder.tree);
    let description = this.pkg.name;
    if (activeChildBuilders.length > 0) {
      description += ` (including ${ activeChildBuilders.map((b) => b.pkg.name).join(', ') } on the fly)`;
    }
    return description;
  }

}
