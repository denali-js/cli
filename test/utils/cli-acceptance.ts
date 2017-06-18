import * as path from 'path';
import { CommandAcceptanceTest } from '../../lib';

/**
 * There are several things within the CommandAcceptanceTest that assume
 * you're running the test inside of a valid app/addon. The CLI is neither of those,
 * but some of the utils are still helpful, so we subclass & override some of the app/addon code
 * in order to still use them.
 */
export default class CliAcceptanceTest extends CommandAcceptanceTest {

  constructor(command: string, options: { dir?: string, environment?: string, name?: string, populateWithDummy?: boolean } = {}) {
    super(command, options);

    this.denaliPath = path.join(__dirname, '..', '..', 'bin', 'denali');
  }

}
