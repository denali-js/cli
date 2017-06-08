import { Tree } from './builder';
import { Watcher } from 'broccoli/lib';
import { resolve } from 'bluebird';
import * as createDebug from 'debug';
import {
  noop
} from 'lodash';

const debug = createDebug('denali-cli:watcher');

/**
 * The PausingWatcher class is a hack around a limitation of Broccoli's internal Watcher, which
 * performs file-watching and rebuild triggering.
 *
 * The internal Watcher doesn't allow for delaying the triggered rebuild; as soon as changes are
 * seen, it starts rebuilding.
 *
 * However, in Denali's case, while running tests, if Broccoli triggers a rebuild it will wipe out
 * the built files immediately. This means that the in-flight tests will continue running, but the
 * source files will be wiped out, resulting in cryptic and bizarre errors.
 *
 * So we patch the Watcher class here to allow us to capture and delay the rebuild signal until
 * some arbitrary async condition is fulfilled (in our case, until the test process is completely
 * killed).
 */
export default class PausingWatcher extends Watcher {

  /**
   * Callback invoked when there are changes, but before the rebuild is triggered. If a promise is
   * returned, the rebuild will wait until the promise resolves before starting.
   */
  public beforeRebuild: () => Promise<void> | void;

  constructor(tree: Tree, options: { debounce: number, beforeRebuild(): Promise<void> | void }) {
    super(tree, options);
    this.beforeRebuild = options.beforeRebuild || noop;
  }

  /**
   * Patch broccol watcher's _change method to handle the change event
   */
  protected _change() {
    if (!this._ready) {
      debug('change ignored: not ready');
      return;
    }

    if (this._rebuildScheduled) {
      debug('change ignored: rebuild already scheduled');
      return;
    }

    this._rebuildScheduled = true;
    // Wait for current build, and ignore build failure
    // tslint:disable:next-line no-empty
    resolve(this.currentBuild).catch(() => {}).then(() => {
      if (this._quitting) { return; }
      this.currentBuild = new Promise((resolve) => {
        debug('debouncing build');
        this.trigger('debounce');
        setTimeout(resolve, this.options.debounce);
      }).then(() => resolve(this.beforeRebuild())).then(() => {
        this._rebuildScheduled = false;
        return this._build();
      });
    });
  }

}
