import * as fs from 'fs';
import * as path from 'path';
import * as Plugin from 'broccoli-plugin';
import { Tree } from 'broccoli';
import * as SourceMapConcatenator from 'fast-sourcemap-concat';
import { all } from 'bluebird';
import * as glob from 'glob';
import { template } from 'lodash';

const unitTestOpen = template(fs.readFileSync(path.join(__dirname, '..', 'templates', 'unit-test-header.ejs'), 'utf-8'));
const unitTestClose = fs.readFileSync(path.join(__dirname, '..', 'templates', 'unit-test-header.ejs'), 'utf-8');

export default class UnitTestFilter extends (<new(...args: any[]) => Tree>Plugin) {

  // Type stubs
  inputNodes: string[];
  outputPath: string;

  baseDir: string;
  sourceRoot: string;

  constructor(inputNode: Tree, options: { baseDir?: string, sourceRoot?: string, annotation?: string } = {}) {
    super([ inputNode ], { annotation: options.annotation });
    this.baseDir = options.baseDir;
    this.sourceRoot = options.sourceRoot;
  }

  async build() {
    let files = glob.sync('**/*.js');
    let fileConcats = files.map(this.wrapFile.bind(this));
    return await all(fileConcats);
  }

  async wrapFile(relativePath: string) {
    let srcFilepath = path.join(this.inputNodes[0], relativePath);
    let destFilepath = path.join(this.outputPath, relativePath);
    let concatenator = new SourceMapConcatenator({
      baseDir: this.baseDir,
      outputFile: destFilepath,
      sourceRoot: this.sourceRoot
    });

    let projectRoot = path.join(path.relative(relativePath, '.'), path.relative(this.sourceRoot, '.'));
    let bundlePath = path.join(projectRoot, 'dist', 'bundle.runtime.js');
    concatenator.addSpace(unitTestOpen({ bundlePath, unitTestPath: relativePath }));
    concatenator.addFile(srcFilepath);
    concatenator.addSpace(unitTestClose);

    await concatenator.end();
  }

}
