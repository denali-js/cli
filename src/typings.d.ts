declare module "try-require";
declare module "copy-dereference";
declare module "is-directory";
declare module "jscodeshift";
declare module "walk-sync";
declare module "require-tree";
declare module "dedent-js";
declare module "nsp";
declare module "ora";
declare module "broccoli";
declare module "broccoli-slow-trees";
declare module "broccoli-plugin";
declare module "broccoli-funnel";
declare module "broccoli-merge-trees";
declare module "yarn/lib/constants" {
  export const GLOBAL_MODULE_DIRECTORY: string;
  export const LINK_REGISTRY_DIRECTORY: string;
}
declare module "command-exists";
declare module "broccoli/lib" {
  class Watcher {
    constructor(tree: any, options: any)
    protected _ready: boolean;
    protected _rebuildScheduled: boolean;
    protected _quitting: boolean;
    protected currentBuild: Promise<any>;
    protected options: any;
    public start(): Promise<void>;
    public quit(): Promise<void>;
    protected _change();
    protected _build(): Promise<void>;
    trigger: (e: string) => void;
    on: (e: string, cb: (...args: any[]) => void) => void;
  }
}
