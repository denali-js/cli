/* tslint:disable:completed-docs no-empty no-invalid-this member-access */
import test from 'ava';
import { each } from 'lodash';
import * as path from 'path';
import * as fs from 'fs-extra';
import * as tmp from 'tmp';
import CliAcceptanceTest from '../../utils/cli-acceptance';

test('generates an addon', async (t) => {
  let addonCommand = new CliAcceptanceTest('addon denali-new-addon', {
    populateWithDummy: false,
    name: 'addon-command',
    dir: tmp.dirSync({
      unsafeCleanup: true,
      prefix: `addon-command`
    }).name
  });
  await addonCommand.run({ failOnStderr: true });

  let filesToCheck = {
    'app/addon.js': 'addon main file',
    '.gitignore': '.gitignore',
    'test/dummy/app/application.js': 'dummy app file'
  };
  each(filesToCheck, (description, file) => {
    let pathToCheck = path.join(addonCommand.dir, 'denali-new-addon', file);
    t.true(fs.existsSync(pathToCheck), `${ description } should be generated`);
  });
});
