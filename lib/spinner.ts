import { fork } from 'child_process';
import * as path from 'path';
import { Socket } from 'net';
import { Writable } from 'stream';
import * as readline from 'readline';

let childSpinner = fork(path.join(__dirname, 'spinner-child.js'));
childSpinner.unref();

let childChannel = <Socket>(<any>childSpinner).channel;
childChannel.unref();

export default {
  /**
   * Start the spinner with the given message
   */
  async start(msg: string, id?: string) {
    await queue('start', msg, id);
  },
  /**
   * Stop the spinner, replace the spinner graphic with a checkmark, optionally update the message,
   * and turn it green.
   */
  async succeed(msg?: string, id?: string) {
    await queue('succeed', msg, id);
  },
  /**
   * Stop the spinner, replace the spinner graphic with an X, optionally update the message, and
   * turn it red.
   */
  async fail(msg?: string, id?: string) {
    await queue('fail', msg, id);
  },
  /**
   * Stop the spinner, replace the spinner graphic with the supplied symbol and message with the
   * supplied text.
   */
  async finish(symbol: string, text: string, id?: string) {
    await queue('finish', symbol, text, id);
  }
};

let operationsQueue: { operation: string, args: any[], done(): void }[] = [];
let inFlight = false;
let spinnerIsActive = false;

async function queue(operation: string, ...args: any[]): Promise<void> {
  return new Promise<void>((done) => {
    operationsQueue.push({ done, operation, args });
    flushQueue();
  });
}

function flushQueue() {
  if (inFlight) {
    return;
  }
  if (operationsQueue.length > 0) {
    let nextOperation = operationsQueue.shift();
    inFlight = true;
    if (nextOperation.operation === 'start') {
      spinnerIsActive = true;
    }
    childChannel.ref();
    try {
      childSpinner.send(nextOperation);
    } catch(e) {
      // most likely the child process is dead because it
      // received the sigint while this process was blocked
      // on some build step - we're likely about to shut
      // down ourselves
    }
    childSpinner.once('message', () => {
      childChannel.unref();
      inFlight = false;
      if (nextOperation.operation !== 'start') {
        spinnerIsActive = false;
      }
      nextOperation.done();
      flushQueue();
    });
  }
}

export function wrapOutputStream(stream: Writable) {
  let originalWrite = stream.write.bind(stream);
  let mockOriginalStream = <any>{ write: originalWrite };
  stream.write = function wrappedWrite(chunk: any, encoding?: any, callback?: any) {
    if (spinnerIsActive) {
      readline.clearLine(mockOriginalStream, 0);
      readline.cursorTo(mockOriginalStream, 0);
      chunk = chunk.toString();
      if (!chunk.endsWith('\n')) {
        chunk = chunk + '\n';
      }
    }
    return originalWrite(chunk, encoding, callback);
  };
}

wrapOutputStream(<any>process.stdout);
wrapOutputStream(<any>process.stderr);
