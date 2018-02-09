/* tslint:disable:completed-docs no-empty no-invalid-this member-access */
import test from 'ava';
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
  // Yarn prints to stdout if we're running version 7.x of Node, but it's just
  // a warning. Since we run a matrix of versions on CI, we hope that the others
  // will print out any underlying errors that are encountered.
  await addonCommand.run({ failOnStderr: !process.version.startsWith('v7') });

  let filesToCheck = [
    'app/addon.js',
    '.gitignore',
    'test/dummy/app/application.js'
  ];
  filesToCheck.forEach((file) => {
    let pathToCheck = path.join(addonCommand.dir, 'denali-new-addon', file);
    t.true(fs.existsSync(pathToCheck), `${ file } should be generated`);
  });
});
