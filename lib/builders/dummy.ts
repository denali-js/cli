import * as path from 'path';
import * as fs from 'fs';
import * as assert from 'assert';
import AppBuilder from './app';
import AddonBuilder from './addon';
import * as MergeTree from 'broccoli-merge-trees';
import * as writeFile from 'broccoli-file-creator';
import * as Funnel from 'broccoli-funnel';

export default class DummyBuilder extends AppBuilder {

  packageFiles = [ 'package.json' ];
  bundleName = 'dummy';

  addonBuilderUnderTest: AddonBuilder;

  get addonDirUnderTest() {
    return path.join(this.dir, '..', '..');
  }

  discoverAddons(): AddonBuilder[] {
    let addons = super.discoverAddons({ include: [ this.addonDirUnderTest ] });
    this.flagAddonUnderTest(addons);
    return addons;
  }

  /**
   * Once we have all the addons for the dummy app, find the addon that
   * corresponds to two directories up, and mark it as our addon under test
   *
   * TODO: this is pretty brittle - any change to the directory structures
   * here will break this (i.e. moving tmp files to a system tmp directory).
   * We should find a better way to detect the addon under test.
   */
  protected flagAddonUnderTest(addons: AddonBuilder[]) {
    this.addonBuilderUnderTest = addons.find((addonBuilder) => addonBuilder.dir === this.addonDirUnderTest);
    assert(this.addonBuilderUnderTest, 'Unable to find the builder for the addon under test');
    this.addonBuilderUnderTest.underTest = true;
  }

  /**
   * A couple things are unique about dummy apps:
   *
   * 1. They borrow their tests from the addon under test
   * 2. They drop the compiled version of the addon under test into their
   *    dist/node_modules directory
   */
  assembleTree() {
    let tree = super.assembleTree();
    let addonTree = this.addonBuilderUnderTest.toTree();
    // Move the addon's test into the dummy folder so the dummy app thinks they
    // are it's own tests
    let addonTests = new Funnel(addonTree, {
      srcDir: 'test',
      exclude: [ 'dummy/**/*' ],
      destDir: 'test'
    });
    // Drop a copy of the compiled addon in the node_modules folder of the
    // compiled dummy app This allows the addon's test files to `import MyAddon
    // from 'my-addon'`. Any other node_module imports from within test files
    // should work automatically, since node will walk up from tmp/-dummy to
    // find the addon's real node_modules folder, and check there. But this
    // won't work for the addon itself, hence:
    let addonPackageFiles = [ 'denali-build.js', 'package.json' ].map((file) => {
      let sourceFilePath = path.join(this.addonBuilderUnderTest.dir, file);
      if (fs.existsSync(sourceFilePath)) {
        return writeFile(path.join('node_modules', this.addonBuilderUnderTest.pkg.name, file), fs.readFileSync(sourceFilePath, 'utf-8'));
      }
    }).filter(Boolean);
    let compiledAddon = new Funnel(addonTree, {
      exclude: [ 'test' ],
      destDir: `node_modules/${this.addonBuilderUnderTest.pkg.name}/dist`
    });
    return new MergeTree([ tree, addonTests, ...addonPackageFiles, compiledAddon ], { overwrite: true, annotation: 'merge addon tests into dummy' });
  }

}
