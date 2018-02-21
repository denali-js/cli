import {
  merge
} from 'lodash';
import * as path from 'path';
import * as fs from 'fs';
import findPlugins, { PluginSummary } from 'find-plugins';
import { execSync } from 'child_process';
import { sync as commandExists } from 'command-exists';
import * as createDebug from 'debug';

const debug = createDebug('@denali-js/cli:find-addons');

export interface AddonSummary extends PluginSummary {
  distDir?: string;
}

/**
 * Discover any addons for the current directory. If the current directory is a Denali project, load
 * addons from the local node_modules folder, using the local package.json as a guide.
 *
 * If the current directory is not a Denali project, load the addons from the global node_modules
 * folder (both yarn and npm are supported), and scan all the global packages for addon (rather than
 * relying on a package.json guide).
 */
export default function findAddons(isLocal: boolean): AddonSummary[] {

  let findOptions = {
    sort: true,
    configName: 'denali',
    keyword: 'denali-addon',
    includeDev: true
  };

  if (isLocal) {
    debug(`searching for addons locally in ${ process.cwd() }`);
    let addons = findPlugins(findOptions);
    return finalizeAddons(addons);
  }

  let addons: PluginSummary[] = [];

  if (commandExists('yarn')) {
    let yarnGlobal = execSync('yarn global dir').toString().trim();
    let yarnGlobalInstalls = path.join(yarnGlobal, 'node_modules');
    debug(`searching for addons globally in yarn global installs: ${ yarnGlobalInstalls }`);
    if (fs.existsSync(yarnGlobalInstalls)) {
      addons = addons.concat(findPlugins(merge({
        dir: yarnGlobalInstalls
      }, findOptions)));
    } else {
      debug(`Tried to load globally installed addons from yarn, but ${ yarnGlobalInstalls } doesn't exist, skipping ...`);
    }
    let yarnGlobalLinks = path.join(path.dirname(yarnGlobal), 'link');
    debug(`searching for addons globally in yarn global links: ${ yarnGlobalLinks }`);
    if (fs.existsSync(yarnGlobalLinks)) {
      addons = addons.concat(findPlugins(merge({
        dir: yarnGlobalLinks,
        scanAllDirs: true
      }, findOptions)));
    } else {
      debug(`Tried to load globally linked addons from yarn, but ${ yarnGlobalLinks } doesn't exist, skipping ...`);
    }
  } else {
    let npmRoot = execSync('npm root -g').toString().trim();
    debug(`searching for addons globally in npm root: ${ npmRoot }`);
    addons = addons.concat(findPlugins(merge({
      dir: npmRoot,
      scanAllDirs: true
    }, findOptions)));
  }

  return finalizeAddons(addons);
}

function finalizeAddons(addons: AddonSummary[]) {
  addons.forEach((addon) => {
    addon.distDir = path.join(addon.dir, 'dist');
  });
  let addonDebugList = addons.map((addon) => {
    return `  - ${ addon.pkg.name } [${ addon.dir }]\n`;
  }).join('');
  debug(`found ${ addons.length } addons:\n${ addonDebugList }`);
  return addons;
}
