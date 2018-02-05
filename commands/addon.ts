import * as path from 'path';
import { Command, ui } from '../lib';
import AddonBlueprint from '../blueprints/addon/index';


/**
 * Create a new denali app
 *
 * @package commands
 */
export default class NewCommand extends Command {

  /* tslint:disable:completed-docs typedef */
  static commandName = 'addon';
  static description = AddonBlueprint.description;
  static longDescription = AddonBlueprint.longDescription;
  static params = AddonBlueprint.params;
  static flags = AddonBlueprint.flags;

  static runsInApp = false;

  async run(argv: any) {
    ui.info('\n');
    AddonBlueprint.dir = path.join(__dirname, '..', 'blueprints', 'addon');
    let addonBlueprint = new AddonBlueprint();
    await addonBlueprint.generate(argv);
  }

}
