import * as fs from 'fs';
import * as Plugin from 'broccoli-plugin';
import { Tree } from 'broccoli';
import * as rimraf from 'rimraf';
import { sync as copyDereferenceSync } from 'copy-dereference';
import * as createDebug from 'debug';
import * as symlinkOrCopy from 'symlink-or-copy';

const debug = createDebug('@denali-js/cli:eject-tree');

/**
 * Broccoli only allows a single output folder per build. However, to support
 * on-the-fly compilation of addons, we want to be able to build them _into
 * their own folder_, rather than the compiled consuming app. This lets us
 * treat on-the-fly compilation the same as precompilation.
 *
 * This EjectTree enables this. It "ejects" the result of an intermediate build
 * step to the supplied destination folder.
 */
export default class EjectTree extends (<new(...args: any[]) => Tree>Plugin) {

  protected _linked = false;

  protected inputPaths: string[];
  protected outputPath: string;

  /**
   * Should the eject tree also copy to it's normal destination path, in addition
   * to ejecting to the supplied destDir?
   */
  protected tee: boolean;

  /**
   * The destination directory
   */
  protected destDir: string;

  /**
   * @param options.tee if true, writes the input tree to both the output tree
   * as well as the eject destination; if false, writes to eject destination
   * only; defaults to false
   */
  constructor(inputTree: Tree, destDir: string, options: { tee?: true } = {}) {
    super([ inputTree ], options);
    this.destDir = destDir;
    this.tee = options.tee;
  }

  /**
   * "Eject" files from the build pipeline, writing them out to an external
   * destination before the rest of the build finishes
   */
  public build(): void {
    let input = this.inputPaths[0];
    debug(`ejecting child addon build result to ${ this.destDir }`);
    rimraf.sync(this.destDir);
    copyDereferenceSync(input, this.destDir);

    if (this.tee && !this._linked) {
      let output = this.outputPath;
      fs.rmdirSync(output);
      symlinkOrCopy.sync(input, output);
      this._linked = true;
    }
  }

}
