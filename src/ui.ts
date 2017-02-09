import chalk from 'chalk';

let loglevels = [
  'debug',
  'info',
  'success',
  'warn',
  'error',
  'silent'
];

let env = process.env.DENALI_ENV || process.env.NODE_ENV || 'development';

let defaultLevels = {
  development: 'debug',
  test: 'info',
  production: 'info'
};

export default {
  loglevel: defaultLevels[env],
  raw(level, output) {
    if (loglevels.indexOf(this.loglevel) <= loglevels.indexOf(level)) {
      process.stdout.write(output || '');
    }
  },
  debug(...msgs) {
    if (loglevels.indexOf(this.loglevel) <= loglevels.indexOf('debug')) {
      msgs = msgs.map((msg) => chalk.cyan(msg));
      console.log(msgs.shift(), ...msgs);
    }
  },
  info(...msgs) {
    if (loglevels.indexOf(this.loglevel) <= loglevels.indexOf('info')) {
      console.log(msgs.shift(), ...msgs);
    }
  },
  warn(...msgs) {
    if (loglevels.indexOf(this.loglevel) <= loglevels.indexOf('warn')) {
      msgs = msgs.map((msg) => chalk.yellow(msg));
      console.warn(msgs.shift(), ...msgs);
    }
  },
  error(...msgs) {
    if (loglevels.indexOf(this.loglevel) <= loglevels.indexOf('error')) {
      msgs = msgs.map((msg) => chalk.red(msg));
      console.error(msgs.shift(), ...msgs);
    }
  },
  success(...msgs) {
    if (loglevels.indexOf(this.loglevel) <= loglevels.indexOf('success')) {
      msgs = msgs.map((msg) => chalk.green(msg));
      console.error(msgs.shift(), ...msgs);
    }
  }
};