import * as path from 'path';
import * as fs from 'fs';
import { template } from 'lodash';
import { Tree } from 'broccoli';
import * as Concat from 'broccoli-concat/concat';
import * as SourceMapStrategy from 'fast-sourcemap-concat';

const moduleOpenTemplate = template(fs.readFileSync(path.join(__dirname, '..', 'templates', 'module-open.ejs'), 'utf-8'));
const moduleCloseTemplate = fs.readFileSync(path.join(__dirname, '..', 'templates', 'module-close.ejs'), 'utf-8');

export default class WrappingConcat extends (<new(...args: any[]) => any>Concat) {

  constructor(inputTree: Tree, options: { wrapAsModules?: boolean, header?: string, footer?: string, main?: string, outputFile?: string, baseDir?: string }) {
    class WrappingSourceMapStrategy extends SourceMapStrategy {

      addSpace: (space: string) => void;

      addFile(filename: string) {
        if (options.wrapAsModules) {
          this.addSpace(this.wrapFileStart(filename));
        }
        let result = super.addFile(filename);
        if (options.wrapAsModules) {
          this.addSpace(this.wrapFileEnd());
        }
        return result;
      }

      wrapFileStart(filename: string) {
        let opts = { isMain: filename === options.main };
        return moduleOpenTemplate({ filename, opts });
      }

      wrapFileEnd() {
        return moduleCloseTemplate;
      }

      // Correct filenames for sourcemap sources
      // TODO: this is using a private method override - can we do this better?
      _resolveSources(srcMap: any) {
        let sources = super._resolveSources(srcMap);
        if (options.baseDir) {
          return sources.map((s: string) => path.join(options.baseDir, s));
        }
        return sources;
      }

    }

    super(inputTree, {
      enabled: true,
      header: options.header,
      footer: options.footer,
      outputFile: options.outputFile || 'bundle.js',
      inputFiles: [ '**/*.js' ],
      allowNone: true,
      annotation: 'bundle concat'
    }, WrappingSourceMapStrategy);
  }

}
