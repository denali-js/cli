import {
  forEach,
  findKey,
  merge,
  mapKeys
} from 'lodash';
import fs from 'fs';
import path from 'path';
import ui from './ui';
import createDebug from 'debug';
import yargs, { Argv as Yargs } from 'yargs';
import requireDirectory from 'require-directory';
import flatten from 'flat';
import findPlugins from 'find-plugins';
import Command from './command';

const debug = createDebug('denali-cli:commands:index');

/**
 * Kicks off the Denali CLI. Discovers any addons in this project, and builds a list of all commands
 * supplied by addons. It then gives each command a chance to define any command line arguments and
 * options, and then kicks off yargs. Each command should have defined itself and the appropriate
 * way to invoke itself (by default, the _run method).
 *
 * @export
 * @param {boolean} isLocal
 */
export default function run(isLocal: boolean)  {
  debug('discovering commands from addons');
  let commands: { [key: string]: any } = {};
  let argParser: Yargs = (<any>yargs)();

  // Find addon commands
  let coreCommands: { [key: string]: any };
  if (isLocal) {
    let addons = findPlugins({
      sort: true,
      configName: 'denali',
      keyword: 'denali-addon'
    });
    addons.forEach((addon) => {
      let addonCommands = discoverCommands(addon.pkg.name, path.join(addon.dir, 'commands'));
      if (addon.pkg.name === 'denali') {
        coreCommands = addonCommands;
      } else {
        commands = Object.assign(commands, addonCommands);
      }
    });
  }

  // Core commands take precedence
  commands = Object.assign(commands, coreCommands);

  forEach(commands, (CommandClass: typeof Command): void => {
    CommandClass.configure(argParser);
  });
}

function discoverCommands(addonName: string, dir: string) {
  if (!fs.existsSync(dir)) {
    return {};
  }
  // Load the commands
  let Commands: { [key: string]: any } = flatten(requireDirectory(dir, {
    visit: (mod: any) => mod.default || mod
  }));
  // Map them by their command name
  Commands = mapKeys(Commands, (CommandClass) => CommandClass.commandName);
  // Also create a map with the command names scoped to the addon name
  let ScopedCommands = mapKeys(Commands, (CommandClass) => addonName + ':' + CommandClass.commandName);
  return merge(Commands, ScopedCommands);
}
