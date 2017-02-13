import ora = require('ora');

process.title = 'denali-spinner';

let spinner = ora('');

let operations: { [method: string]: (...args: any[]) => void } = {
  start(msg: string): void {
    spinner.text = msg;
    spinner.start();
  },
  succeed(msg?: string): void {
    spinner.text = msg || spinner.text;
    spinner.succeed();
    process.removeAllListeners('message');
  },
  fail(msg?: string): void {
    spinner.text = msg || spinner.text;
    (<any>spinner).stream = process.stderr;
    spinner.fail();
    process.removeAllListeners('message');
    (<any>spinner).stream = process.stdout;
  },
  finish(symbol: string, text: string): void {
    (<(options: Object) => void>spinner.stopAndPersist)({ symbol, text });
    process.removeAllListeners('message');
  }
};

process.on('message', (data: any) => {
  operations[data.operation](...data.args);
});