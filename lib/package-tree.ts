import {
  cloneDeep
} from 'lodash';
import * as path from 'path';
import * as fs from 'fs';
import * as Plugin from 'broccoli-plugin';
import * as glob from 'glob';
import * as mkdirp from 'mkdirp';
import Builder, { Tree } from './builder';

/**
 * Denali CLI's build system is based on Broccoli, which, while quite powerful for our use case, has
 * a specific flaw: you can't operate on files in the root directory that you are building. This
 * plugin is a hack around that - it skips Broccoli's input trees and copies files directly out of
 * the package root. The drawback is that Broccoli's natural file-watching mechanisms will fail
 * here, but that's typically fine since these files either don't matter at runtime, or would
 * require full restarts anyway.
 */
export default class PackageTree extends (<new(...args: any[]) => Tree>Plugin) {

  /**
   * The Builder instance that this PackageTree is part of
   */
  protected builder: Builder;

  /**
   * The root directory of the package
   */
  protected dir: string;

  /**
   * An array of filepaths that should be copied
   */
  protected files: string[];

  /**
   * The destination directory
   */
  protected outputPath: string;

  constructor(builder: Builder, options: { files: string[] }) {
    super([], options);
    this.builder = builder;
    this.dir = builder.dir;
    this.files = options.files;
  }

  /**
   * Copy the package files over
   */
  public build(): void {
    // Copy over any top level files specified
    this.files.forEach((pattern) => {
      glob.sync(pattern, { cwd: this.dir, nodir: true }).forEach((file) => {
        let src = path.join(this.dir, file);
        let dest = path.join(this.outputPath, file);
        if (fs.existsSync(src)) {
          mkdirp.sync(path.dirname(dest));
          fs.writeFileSync(dest, fs.readFileSync(src));
        }
      });
    });

    // Addons should publish their dist directories, not the root project directory. To enforce
    // this, the addon blueprint ships with a prepublish script that fails immediately, telling the
    // user to run `denali publish` instead (which tests the addon, builds it, then runs npm publish
    // from the dist folder). However, `denali publish` itself would get blocked by our prepublish
    // blocker too, so when we build an addon, we remove that blocker. But if the user has changed
    // the prepublish script, then we leave it alone.
    let scripts = this.builder.pkg.scripts;
    if (scripts && scripts.prepublish && scripts.prepublish.includes("Use 'denali publish' instead.")) {
      let pkg = cloneDeep(this.builder.pkg);
      delete pkg.scripts.prepublish;
      fs.writeFileSync(path.join(this.outputPath, 'package.json'), JSON.stringify(pkg, null, 2));
    }
  }

}
