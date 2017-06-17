import { Tree } from './builder';
import { Watcher } from 'broccoli/lib';
import { resolve } from 'bluebird';
import {
  noop
} from 'lodash';

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
   * Is the watcher currently ready to start a rebuild?
   */
  public readyForRebuild = false;

  /**
   * Is a prebuild currently in progress?
   */
  public prebuildInProgress = false;

  /**
   * Callback invoked when there are changes, but before the rebuild is triggered. If a promise is
   * returned, the rebuild will wait until the promise resolves before starting.
   */
  public beforeRebuild: () => Promise<void> | void;

  // tslint:disable-next-line:member-ordering
  constructor(tree: Tree, options: { beforeRebuild(): Promise<void> | void, interval: number }) {
    super(tree, options);
    this.beforeRebuild = options.beforeRebuild || noop;
  }

  /**
   * Patch the detectChanges to hide changes until beforeRebuild resolves
   */
  public detectChanges() {
    let changedDirs = super.detectChanges();
    if (changedDirs.length > 0) {
      if (!this.readyForRebuild) {
        if (!this.prebuildInProgress) {
          this.prebuildInProgress = true;
          resolve(this.beforeRebuild()).then(() => {
            this.readyForRebuild = true;
            this.prebuildInProgress = false;
          });
        }
      } else {
        this.readyForRebuild = false;
        this.emit('buildstart');
        return changedDirs;
      }
    }
    return [];
  }

}
