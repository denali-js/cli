import * as fs from 'fs-extra';
import * as assert from 'assert';
import * as path from 'path';
import { spawn, ChildProcess } from 'child_process';
import * as tmp from 'tmp';
import { sync as glob } from 'globby';
import * as dedent from 'dedent-js';
import * as createDebug from 'debug';
import symlinkAll from '../utils/symlink-all';

const debug = createDebug('denali:test:command-acceptance');

const MINUTE = 60 * 1000;

export interface SpawnOptions {
  failOnStderr?: boolean;
  env?: any;
  pollInterval?: number;
  timeout?: number;
}

/**
 * A CommandAcceptanceTest allows you to test commands included in you app or
 * addon. It makes it easy to setup a clean test directory with fixture files,
 * run your command, and test either the console output of your command or the
 * state of the filesystem after the command finishes.
 *
 * @package test
 */
export default class CommandAcceptanceTest {

  /**
   * The command to invoke, i.e. 'build' would test the invocation of '$ denali
   * build'
   */
  command: string;

  /**
   * The test directory generated to test this command. If it's not provided to
   * the constructor, Denali will create a tmp directory inside the 'tmp'
   * directory in your project root.
   */
  dir: string;

  /**
   * The default NODE_ENV to invoke the command with. Defaults to development.
   */
  environment: string;

  /**
   * The root directory of the project under test.
   */
  protected projectRoot: string;

  /**
   * The path to the denali executable file that will be used when invoking the
   * command
   */
  protected denaliPath: string;

  /**
   * When testing via the `.spawn()` method, this will be the spawned
   * ChildProcess
   */
  protected spawnedCommand: ChildProcess;

  /**
   * The interval that checks the spawn output
   */
  protected pollOutput: NodeJS.Timer;

  /**
   * A fallback timer which will fail the test if the spawned process doesn't
   * emit passing output in a certain amount of time.
   */
  protected fallbackTimeout: NodeJS.Timer;

  /**
   * @param options.dir Force the test to use this directory as the test
   * directory. Useful if you want to customize the directory structure of the
   * throwaway app before running the command you want to test
   * @param options.name A string to include in the generated tmp directory
   * name. Useful when combined with the `denali test --litter` option, which
   * will leave the tmp directories behind, making it easier to inspect what's
   * happening in a CommandAcceptanceTest
   * @param options.populateWithDummy Should the test directory be populated
   * with a copy of the dummy app?
   */
  constructor(command: string, options: { dir?: string, environment?: string, name?: string, populateWithDummy?: boolean } = {}) {
    this.command = command;
    this.dir = options.dir || (<any>tmp.dirSync({
      dir: 'tmp',
      // we have to use env vars here so that the invoking CLI process can "pass
      // args" to the test files, since ava doesn't support adding arbitrary
      // parameters
      unsafeCleanup: !process.env.DENALI_LEAVE_TMP,
      prefix: `command-acceptance-test-${ options.name || command }-`
    })).name;
    this.environment = options.environment || 'development';
    this.projectRoot = process.cwd();
    // We don't use node_modules/.bin/denali because if denali-cli is linked in
    // via yarn, it doesn't add the binary symlinks to .bin. See
    // https://github.com/yarnpkg/yarn/issues/2493
    this.denaliPath = path.join(this.projectRoot, 'node_modules', 'denali-cli', 'dist', 'bin', 'denali');

    if (options.populateWithDummy !== false) {
      this.populateWithDummy();
    }
  }

  /**
   * Copy the dummy app into our test directory. Note that this populates the
   * directory with the dummy app _source_, not the compiled version. This is
   * because commands are run against the project root of an app/addon, which
   * contains the source.
   */
  populateWithDummy(): void {
    debug(`populating ${ this.dir } with dummy app`);
    let dummy = path.join(this.projectRoot, 'test', 'dummy');
    let projectPkg = require(path.join(this.projectRoot, 'package.json'));
    let tmpNodeModules = path.join(this.dir, 'node_modules');
    assert(!fs.existsSync(tmpNodeModules), 'You tried to run a CommandAcceptanceTest against a directory that already has an app in it. Did you forget to specify { populateWithDummy: false }?');
    // Copy over the dummy app source
    fs.copySync(dummy, this.dir);
    // Next, setup the node_modules folder of this throwaway dummy app copy
    fs.mkdirSync(tmpNodeModules);
    // We symlink all the node_modules from our addon into the throwaway's node_modules
    symlinkAll(path.join(this.projectRoot, 'node_modules'), tmpNodeModules);
    // Then we copy the addon itself over as a dependency of the dummy app.
    // We want to treat it like a git dep in case the command tries to build
    // the dummy app, which might try to build this addon. So copy over
    // everything that isn't gitignored, but also copy dist in case we can
    // use it.
    glob('**/*', { cwd: this.projectRoot, gitignore: true })
    .concat(glob('dist/**/*', { cwd: this.projectRoot }))
    .forEach((file: string) => {
      fs.copySync(path.join(this.projectRoot, file), path.join(tmpNodeModules, projectPkg.name, file));
    });
  }

