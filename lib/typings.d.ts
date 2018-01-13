declare module "try-require";
declare module "copy-dereference";
declare module "is-directory";
declare module "jscodeshift";
declare module "walk-sync";
declare module "require-tree";
declare module "read-pkg-up";
declare module "read-pkg";
declare module "pkg-dir";
declare module "nested-error-stacks";
declare module "dedent-js";
declare module "nsp";
declare module "ora";
declare module "broccoli" {
  export type Tree = {};
  export interface BuildResults {
    directory: string;
    graph: any;
  }
  export class Builder {
    constructor(treeToBuild: Tree);
    cleanup(): void;
    build(): Promise<BuildResults>;
  }
}
declare module "broccoli-slow-trees";
declare module "broccoli-plugin";
declare module "broccoli-funnel";
declare module "broccoli-filter";
declare module "broccoli-concat/concat";
declare module "fast-sourcemap-concat";
declare module "symlink-or-copy";
declare module "broccoli-stew";
declare module "broccoli-file-creator";
declare module "broccoli-merge-trees";
declare module "yarn/lib/constants" {
  export const GLOBAL_MODULE_DIRECTORY: string;
  export const LINK_REGISTRY_DIRECTORY: string;
}
declare module "command-exists";
declare module "broccoli/lib" {
  class Watcher {
    constructor(tree: any, options: any)
    detectChanges(): string[];
    emit: (e: string) => void;
    on: (e: string, cb: (...args: any[]) => void) => void;
  }
}
