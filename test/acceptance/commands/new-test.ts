/* tslint:disable:completed-docs no-empty no-invalid-this member-access */
import test from 'ava';
import * as path from 'path';
import * as fs from 'fs-extra';
import * as tmp from 'tmp';
import CliAcceptanceTest from '../../utils/cli-acceptance';

test('generates an app', async (t) => {
  let newCommand = new CliAcceptanceTest('new my-denali-app', {
    populateWithDummy: false,
    name: 'new-command',
    dir: tmp.dirSync({
      unsafeCleanup: true,
      prefix: `new-command`
    }).name
  });
  await newCommand.run({ failOnStderr: !process.version.startsWith('v7') });

  let filesToCheck = [
    'app/application.js',
    '.gitignore'
  ];
  filesToCheck.forEach((file) => {
    let pathToCheck = path.join(newCommand.dir, 'my-denali-app', file);
    t.true(fs.existsSync(pathToCheck), `${ file } should be generated`);
  });
});
