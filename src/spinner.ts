import { fork, ChildProcess } from 'child_process';
import path from 'path';

let childSpinner;

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
    run('start', msg);
  },
  fail(msg?: string): void {
    run('start', msg);
  },
  finish(symbol: string, text: string): void {
    run('start', symbol, text);
  }
};