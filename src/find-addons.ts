import {
  merge
} from 'lodash';
import * as path from 'path';
import findPlugins, { PluginSummary } from 'find-plugins';
import { execSync } from 'child_process';
import { sync as commandExists } from 'command-exists';
import * as YarnConstants from 'yarn/lib/constants';


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
    keyword: 'denali-addon'
  };

  if (isLocal) {
    return findPlugins(findOptions);
  }

  let addons = findPlugins(merge({
    dir: execSync('npm root -g').toString().trim(),
    scanAllDirs: true
  }, findOptions));

  // Because yarn stores it's global modules separately, and doesn't yet support the `root` command,
  // we have to double check yarn's global installs for any denali addons. The easiest way of
  // determining that location is to simply include yarn and require it directly. Ugly, but until
  // they add `root`, our best option. We have to do the same for linked packages to allow for
  // development of global addons (like denali itself)
  // TODO shell out to `yarn root` once yarnpkg/yarn#2388 is fixed
  if (commandExists('yarn')) {
    let globalInstalledYarnAddons = addons.concat(findPlugins(merge({
      dir: path.join(YarnConstants.GLOBAL_MODULE_DIRECTORY, 'node_modules'),
      scanAllDirs: true
    }, findOptions)));
    let globalLinkedYarnAddons = addons.concat(findPlugins(merge({
      dir: YarnConstants.LINK_REGISTRY_DIRECTORY,
      scanAllDirs: true
    }, findOptions)));
    addons = addons.concat(globalInstalledYarnAddons, globalLinkedYarnAddons);
  }

  return addons;

}
