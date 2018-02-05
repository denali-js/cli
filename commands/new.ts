import * as path from 'path';
import { Command, ui } from '../lib';
import AppBlueprint from '../blueprints/app/index';


/**
 * Create a new denali app
 *
 * @package commands
 */
export default class NewCommand extends Command {

  /* tslint:disable:completed-docs typedef */
  static commandName = 'new';
  static description = AppBlueprint.description;
  static longDescription = AppBlueprint.longDescription;
  static params = AppBlueprint.params;
  static flags = AppBlueprint.flags;

  static runsInApp = false;

  async run(argv: any) {
    ui.info('\n');
    AppBlueprint.dir = path.join(__dirname, '..', 'blueprints', 'app');
    let appBlueprint = new AppBlueprint();
    await appBlueprint.generate(argv);
  }

}