  /**
   * Invoke the command and return promise that resolves with the output of the
   * command. Useful for commands that have a definitely completion (i.e.
   * 'build', not 'serve').
   *
   * @param options.failOnStderr Should any output to stderr result in a
   * rejected promise?
   */
  async run(options: { failOnStderr?: boolean, env?: any } = {}): Promise<{ output: string, dir: string }> {
    return this.spawn({
      failOnStderr: options.failOnStderr,
      env: options.env,
      timeout: 1000 * 60 * 5, // 5 minutes
      checkOutput: false
    }).catch((error: Error) => {
      if (error instanceof CommandFinishedError) {
        return {
          output: error.output,
          dir: this.dir
        };
      }
      throw error;
    });
  }

  /**
   * Invoke the command and poll the output every options.pollInterval. Useful
   * for commands that have a definitely completion (i.e. 'build', not
   * 'serve'). Each poll of the output will run the supplied
   * options.checkOutput method, passing in the stdout and stderr buffers. If
   * the options.checkOutput method returns a truthy value, the returned
   * promise will resolve. Otherwise, it will continue to poll the output until
   * options.timeout elapses, after which the returned promsie will reject.
   *
   * @param options.failOnStderr Should any output to stderr result in a
   * rejected promise?
   * @param options.checkOutput A function invoked with the stdout and stderr
   * buffers of the invoked command, and should return true if the output
   * passes
   */
  async spawn(options: SpawnOptions & { checkOutput(stdout: string, stderr: string, dir: string): boolean }): Promise<void>;
  async spawn(options: SpawnOptions & { checkOutput: false }): Promise<never>;
  async spawn(options: SpawnOptions & { checkOutput: false | ((stdout: string, stderr: string, dir: string) => boolean) }) {
    return <any>new Promise((resolve, reject) => {

      this.spawnedCommand = spawn(this.denaliPath, this.command.split(' '), {
        env: Object.assign({}, process.env, {
          NODE_ENV: this.environment
        }, options.env || {}),
        cwd: this.dir,
        stdio: 'pipe'
      });

      // Cleanup spawned processes if our process is killed
      let cleanup = this.cleanup.bind(this);
      process.on('exit', cleanup.bind(this));

      // Buffer up the output so the polling timer can check it
      let stdoutBuffer = '';
      let stderrBuffer = '';
      let combinedBuffer = '';
      this.spawnedCommand.stdout.on('data', (d) => {
        let output = d.toString();
        stdoutBuffer += output;
        combinedBuffer += output;
      });
      this.spawnedCommand.stderr.on('data', (d) => {
        let output = d.toString();
        stderrBuffer += output;
        combinedBuffer += output;
        if (options.failOnStderr && stderrBuffer.match(/[A-z0-9]/)) {
          process.removeListener('exit', cleanup);
          this.cleanup();
          reject(new FailOnStderrError(this.dir, this.command, combinedBuffer, output));
        }
      });

      // Handle errors from the child process
      this.spawnedCommand.stdout.on('error', reject);
      this.spawnedCommand.stderr.on('error', reject);
      this.spawnedCommand.on('error', reject);
      this.spawnedCommand.on('close', () => {
        this.cleanup();
        reject(new CommandFinishedError(this.dir, this.command, combinedBuffer));
      });

      // Poll periodically to check the results
      this.pollOutput = setInterval(() => {
        if (options.checkOutput) {
          let passed = options.checkOutput(stdoutBuffer, stderrBuffer, this.dir);
          if (passed) {
            process.removeListener('exit', cleanup);
            this.cleanup();
            resolve();
          }
        }
      }, options.pollInterval || 50);

      // Ensure the test fails if we don't pass the test after a while
      let timeout = options.timeout || (process.env.CI ? 5 * MINUTE : 3 * MINUTE);
      this.fallbackTimeout = setTimeout(() => {
        process.removeListener('exit', cleanup);
        this.cleanup();
        reject(new TimeoutError(this.dir, this.command, combinedBuffer, timeout));
      }, timeout);

    });
  }

  /**
   * Internal cleanup method to clean up timers and processes.
   */
  private cleanup() {
    this.spawnedCommand.kill();
    clearInterval(this.pollOutput);
    clearTimeout(this.fallbackTimeout);
  }

}

class CommandFinishedError extends Error {
  constructor(public dir: string, public command: string, public output: string) {
    super(dedent`
      Command acceptance test failed: command finished and did not print the expected output

      ${ dir }
      $ ${ command }
      ${ output }
    `);
    this.stack = '';
  }
}

class FailOnStderrError extends Error {
  constructor(public dir: string, public command: string, output: string, stderr: string) {
    super(dedent`
      ==> Command acceptance test failed: command printed to stderr, and you have failOnStderr enabled
      ==> Test directory: ${ dir }
      ==> Test command: $ ${ command }
      ==> stderr output:
      ${ stderr }
      ==> complete output:
      ${ output }
    `);
    this.stack = '';
  }
}

class TimeoutError extends Error {
  constructor(public dir: string, public command: string, output: string, timeout: number) {
    super(dedent`
      Command acceptance test failed: ${ Math.round(timeout / 1000) }s timeout exceeded

      ${ dir }
      $ ${ command }
      ${ output }
    `);
    this.stack = '';
  }
}
