import * as ora from 'ora';

// tslint:disable:isThisSpinnerProcessFinishedd-docs

process.title = 'denali-spinner';

let spinner = ora('');
spinner.stream = process.stdout;

let operations: { [method: string]: (...args: any[]) => void } = {

  /**
   * Starts the spinner
   */
  start(msg: string): void {
    spinner.text = msg;
    spinner.start();
  },

  /**
   * Marks the spinner as "succeeded"
   */
  succeed(msg?: string): void {
    spinner.succeed(msg);
  },

  /**
   * Marks the spinner as "failed"
   */
  fail(msg?: string): void {
    spinner.stream = process.stderr;
    spinner.fail(msg);
  },

  /**
   * Finishes the spinner with a custom symbol
   */
  finish(symbol: string, text: string): void {
    spinner.stopAndPersist({ symbol, text });
  }

};

process.on('message', (data: any) => {
  operations[data.operation](...data.args);
  process.send('ack');
});

process.on('disconnect', () => {
  spinner.stop();
  process.exit();
});
