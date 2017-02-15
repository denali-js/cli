import {
  forIn,
  forEach,
  padEnd,
  includes,
  assign,
  kebabCase
} from 'lodash';
import * as path from 'path';
import findup = require('findup-sync');
import ui from './ui';
import yargs, { Argv as Yargs, Options as YargsOptions } from 'yargs';
import * as createDebug from 'debug';

const debug = createDebug('denali-cli:command');

/**
 * Represents a subcommand of the `denali` CLI.
 *
 * @module denali-cli
 */
abstract class Command {

  /**
   * Accepts the global yargs object, gives the command a chance to define it's interface.
   */
  public static configure(yargs: Yargs, context: { name: string, isLocal: boolean }): Yargs {
    return yargs.command({
      command: context.name + ' ' + this.params,
      aliases: this.aliases,
      describe: this.description,
      builder: (commandArgs: Yargs) => {
        debug(`building options for ${context.name}`);
        this.configureOptions(commandArgs, context);
        if (this.configureSubcommands) {
          this.configureSubcommands(yargs, context);
        }
        return commandArgs;
      },
      handler: (args) => {
        if (this._run) {
          // tslint:disable-next-line:no-floating-promises
          this._run(context, args);
        }
      }
    });
  }

  /**
   * Takes the yargs object for this command, gives the command a chance to define any options
   */
  protected static configureOptions(yargs: Yargs, context: { name: string, isLocal: boolean }) {
    yargs
    .usage(this.longDescription);
    forEach(this.flags, (options, flagName) => {
      yargs.option(kebabCase(flagName), options);
    });
  }

  /**
   * Takes the yargs object for this command, gives the command a chance to define any subcommands
   */
  protected static configureSubcommands: (yargs: Yargs, context: { name: string, isLocal: boolean }) => void;

  /**
   * The name of the addon that supplied this command. Set by the boostrapping script as it loads
   * commands.
   */
  public static addon: string;

  /**
   * The name of the command
   */
  public static commandName: string;

  /**
   * An array of possible aliases for this command's name
   */
  public static aliases: string[];

  /**
   * Description of what the command does. Displayed when the root help message prints
   */
  public static description = '';

  /**
   * A longer description when this command's help is invoked, i.e. 'denali foo --help' or
   * 'denali help foo'
   */
  public static longDescription = '';

  /**
   * Positional params for this command. Should follow yargs syntax for positional params
   */
  public static params = '';

  /**
   * An object whose keys are flag names, and values are yargs.option settings
   */
  public static flags: { [flagName: string]: YargsOptions } = {};

  /**
   * If true, Denali will require that this command be run inside an existing app. If false, running
   * inside an app will be prevented. If null, both will be allowed.
   */
  public static runsInApp: boolean;

  /**
   * Do some basic checks (i.e. are we obeying runsInApp) then instantiate and run the command
   *
   * @param argv the yargs-parsed command line arguments
   * @param context additional context provided statically, passed through to the command
   *                constructor; useful for blueprints to pass additional, static data
   */
  public static async _run(context: any, argv: any): Promise<void> {
    debug(`enforcing runsInApp setting (${ this.runsInApp })`);
    if (context.isLocal && this.runsInApp === false) {
      ui.error('This command can only be run outside an existing Denali project.');
      return;
    }
    if (!context.isLocal && this.runsInApp === true) {
      ui.error('This command can only be run inside an existing Denali project.');
      return;
    }
    if (context.isLocal) {
      let projectRoot = path.resolve(path.dirname(findup('package.json')));
      debug(`command is inside denali project, chdir'ing to root project directory ${ projectRoot }`);
      process.chdir(projectRoot);
    }
    let command: Command = new (<any>this)(context);
    debug('running command');
    try {
      await command.run(argv);
    } catch (e) {
      ui.error(`Error encountered when running "${ this.commandName }" command`);
      ui.error(e.stack);
    }
  }

  /**
   * Is the command being run inside a denali project?
   */
  public isLocal: boolean;

  /**
   * Creates an instance of Command, assigning any properties on the supplied context object to the
   * new instance directly.
   */
  constructor(context: any) {
    assign(this, context);
  }

  /**
   * Run the command. Can be omitted for pure-subcommand only
   */
  public async run(argv: any): Promise<void> { /* noop by default */ };

}

export default Command;
