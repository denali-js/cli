import {
  forEach,
  assign,
  kebabCase
} from 'lodash';
import ui from './ui';
import { Argv as Yargs, Options as YargsOptions } from 'yargs';
import * as createDebug from 'debug';
import * as NestedError from 'nested-error-stacks';

const debug = createDebug('denali-cli:command');

/**
 * Represents a subcommand of the `denali` CLI.
 *
 * @module denali-cli
 */
abstract class Command {

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
  public static aliases: string[] = [];

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
   * Takes the yargs object for this command, gives the command a chance to define any subcommands
   */
  protected static configureSubcommands: (commandName: string, yargs: Yargs, projectPkg: any) => Yargs;

  /**
   * Do some basic checks (i.e. are we obeying runsInApp) then instantiate and run the command
   *
   * @param argv the yargs-parsed command line arguments
   * @param context additional context provided statically, passed through to the command
   *                constructor; useful for blueprints to pass additional, static data
   */
  public static async _run(argv: any): Promise<void> {
    debug(`enforcing runsInApp setting (${ this.runsInApp })`);
    if (argv.projectPkg && this.runsInApp === false) {
      ui.error('This command can only be run outside an existing Denali project.');
      return;
    }
    if (!argv.projectPkg && this.runsInApp === true) {
      ui.error('This command can only be run inside an existing Denali project.');
      return;
    }
    let command: Command = new (<any>this)();
    debug('running command');
    try {
      await command.run(argv);
    } catch (e) {
      throw new NestedError(`"${ this.commandName }" command failed`, e);
    }
  }

  /**
   * Accepts the global yargs object, gives the command a chance to define it's interface.
   */
  public static configure(commandName: string, yargs: Yargs, projectPkg: any, context?: any): Yargs {
    let command = commandName;
    let abbreviations = command.split('').map((letter, i) => command.substr(0, i + 1));
    if (this.params) {
      command += ` ${ this.params }`;
    }
    debug(`adding command: ${ command }`);
    return yargs.command({
      command,
      aliases: this.aliases.concat(abbreviations),
      describe: this.description,
      builder: (commandArgs: Yargs) => {
        debug(`building options for ${ commandName }`);
        commandArgs = this.configureOptions(commandName, commandArgs, projectPkg);
        if (this.configureSubcommands) {
          commandArgs = this.configureSubcommands(commandName, commandArgs, projectPkg);
        }
        return commandArgs;
      },
      handler: (args) => {
        this._run(assign(args, context)).catch((e) => {
          let stack = e.stack;
          // TODO cleanup this stacktrace: invert the wrapping so most specific appears at the top,
          // remove internal module frames, apply color if on a terminal
          // tslint:disable-next-line:no-console
          console.error(stack);
        });
      }
    });
  }

  /**
   * Takes the yargs object for this command, gives the command a chance to define any options
   */
  protected static configureOptions(commandName: string, yargs: Yargs, projectPkg: any) {
    yargs.usage(this.longDescription);
    forEach(this.flags, (options, flagName) => {
      yargs = yargs.option(kebabCase(flagName), options);
    });
    return yargs;
  }

  /**
   * Run the command. Can be omitted for pure-subcommand only
   */
  public async run(argv: any): Promise<void> { /* noop */ }

}

export default Command;
