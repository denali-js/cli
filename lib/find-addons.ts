import {
  merge
} from 'lodash';
import * as path from 'path';
import * as fs from 'fs';
import findPlugins, { PluginSummary } from 'find-plugins';
import { execSync } from 'child_process';
import { sync as commandExists } from 'command-exists';
import * as YarnConstants from 'yarn/lib/constants';
import * as createDebug from 'debug';

const debug = createDebug('denali-cli:find-addons');


/**
 * Discover any addons for the current directory. If the current directory is a Denali project, load
 * addons from the local node_modules folder, using the local package.json as a guide.
 *
 * If the current directory is not a Denali project, load the addons from the global node_modules
 * folder (both yarn and npm are supported), and scan all the global packages for addon (rather than
 * relying on a package.json guide).
 */
export default function findAddons(isLocal: boolean): PluginSummary[] {

  let findOptions = {
    sort: true,
    configName: 'denali',
    keyword: 'denali-addon',
    includeDev: true
  };

  if (isLocal) {
    debug(`searching for addons locally in ${ process.cwd() }`);
    let addons = findPlugins(findOptions);
    addMainDir(addons);
    return addons;
  }

  let npmRoot = execSync('npm root -g').toString().trim();
  debug(`searching for addons globally in npm root: ${ npmRoot }`);
  let addons = findPlugins(merge({
    dir: npmRoot,
    scanAllDirs: true
  }, findOptions));

  // Because yarn stores it's global modules separately, and doesn't yet support the `root` command,
  // we have to double check yarn's global installs for any denali addons. The easiest way of
  // determining that location is to simply include yarn and require it directly. Ugly, but until
  // they add `root`, our best option. We have to do the same for linked packages to allow for
  // development of global addons (like denali itself)
  // TODO shell out to `yarn root` once yarnpkg/yarn#2388 is fixed
  if (commandExists('yarn')) {
    let yarnGlobalInstalls = path.join(YarnConstants.GLOBAL_MODULE_DIRECTORY, 'node_modules');
    debug(`searching for addons globally in yarn global installs: ${ yarnGlobalInstalls }`);
    if (fs.existsSync(yarnGlobalInstalls)) {
      addons = addons.concat(findPlugins(merge({
        dir: yarnGlobalInstalls,
        scanAllDirs: true
      }, findOptions)));
    } else {
      debug(`Tried to load globally installed addons from yarn, but ${ yarnGlobalInstalls } doesn't exist, skipping ...`);
    }
    let yarnGlobalLinks = YarnConstants.LINK_REGISTRY_DIRECTORY;
    debug(`searching for addons globally in yarn global links: ${ yarnGlobalLinks }`);
    if (fs.existsSync(yarnGlobalLinks)) {
      addons = addons.concat(findPlugins(merge({
        dir: yarnGlobalLinks,
        scanAllDirs: true
      }, findOptions)));
    } else {
      debug(`Tried to load globally linked addons from yarn, but ${ yarnGlobalLinks } doesn't exist, skipping ...`);
    }
  }

  addMainDir(addons);

  return addons;

}

function addMainDir(addons: PluginSummary[]) {
  addons.forEach((addon) => {
    if (addon.pkg.mainDir) {
      addon.dir = path.join(addon.dir, addon.pkg.mainDir);
    }
  });
}