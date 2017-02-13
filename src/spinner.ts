import { fork, ChildProcess } from 'child_process';
import * as path from 'path';

let childSpinner: ChildProcess;

function startChildSpinner() {
  childSpinner = fork(path.join(__dirname, 'spinner-child.js'));
}

function run(operation: string, ...args: any[]): void {
  if (!childSpinner) {
    startChildSpinner();
  }
  childSpinner.send({ operation, args });
}

export default {
  start(msg: string): void {
    run('start', msg);
  },
  succeed(msg?: string): void {
    run('succeed', msg);
  },
  fail(msg?: string): void {
    run('fail', msg);
  },
  finish(symbol: string, text: string): void {
    run('finish', symbol, text);
  }
};