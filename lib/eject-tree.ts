import * as Plugin from 'broccoli-plugin';
import { Tree } from './builder';
import * as rimraf from 'rimraf';
import { sync as copyDereferenceSync } from 'copy-dereference';
import * as createDebug from 'debug';

const debug = createDebug('denali-cli:eject-tree');

/**
 * Denali CLI's build system is based on Broccoli, which, while quite powerful for our use case, has
 * a specific flaw: you can't operate on files in the root directory that you are building. This
 * plugin is a hack around that - it skips Broccoli's input trees and copies files directly out of
 * the package root. The drawback is that Broccoli's natural file-watching mechanisms will fail
 * here, but that's typically fine since these files either don't matter at runtime, or would
 * require full restarts anyway.
 */
export default class PackageTree extends (<new(...args: any[]) => Tree>Plugin) {

  protected inputPaths: string[];

  /**
   * The destination directory
   */
  protected destDir: string;

  constructor(inputTree: Tree, destDir: string, options?: any) {
    super([ inputTree ], options);
    this.destDir = destDir;
  }

  /**
   * "Eject" files from the build pipeline, writing them out to an external destination before
   * the rest of the build finishes
   */
  public build(): void {
    debug(`ejecting child addon build result to ${ this.destDir }`);
    rimraf.sync(this.destDir);
    copyDereferenceSync(this.inputPaths[0], this.destDir);
  }

}
