declare module "try-require";
declare module "copy-dereference";
declare module "is-directory";
declare module "jscodeshift";
declare module "walk-sync";
declare module "require-directory";
declare module "dedent-js";
declare module "nsp";
declare module "broccoli";
declare module "broccoli-slow-trees";
declare module "broccoli-plugin";
declare module "broccoli-funnel";
declare module "broccoli-merge-trees";
declare module "broccoli/lib" {
  class Watcher {
    constructor(tree: any, options: any)
    detectChanges():string[]
  }
}