import * as path from 'path';
import AppBuilder from './app';
import AddonBuilder from './addon';
import * as MergeTree from 'broccoli-merge-trees';
import * as Funnel from 'broccoli-funnel';

export default class DummyBuilder extends AppBuilder {

  addonBuilderUnderTest: AddonBuilder;

  discoverAddons(): AddonBuilder[] {
    let addons = super.discoverAddons();
    this.flagAddonUnderTest(addons);
    return addons;
  }

  protected flagAddonUnderTest(addons: AddonBuilder[]) {
    let dirForAddonUnderTest = path.join(this.dir, '..', '..');
    this.addonBuilderUnderTest = addons.find((addonBuilder) => addonBuilder.dir === dirForAddonUnderTest);
    this.addonBuilderUnderTest.underTest = true;
  }

  assembleTree() {
    let tree = super.assembleTree();
    let addonTree = this.addonBuilderUnderTest.toTree();
    let addonTests = new Funnel(addonTree, {
      srcDir: 'test',
      exclude: [ 'dummy/**/*' ],
      destDir: 'test'
    });
    return new MergeTree([ tree, addonTests ], { annotation: 'merge addon tests into dummy' });
  }

}
