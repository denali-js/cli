import {
  merge
} from 'lodash';
import * as path from 'path';
import findPlugins, { PluginSummary } from 'find-plugins';
import { execSync } from 'child_process';
import { sync as commandExists }from 'command-exists';
import * as YarnConstants from 'yarn/lib/constants';


export default function findAddons(isLocal: boolean): PluginSummary[] {

  let findOptions = {
    sort: true,
    configName: 'denali',
    keyword: 'denali-addon'
  };

  if (isLocal) {
    return findPlugins(merge({
      modulesDir: path.join(process.cwd(), 'node_modules'),
    }, findOptions));
  }

  let addons = findPlugins({
    modulesDir: execSync('npm root -g').toString().trim()
  });

  // Because yarn stores it's global modules separately, and doesn't yet support the `root` command,
  // we have to double check yarn's global installs for any denali addons. The easiest way of
  // determining that location is to simply include yarn and require it directly. Ugly, but until
  // they add `root`, our best option. We have to do the same for linked packages to allow for
  // development of global addons (like denali itself)
  // TODO shell out to `yarn root` once yarnpkg/yarn#2388 is fixed
  if (commandExists('yarn')) {
    let globalInstalledYarnAddons = addons.concat(findPlugins(merge({
      modulesDir: path.join(YarnConstants.GLOBAL_MODULE_DIRECTORY, 'node_modules'),
      scanAllDirs: true
    }, findOptions)));
    let globalLinkedYarnAddons = addons.concat(findPlugins(merge({
      modulesDir: YarnConstants.LINK_REGISTRY_DIRECTORY,
      scanAllDirs: true
    }, findOptions)));
    addons = addons.concat(globalInstalledYarnAddons, globalLinkedYarnAddons);
  }

  return addons;

}