import {
  intersection,
  keys,
  forEach,
  findKey,
  assign,
  mapKeys
} from 'lodash';
import * as fs from 'fs';
import * as path from 'path';
import ui from './ui';
import * as createDebug from 'debug';
import * as argParser from 'yargs';
import requireTree = require('require-tree');
import Command from './command';
import findAddons from './find-addons';
import * as dedent from 'dedent-js';
import * as tryRequire from 'try-require';

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
  debugger;
  debug('discovering commands from addons');
  let commands: { [key: string]: typeof Command } = {};
  let coreCommands: { [key: string]: typeof Command };
  let addons = findAddons(isLocal);

  argParser.usage(dedent`
    Usage: denali <command> [options]

    Denali is an opinionated Node.js framework that lets you focus on shipping APIs.
  `);

  addons.forEach((addon) => {
    let addonCommands = discoverCommands(commands, addon.pkg.name, path.join(addon.dir, 'commands'));
    if (addon.pkg.name === 'denali') {
      debug('found core denali commands');
      coreCommands = addonCommands;
    } else {
      debug(`found ${ keys(addonCommands).length } commands from ${ addon.pkg.name }: [ ${ keys(addonCommands).join(', ') } ] `)
      commands = Object.assign(commands, addonCommands);
    }
  });

  // Ensure that denali itself is installed so we have the base commands
  if (!coreCommands) {
    ui.error('Whoops, looks like you have not installed denali itself yet.');
    ui.error('You need to install denali globally (`$ npm i -g denali`) alongside the CLI.')
  }

  // Core commands take precedence
  commands = Object.assign(commands, coreCommands);

  forEach(commands, (CommandClass: typeof Command, name: string): void => {
    try {
      debug(`configuring ${ CommandClass.commandName } command (invocation: "${ name }")`);
      CommandClass.configure(argParser, { name, isLocal });
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
    if (isLocal) {
      let cli = tryRequire(path.join(process.cwd(), 'node_modules', 'denali-cli', 'package.json'));
      versions.push(`denali-cli ${ cli.version } [local]`);
      let denali = tryRequire(path.join(process.cwd(), 'node_modules', 'denali', 'package.json'));
      versions.push(`denali ${ denali.version } [local]`);
    }
    versions.push(
      `node ${ process.versions.node }`,
      `openssl ${ process.versions.openssl }`
    );
    return versions.join(`\n`);
  })
  .parse(process.argv);

  debug('no command invoked, printing help message');
  argParser.showHelp();
}

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
