import * as fs from 'fs';
import * as path from 'path';
import * as Plugin from 'broccoli-plugin';
import { Tree } from 'broccoli';
import * as SourceMapConcatenator from 'fast-sourcemap-concat';
import { all } from 'bluebird';
import * as glob from 'glob';
import { template } from 'lodash';

const unitTestOpen = template(fs.readFileSync(path.join(__dirname, '..', 'templates', 'unit-test-open.ejs'), 'utf-8'));
const unitTestClose = template(fs.readFileSync(path.join(__dirname, '..', 'templates', 'unit-test-close.ejs'), 'utf-8'));

export default class UnitTestFilter extends (<new(...args: any[]) => Tree>Plugin) {

  // Type stubs
  inputPaths: string[];
  outputPath: string;

  baseDir: string;
  sourceRoot: string;
  bundleName: string;

  constructor(inputNode: Tree, options: { bundleName: string, baseDir?: string, sourceRoot?: string, annotation?: string }) {
    super([ inputNode ], { annotation: options.annotation });
    this.baseDir = options.baseDir;
    this.sourceRoot = options.sourceRoot;
    this.bundleName = options.bundleName;
  }

  async build() {
    let files = glob.sync('**/*.js', { nodir: true, cwd: this.inputPaths[0] });
    let fileConcats = files.map(this.wrapFile.bind(this));
    return await all(fileConcats);
  }

  async wrapFile(relativePath: string) {
    let srcFilepath = path.join(this.inputPaths[0], relativePath);
    let destFilepath = path.join(this.outputPath, relativePath);
    let concatenator = new SourceMapConcatenator({
      baseDir: this.baseDir,
      outputFile: destFilepath,
      sourceRoot: this.sourceRoot
    });


    let distRoot = path.join(path.relative(path.dirname(relativePath), '.'));
    let bundlePath = path.join(distRoot, `${ this.bundleName }.bundle.js`);
    concatenator.addSpace(unitTestOpen({ bundlePath }));
    concatenator.addFile(srcFilepath);
    concatenator.addSpace(unitTestClose({ unitTestPath: relativePath }));

    await concatenator.end();
  }

}
