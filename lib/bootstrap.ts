import {
  intersection,
  keys,
  forEach,
  assign,
  mapKeys
} from 'lodash';
import * as fs from 'fs';
import * as path from 'path';
import * as assert from 'assert';
import ui from './ui';
import * as createDebug from 'debug';
import * as argParser from 'yargs';
import requireTree = require('require-tree');
import Command from './command';
import findAddons from './find-addons';
import * as dedent from 'dedent-js';
import * as dotenv from 'dotenv';

const debug = createDebug('denali-cli:bootstrap');

process.on('unhandledRejection', (reason: any, promise: any) => {
  ui.warn('A promise was rejected but did not have a .catch() handler:');
  ui.warn(reason && reason.stack || reason || promise);
  throw reason;
});

/**
 * Kicks off the Denali CLI. Discovers any addons in this project, and builds a list of all commands
 * supplied by addons. It then gives each command a chance to define any command line arguments and
 * options, and then kicks off yargs. Each command should have defined itself and the appropriate
 * way to invoke itself (by default, the _run method).
 */
export default function run(projectPkg?: any)  {
  dotenv.config();
  debug('discovering commands from addons');
  let commands: { [key: string]: typeof Command } = {};
  let coreCommands: { [key: string]: typeof Command };
  let globalCommands: { [key: string]: typeof Command };
  // Special case Denali itself - we want to treat the Denali source like a local project, but it
  // won't have a dependency on Denali, so it won't be able to load core commands like build and
  // test from a local copy of Denali.  So to get the core commands, we point it to the global
  // package instead.
  let addons = findAddons(projectPkg && projectPkg.name !== 'denali');

  argParser.usage(dedent`
    Usage: denali <command> [options]

    Denali is an opinionated Node.js framework that lets you focus on shipping APIs.
  `);

  addons.forEach((addon) => {
    let addonCommands = discoverCommands(commands, addon.pkg.name, path.join(addon.distDir, 'commands'));

    debug(`found ${ keys(addonCommands).length } commands from ${ addon.pkg.name }: [ ${ keys(addonCommands).join(', ') } ] `);
    if (addon.pkg.name === 'denali') {
      assert(keys(addonCommands).length > 0, 'Denali package was found, but unable to load core commands - is your Denali installation corrupted?');
      coreCommands = addonCommands;

      let denaliInstallType: string;
      if (projectPkg && projectPkg.name !== 'denali') {
        denaliInstallType = fs.lstatSync(path.join(process.cwd(), 'node_modules', 'denali')).isSymbolicLink() ? 'linked' : 'local';
      } else {
        denaliInstallType = 'global';
      }
      ui.info(` | denali v${ addon.pkg.version } [${ denaliInstallType }]\n`);

    } else {
      commands = Object.assign(commands, addonCommands);
    }
  });

  if (!coreCommands) {
    ui.warn('Core commands not found. If you are developing Denali itself, you need to install Denali globally.');
  }

  // Core commands take precedence over others
  commands = Object.assign(commands, coreCommands);

  // Special-case denali-cli commands
  globalCommands = discoverCommands(commands, 'denali-cli', path.join(__dirname, '..', 'commands'));

  // Global commands take precendence over all
  commands = Object.assign(commands, globalCommands);

  forEach(commands, (CommandClass: typeof Command, name: string): void => {
    try {
      CommandClass.configure(name, argParser, projectPkg);
    } catch (error) {
      ui.warn(`${ name } command failed to configure itself:`);
      ui.warn(error.stack);
    }
  });

  argParser
  .wrap(Math.min(100, argParser.terminalWidth()))
  .help()
  .version(() => {
    let versions = [];
    versions.push(
      `node ${ process.versions.node }`,
      `openssl ${ process.versions.openssl }`
    );
    return versions.join(`\n`);
  })
  .parse(process.argv.slice(2), { projectPkg });
}

/**
 * Discover the commands that are available in the supplied directory. For any commands whose names
 * collide with previously loaded commands, namespace the older command under it's addon name.
 */
function discoverCommands(commandsSoFar: { [commandName: string]: typeof Command }, addonName: string, dir: string) {
  if (!fs.existsSync(dir)) {
    return {};
  }
  if (addonName === 'denali') {
    addonName = 'core';
  } else if (addonName.startsWith('denali-')) {
    addonName = addonName.slice('denali-'.length);
  }
  // Load the commands
  let Commands: { [key: string]: typeof Command } = requireTree(dir, {
    // tslint:disable-next-line:completed-docs
    transform(obj: any) { return obj.default || obj; }
  });
  // Give commands a chance to define their own invocation name separate from the filename. Also,
  // let them know what addon they loaded from, so we can later scope their command name if it
  // collides and gets clobbered
  Commands = mapKeys(Commands, (CommandClass, commandDir) => {
    CommandClass.addon = addonName;
    return CommandClass.commandName || commandDir;
  });
  // Check for any command name collisions. In case of a collision, the older command gets moved to
  // a scoped invocation.
  intersection(keys(Commands), keys(commandsSoFar)).forEach((collidingCommandName: string) => {
    let clobberedCommand = commandsSoFar[collidingCommandName];
    commandsSoFar[clobberedCommand.addon + ':' + collidingCommandName] = clobberedCommand;
  });
  // Merge the newly discovered commands into what we have so far
  return assign(commandsSoFar, Commands);
}
