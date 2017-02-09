import path from 'path';
import findup = require('findup-sync');
import ui from './ui';
import yargs, { Argv as Yargs, Options as YargsOptions } from 'yargs';
import {
  forIn,
  forEach,
  padEnd,
  includes
} from 'lodash';

/**
 * Represents a subcommand of the `denali` CLI.
 *
 * @module denali-cli
 */
abstract class Command {

  /**
   * Accepts the global yargs object, gives the command a chance to define it's interface.
   *
   * @static
   * @param {Yargs} yargs
   * @returns {void}
   */
  static configure(yargs: Yargs): void {
    yargs.command({
      command: this.commandName + ' ' + this.params,
      aliases: this.aliases,
      builder(commandArgs: Yargs) {
        this.configureOptions(commandArgs);
        return commandArgs;
      },
      handler: (argv: any) => {
        this._run(argv);
      }
    })
  }

  /**
   * Takes the yargs object for this command, gives the command a chance to define any options
   *
   * @static
   * @param {any} yargs
   */
  static configureOptions(yargs: Yargs) {
    yargs
    .usage(this.longDescription);
    forEach(this.flags, (options, flagName) => {
      yargs.option(flagName, options);
    });
  }

  /**
   * The name of the command
   *
   * @static
   * @type {string}
   */
  static commandName: string;

  /**
   * An array of possible aliases for this command's name
   *
   * @static
   * @type {string[]}
   */
  static aliases: string[];

  /**
   * Description of what the command does. Displayed when the root help message prints
   *
   * @static
   * @type {string}
   */
  static description: string = null;

  /**
   * A longer description when this command's help is invoked, i.e. 'denali foo --help' or
   * 'denali help foo'
   *
   * @static
   * @type {string}
   */
  static longDescription: string = null;

  /**
   * Positional params for this command. Should follow yargs syntax for positional params
   *
   * @static
   * @type {string}
   */
  static params: string = '';

  /**
   * An object whose keys are flag names, and values are yargs.option settings
   *
   * @static
   * @type {{ [flagName: string]: YargsOptions }}
   */
  static flags: { [flagName: string]: YargsOptions } = {};

  /**
   * If true, Denali will require that this command be run inside an existing app. If false, running
   * inside an app will be prevented. If null, both will be allowed.
   *
   * @static
   * @type {boolean}
   */
  static runsInApp: boolean = false;

  /**
   * Do some basic checks (i.e. are we obeying runsInApp) then instantiate and run the command
   *
   * @static
   * @param {any} argv
   * @returns
   *
   * @memberOf Command
   */
  static _run(argv) {
    let isDenaliProject = this.isDenaliProject();
    if (isDenaliProject && this.runsInApp === false) {
      ui.error('This command can only be run outside an existing Denali project.');
      return;
    }
    if (!isDenaliProject && this.runsInApp === true) {
      ui.error('This command can only be run inside an existing Denali project.');
      return;
    }
    if (typeof isDenaliProject === 'string') {
      process.chdir(isDenaliProject);
    }
    let command: Command = new (<any>this)();
    command.run(argv);
  }

  /**
   * Checks if the cwd is inside a Denali project
   *
   * @private
   * @static
   * @returns {(string | boolean)}
   */
  private static isDenaliProject(): string | boolean {
    let pkgpath = findup('package.json');
    if (pkgpath) {
      const pkg = require(path.resolve(pkgpath));
      let isApp = pkg.dependencies && pkg.dependencies.denali;
      let isAddon = pkg.keywords && pkg.keywords.includes('denali-addon');
      let inTmp = path.relative(path.dirname(pkgpath), process.cwd()).startsWith('tmp');
      return (isApp || isAddon) && !inTmp ? path.resolve(path.dirname(pkgpath)) : false;
    }
    return false;
  }

  /**
   * Run the command.
   *
   * @abstract
   * @param {*} argv
   * @returns {Promise<void>}
   */
  abstract run(argv: any): Promise<void>;

}

export default Command;