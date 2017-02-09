import ora from 'ora';

let spinner = ora('');

let operations = {
  start(msg: string): void {
    spinner.text = msg;
    spinner.start();
  },
  succeed(msg?: string): void {
    spinner.text = msg || spinner.text;
    spinner.succeed();
  },
  fail(msg?: string): void {
    spinner.text = msg || spinner.text;
    (<any>spinner).stream = process.stderr;
    spinner.fail();
    (<any>spinner).stream = process.stdout;
  },
  finish(symbol: string, text: string): void {
    (<(options: Object) => void>spinner.stopAndPersist)({ symbol, text });
  }
};

process.on('message', (data) => {
  operations[data.operation](...data.args);
});