import { fork } from 'child_process';
import * as path from 'path';
import { Socket } from 'net';

let childSpinner = fork(path.join(__dirname, 'spinner-child.js'));
childSpinner.unref();
let childChannel = <Socket>(<any>childSpinner).channel;
childChannel.unref();

export default {
  /**
   * Start the spinner with the given message
   */
  start(msg: string, id?: string) {
    queue('start', msg, id);
  },
  /**
   * Stop the spinner, replace the spinner graphic with a checkmark, optionally update the message,
   * and turn it green.
   */
  succeed(msg?: string, id?: string) {
    queue('succeed', msg, id);
  },
  /**
   * Stop the spinner, replace the spinner graphic with an X, optionally update the message, and
   * turn it red.
   */
  fail(msg?: string, id?: string) {
    queue('fail', msg, id);
  },
  /**
   * Stop the spinner, replace the spinner graphic with the supplied symbol and message with the
   * supplied text.
   */
  finish(symbol: string, text: string, id?: string) {
    queue('finish', symbol, text, id);
  }
};

let operationsQueue: { operation: string, args: any[] }[] = [];
let inFlight = false;

function queue(operation: string, ...args: any[]): void {
  operationsQueue.push({ operation, args });
  flushQueue();
}

function flushQueue() {
  if (inFlight) {
    return;
  }
  if (operationsQueue.length > 0) {
    inFlight = true;
    let nextOperation = operationsQueue.shift();
    childChannel.ref();
    childSpinner.send(nextOperation);
    childSpinner.once('message', () => {
      childChannel.unref();
      inFlight = false;
      flushQueue();
    });
  }
}
