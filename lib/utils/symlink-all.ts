import * as fs from 'fs';
import * as path from 'path';
import { sync as mkdirp } from 'mkdirp';

export default function symlinkAll(folderThatExists: string, folderToCreate: string, options: { except?: string[] } = {}) {
  options.except = options.except || [];
  mkdirp(folderToCreate);
  fs.readdirSync(folderThatExists)
    .filter((entry) => !options.except.includes(entry))
    .forEach((entryThatExists) => {
      fs.symlinkSync(path.join(folderThatExists, entryThatExists), path.join(folderToCreate, entryThatExists));
    });
}
