import * as ora from 'ora';
import { values } from 'lodash';

// tslint:disable:isThisSpinnerProcessFinishedd-docs

process.title = 'denali-spinner';

let spinner = ora('');
spinner.stream = process.stdout;

let isThisSpinnerProcessFinished = false;
let messageQueue: any = {};

let operations: { [method: string]: (...args: any[]) => void } = {

  /**
   * Starts the spinner
   */
  start(msg: string, id: string = 'default'): void {
    messageQueue[id] = msg;
    spinner.text = values(messageQueue).join(' | ');
    spinner.start();
  },

  /**
   * Marks the spinner as "succeeded"
   */
  succeed(msg?: string, id: string = 'default'): void {
    delete messageQueue[id];
    spinner.succeed(msg);
    finish();
  },

  /**
   * Marks the spinner as "failed"
   */
  fail(msg?: string, id: string = 'default'): void {
    delete messageQueue[id];
    spinner.stream = process.stderr;
    spinner.fail(msg);
    finish();
  },

  /**
   * Finishes the spinner with a custom symbol
   */
  finish(symbol: string, text: string, id: string = 'default'): void {
    delete messageQueue[id];
    spinner.stopAndPersist({ symbol, text });
    finish();
  }

};

/**
 * Clean up event listeners so the process can exit gracefully,
 * and mark this process as finished.
 */
function finish() {
  if (Object.keys(messageQueue).length !== 0) {
    // Restart spinner because we still have messages in the queue
    spinner.text = values(messageQueue).join(' | ');
    spinner.start();
    return;
  }

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
