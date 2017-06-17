import ora = require('ora');

// tslint:disable:isThisSpinnerProcessFinishedd-docs

process.title = 'denali-spinner';

let spinner = ora('');
spinner.stream = process.stdout;

let isThisSpinnerProcessFinished = false;

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
    finish();
  },

  /**
   * Marks the spinner as "failed"
   */
  fail(msg?: string): void {
    spinner.stream = process.stderr;
    spinner.fail(msg);
    finish();
  },

  /**
   * Finishes the spinner with a custom symbol
   */
  finish(symbol: string, text: string): void {
    spinner.stopAndPersist({ symbol, text });
    finish();
  }

};

/**
 * Clean up event listeners so the process can exit gracefully,
 * and mark this process as finished.
 */
function finish() {
  process.removeAllListeners('message');
  isThisSpinnerProcessFinished = true;
}

process.on('message', (data: any) => {
  // Initial wakeup handshake, so the parent can block on the initial process spinup
  if (data.operation === 'hello') {
    process.send('world');
    return;
  }
  // Perform the request operation
  operations[data.operation](...data.args);
  // Send an acknowledgement that the operation was performed, and whether or not this spinner
  // process is finished (if so, the parent can block on waiting for this process to fully exit)
  process.send({ ackId: data.id, finished: isThisSpinnerProcessFinished });
});
