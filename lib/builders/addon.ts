import * as path from 'path';
import * as fs from 'fs';
import { template, camelCase } from 'lodash';
import { Tree } from 'broccoli';
import BaseBuilder from './base';
import Concat from '../trees/concat';
import EjectTree from '../trees/eject';
// import { debug } from 'broccoli-stew';


const bundleFragmentOpen = template(fs.readFileSync(path.join(__dirname, '..', 'templates', 'bundle-fragment-open.ejs'), 'utf-8'));
const bundleFragmentClose = fs.readFileSync(path.join(__dirname, '..', 'templates', 'bundle-fragment-close.ejs'), 'utf-8');

export default class AddonBuilder extends BaseBuilder {

  /**
   * Is this addon currently under test?
   */
  underTest = false;

  processParent: (tree: Tree, dir: string) => Tree;

  // Addons don't run their own tests directly - the dummy app does
  bundledSources(): string[] {
    return [ 'app', 'config', 'lib' ];
  }

  assembleTree(): Tree {
    if (!this.shouldBuild()) {
      this.debug('no build needed, using precompiled');
      return path.join(this.dir, 'dist');
    }
    this.debug('building');

    let tree = super.assembleTree();

    // Denali supports building addons on-the-fly. This is useful if you are
    // developing an addon and have it symlinked into an app for testing, or if
    // you include an addon via a git repo dependency (which means you won't get
    // the built result, since addons don't check their compiled versions into
    // source control).
    //
    // To optimize this process, Denali uses EjectTrees to take the result of
    // the on-the-fly compilation and "eject" it out to wherever the addon
    // source was read from. This means that if you have, for example, a git dep
    // addon, Denali will build it the first time you build your app, eject the
    // addon's compiled result to the addon's source folder in node_modules, and
    // then re-use that on subsequent builds.
    if (this.shouldEject()) {
      let ejectDestination = path.join(this.dir, 'dist');
      tree = new EjectTree(tree, ejectDestination, { tee: true });
    }

    return tree;
  }

  /**
   * This method basically describes the scenarios in which an addon will build
   * (i.e. `shouldBuild()` returns true), but should not eject (return false
   * here).
   *
   * There are two scenarios where an addon should build but not eject:
   *
   * 1. It's the root builder (i.e. you run `$ denali build` in an addon). The
   *    regular build process will handle landing everything in dist.
   * 2. It's the addon under test. The dummy app will land a copy of the compiled
   *    addon in the dummy app's node_modules/<addon name> folder.
   *
   * For (2), it might seem okay to eject, but there are two problems:
   *
   * 1. The compiled dummy app inside `tmp/-dummy` can't lookup the addon
   *    two directories up normally.
   * 2. If you run multiple command acceptance tests that build their copies
   *    of the dummy app, they would each try to eject back to the project
   *    root, resulting in race conditions as each tries to read/write to
   *    the same top level `dist/` directory simultaneously.
   *
   * TODO: if you have more than one app symlinking in the same addon, you'll
   * end up with race conditions here if you have both app's servers running and
   * make a change to the shared addon. Each app's server will try to rebuild
   * and re-eject the shared addon, likely at the same time, resulting in race
   * conditions.
   */
  shouldEject() {
    let isRootBuilder = !this.parent;
    let isAddonUnderTest = this.underTest;
    return !isRootBuilder && !isAddonUnderTest;
  }

  shouldBuild(): boolean {
    let isRootBuilder = !this.parent;
    let isDeveloping = this.isDevelopingAddon();
    let isAddonUnderTest = this.underTest;
    let isSymlinked = false;
    try {
      isSymlinked = fs.lstatSync(this.dir).isSymbolicLink();
    } catch (e) { /* file might not exist at all */ }
    let isMissingCompiledOutput = !fs.existsSync(path.join(this.dir, 'dist'));

    this.debug(`is root builder: ${ isRootBuilder }; is developing: ${ isDeveloping }; is addon under test: ${ isAddonUnderTest }; is symlinked: ${ isSymlinked }; is not compiled: ${ isMissingCompiledOutput }`);
    return isRootBuilder || isDeveloping || isAddonUnderTest || isSymlinked || isMissingCompiledOutput;
  }

  isDevelopingAddon(): boolean {
    return false;
  }

  bundle(tree: Tree): Tree {
    let data = {
      fragmentName: camelCase(this.pkg.name),
      pkgName: this.pkg.name,
      version: this.pkg.version
    };
    tree = new Concat(tree, {
      main: this.pkg.main,
      header: bundleFragmentOpen(data),
      footer: bundleFragmentClose,
      wrapAsModules: true,
      outputFile: `${ this.pkg.name }.fragment.js`,
      baseDir: this.dir
    });
    return tree;
  }

  unitTestBundleName() {
    return this.parent.pkg.name;
  }

}
