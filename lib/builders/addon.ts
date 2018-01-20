import * as path from 'path';
import * as fs from 'fs';
import { template, camelCase } from 'lodash';
import { Tree } from 'broccoli';
import BaseBuilder from './base';
import Concat from '../trees/concat';
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
    let precompiledTree = this.precompiledTree();
    if (precompiledTree) {
      return precompiledTree;
    }
    return super.assembleTree();
  }

  needsCompilation(): boolean {
    let isRootBuilder = !this.parent;
    let isDeveloping = this.isDevelopingAddon();
    let isAddonUnderTest = this.underTest;
    let isSymlinked = false;
    try {
      isSymlinked = fs.lstatSync(this.dir).isSymbolicLink();
    } catch (e) { /* file might not exist at all */ }
    let isMissingCompiledOutput = !fs.existsSync(path.join(this.dir, 'dist'));

    return isRootBuilder || isDeveloping || isAddonUnderTest || isSymlinked || isMissingCompiledOutput;
  }

  precompiledTree(): Tree | false {
    return !this.needsCompilation() && path.join(this.dir, 'dist');
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
