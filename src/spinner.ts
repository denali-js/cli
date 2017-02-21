import { fork, ChildProcess } from 'child_process';
import { fromNode, delay } from 'bluebird';
import * as path from 'path';

let childSpinner: ChildProcess;

// Each operation issued to the child spinner process gets a UID so we can pair acknowledgements
// with their issuing operation.
let uid = 0;

/**
 * Start the spinner process. Returns a promise that resolves once the spinner process is up and
 * ready to recieve commands. Rejects if the process fails to start up within 5s (mostly as a
 * fail-safe to avoid hanging the program if there's a bug).
 */
async function startChildSpinner() {
  await new Promise<void>((resolve, reject) => {
    let fallback = setTimeout(() => reject('Spinner process failed to startup on time'), 4000);
    childSpinner = fork(path.join(__dirname, 'spinner-child.js'));
    childSpinner.send({ operation: 'hello' });
    childSpinner.once('message', () => {
      clearTimeout(fallback);
      resolve();
    });
  });
}

/**
 * Send the operation to the child spinner process. If it's not running, fork a new one. Returns a
 * promise that resolves only once the child spinner process as confirmed the operation ran.
 */
async function run(operation: string, ...args: any[]): Promise<void> {
  if (!childSpinner || !childSpinner.connected) {
    await startChildSpinner();
  }
  await new Promise<void>((resolve, reject) => {
    let fallback = setTimeout(() => {
      reject(new Error(`Spinner process failed to acknowledge a command on time: ${ operation }(${ args.join(', ') })`))
    }, 4000);
    let id = uid++;
    childSpinner.send({ operation, args, id });
    childSpinner.on('message', receiveAck);
    // Wait to resolve the parent promise until we get an ack from the child process.
    function receiveAck(data: { finished?: boolean, ackId: number }) {
      if (data.ackId === id) {
        clearTimeout(fallback);
        childSpinner.removeListener('message', receiveAck);
        if (data.finished) {
          // If the child says it's done, then don't resolve till it fully exits.
          childSpinner.on('close', () => {
            resolve();
          });
        } else {
          clearTimeout(fallback);
          resolve();
        }
      }
    }
  });
}

export default {
  /**
   * Start the spinner with the given message
   */
  async start(msg: string) {
    await run('start', msg);
  },
  /**
   * Stop the spinner, replace the spinner graphic with a checkmark, optionally update the message,
   * and turn it green.
   */
  async succeed(msg?: string) {
    await run('succeed', msg);
  },
  /**
   * Stop the spinner, replace the spinner graphic with an X, optionally update the message, and
   * turn it red.
   */
  async fail(msg?: string) {
    await run('fail', msg);
  },
  /**
   * Stop the spinner, replace the spinner graphic with the supplied symbol and message with the
   * supplied text.
   */
  async finish(symbol: string, text: string) {
    await run('finish', symbol, text);
  },
};
