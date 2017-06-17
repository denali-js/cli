import * as chalk from 'chalk';

// tslint:disable:no-console no-invalid-this

let loglevels = [
  'debug',
  'info',
  'success',
  'warn',
  'error',
  'silent'
];

let env = process.env.DENALI_ENV || process.env.NODE_ENV || 'development';

let defaultLevels: { [env: string]: string } = {
  development: 'debug',
  test: 'info',
  production: 'info'
};

export default {
  loglevel: defaultLevels[env],
  /**
   * Print `output` the stdout stream as-is, with no additional newline or formatting.
   */
  raw(level: string, output: string) {
    if (loglevels.indexOf(this.loglevel) <= loglevels.indexOf(level)) {
      process.stdout.write(output || '');
    }
  },
  /**
   * Log out at the 'debug' level
   */
  debug(...msgs: any[]) {
    if (loglevels.indexOf(this.loglevel) <= loglevels.indexOf('debug')) {
      msgs = msgs.map((msg) => chalk.cyan(msg));
      console.log(msgs.shift(), ...msgs);
    }
  },
  /**
   * Log out at the 'info' level
   */
  info(...msgs: any[]) {
    if (loglevels.indexOf(this.loglevel) <= loglevels.indexOf('info')) {
      console.log(msgs.shift(), ...msgs);
    }
  },
  /**
   * Log out at the 'warn' level
   */
  warn(...msgs: any[]) {
    if (loglevels.indexOf(this.loglevel) <= loglevels.indexOf('warn')) {
      msgs = msgs.map((msg) => chalk.yellow(msg));
      console.log(msgs.shift(), ...msgs);
    }
  },
  /**
   * Log out at the 'error' level
   */
  error(...msgs: any[]) {
    if (loglevels.indexOf(this.loglevel) <= loglevels.indexOf('error')) {
      msgs = msgs.map((msg) => chalk.red(msg));
      console.error(msgs.shift(), ...msgs);
    }
  },
  /**
   * Log out at the 'success' level
   */
  success(...msgs: any[]) {
    if (loglevels.indexOf(this.loglevel) <= loglevels.indexOf('success')) {
      msgs = msgs.map((msg) => chalk.green(msg));
      console.log(msgs.shift(), ...msgs);
    }
  }
};
