import { fork, ChildProcess } from 'child_process';
import * as path from 'path';

let childSpinner: ChildProcess;

/**
 * Start the spinner process
 */
function startChildSpinner() {
  childSpinner = fork(path.join(__dirname, 'spinner-child.js'));
}

/**
 * Send the operation to the child spinner process. If it's not running, fork a new one.
 */
function run(operation: string, ...args: any[]): void {
  if (!childSpinner) {
    startChildSpinner();
  }
  childSpinner.send({ operation, args });
}

export default {
  /**
   * Start the spinner with the given message
   */
  start(msg: string): void {
    run('start', msg);
  },
  /**
   * Stop the spinner, replace the spinner graphic with a checkmark, optionally update the message,
   * and turn it green.
   */
  succeed(msg?: string): void {
    run('succeed', msg);
  },
  /**
   * Stop the spinner, replace the spinner graphic with an X, optionally update the message, and
   * turn it red.
   */
  fail(msg?: string): void {
    run('fail', msg);
  },
  /**
   * Stop the spinner, replace the spinner graphic with the supplied symbol and message with the
   * supplied text.
   */
  finish(symbol: string, text: string): void {
    run('finish', symbol, text);
  }
};
