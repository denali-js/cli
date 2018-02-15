# Change Log

All notable changes to this project will be documented in this file. See [standard-version](https://github.com/conventional-changelog/standard-version) for commit guidelines.

<a name="0.0.27"></a>
## [0.0.27](https://github.com/denali-js/denali-cli/compare/v0.0.26...v0.0.27) (2018-02-15)


### Bug Fixes

* bump documenter dep ([4dc6553](https://github.com/denali-js/denali-cli/commit/4dc6553))



<a name="0.0.26"></a>
## [0.0.26](https://github.com/denali-js/denali-cli/compare/v0.0.25...v0.0.26) (2018-02-15)


### Bug Fixes

* allow explicit docs option values to override defaults either way ([d59dee4](https://github.com/denali-js/denali-cli/commit/d59dee4))
* switch default app blueprint to use the simpler json(serializer/parser) ([0267ff1](https://github.com/denali-js/denali-cli/commit/0267ff1))



<a name="0.0.25"></a>
## [0.0.25](https://github.com/denali-js/denali-cli/compare/v0.0.24...v0.0.25) (2018-02-11)


### Bug Fixes

* add prepublishOnly script to addon bluprint ([bef4ef8](https://github.com/denali-js/denali-cli/commit/bef4ef8))
* only build docs in prod for addons - for apps, build docs in dev instead ([434f919](https://github.com/denali-js/denali-cli/commit/434f919))



<a name="0.0.24"></a>
## [0.0.24](https://github.com/denali-js/denali-cli/compare/v0.0.23...v0.0.24) (2018-02-10)


### Bug Fixes

* fix bin file local lookup ([985cffb](https://github.com/denali-js/denali-cli/commit/985cffb))


### Features

* add debug flag to command acceptance test ([c6d2fec](https://github.com/denali-js/denali-cli/commit/c6d2fec))



<a name="0.0.23"></a>
## [0.0.23](https://github.com/denali-js/denali-cli/compare/v0.0.22...v0.0.23) (2018-02-10)


### Bug Fixes

* fix command acceptance test dummy app addon install ([b2f8a27](https://github.com/denali-js/denali-cli/commit/b2f8a27))



<a name="0.0.22"></a>
## [0.0.22](https://github.com/denali-js/denali-cli/compare/v0.0.21...v0.0.22) (2018-02-09)


### Bug Fixes

* fix "meaningful output" regex for failOnStderr ([7f7c63a](https://github.com/denali-js/denali-cli/commit/7f7c63a))
* handle case where yarn links directory does not exist ([1145c4d](https://github.com/denali-js/denali-cli/commit/1145c4d))


### Features

* allow global CLI invocations without install denali core ([d321ca8](https://github.com/denali-js/denali-cli/commit/d321ca8))



<a name="0.0.21"></a>
## [0.0.21](https://github.com/denali-js/denali-cli/compare/v0.0.20...v0.0.21) (2018-02-08)


### Bug Fixes

* fix tests ([2fc08e6](https://github.com/denali-js/denali-cli/commit/2fc08e6))



<a name="0.0.20"></a>
## [0.0.20](https://github.com/denali-js/denali-cli/compare/v0.0.19...v0.0.20) (2018-02-08)


### Bug Fixes

* **blueprints:** rename package.json blueprints ([e362ee6](https://github.com/denali-js/denali-cli/commit/e362ee6))
* delay addon discovery until we know it will be needed (i.e. the addon will be built) ([9592fd3](https://github.com/denali-js/denali-cli/commit/9592fd3))
* **blueprints:** update blueprints to match recent changes to denali babel ([485495a](https://github.com/denali-js/denali-cli/commit/485495a))
* add files config to package json to ensure correct files are published ([eb74be5](https://github.com/denali-js/denali-cli/commit/eb74be5))
* check if addon package files exist before attempting to copy into dummy app build ([4e47684](https://github.com/denali-js/denali-cli/commit/4e47684))
* copy top level files into dummy throwaway app for command acceptance tests ([c9107e0](https://github.com/denali-js/denali-cli/commit/c9107e0))
* ensure that failOnStderr errors only occur when meaningful output is printed to stderr ([aec2a86](https://github.com/denali-js/denali-cli/commit/aec2a86))
* fix blueprint paths ([a492deb](https://github.com/denali-js/denali-cli/commit/a492deb))
* ignore errors when unable to communicate with spinner process ([48888d8](https://github.com/denali-js/denali-cli/commit/48888d8))
* only search devDeps for addons for top level builders, since 2nd level devDeps are not installed normally ([67db53b](https://github.com/denali-js/denali-cli/commit/67db53b))
* reenable sourcemaps ([a5dfff6](https://github.com/denali-js/denali-cli/commit/a5dfff6))
* remove dist from main paths when bundling ([ede072a](https://github.com/denali-js/denali-cli/commit/ede072a))
* remove newline from default CLI output ([0fbec35](https://github.com/denali-js/denali-cli/commit/0fbec35))
* remove unused jscodeshift pkg ([96aeeb6](https://github.com/denali-js/denali-cli/commit/96aeeb6))
* update addon blueprint config files, index.js and config files for dummy ([43f3e4f](https://github.com/denali-js/denali-cli/commit/43f3e4f))


### Features

* add support for docs builds ([c784672](https://github.com/denali-js/denali-cli/commit/c784672))
* make spinner API async to allow consumers to wait for spinner process ack ([9d3e43a](https://github.com/denali-js/denali-cli/commit/9d3e43a))
* remove add/remove route methods for now ([2b3ca95](https://github.com/denali-js/denali-cli/commit/2b3ca95))
* remove some folder types from app blueprint ([ccc6c5d](https://github.com/denali-js/denali-cli/commit/ccc6c5d))



<a name="0.0.19"></a>
## [0.0.19](https://github.com/denali-js/denali-cli/compare/v0.0.18...v0.0.19) (2018-01-31)


### Bug Fixes

* **blueprints:** app application adapter incorrect import ([#47](https://github.com/denali-js/denali-cli/issues/47)) ([fee8c63](https://github.com/denali-js/denali-cli/commit/fee8c63))


### Features

* add lib/index.js manifest file for addons ([#41](https://github.com/denali-js/denali-cli/issues/41)) ([3ee213e](https://github.com/denali-js/denali-cli/commit/3ee213e))
* significantly improve CLI startup times ([#42](https://github.com/denali-js/denali-cli/issues/42)) ([a511d66](https://github.com/denali-js/denali-cli/commit/a511d66))



<a name="0.0.18"></a>
## [0.0.18](https://github.com/denali-js/denali-cli/compare/v0.0.17...v0.0.18) (2018-01-31)


### Bug Fixes

* add `main-dir` require to ava config in package.json for app/addon blueprints ([#38](https://github.com/denali-js/denali-cli/issues/38)) ([dc63223](https://github.com/denali-js/denali-cli/commit/dc63223)), closes [#37](https://github.com/denali-js/denali-cli/issues/37)
* update addon babel plugin ([#45](https://github.com/denali-js/denali-cli/issues/45)) ([36d9961](https://github.com/denali-js/denali-cli/commit/36d9961))
* update app babel plugin config ([#44](https://github.com/denali-js/denali-cli/issues/44)) ([36f381f](https://github.com/denali-js/denali-cli/commit/36f381f))
* **blueprint:** Set engines.node to >= 7.6 ([#43](https://github.com/denali-js/denali-cli/issues/43)) ([aed47cf](https://github.com/denali-js/denali-cli/commit/aed47cf))
* **blueprints:** rename raw -> json serializer in app blueprint index action ([1341067](https://github.com/denali-js/denali-cli/commit/1341067))


### Features

* bundled builds ([#49](https://github.com/denali-js/denali-cli/issues/49)) ([69c1ce2](https://github.com/denali-js/denali-cli/commit/69c1ce2))



<a name="0.0.17"></a>
## [0.0.17](https://github.com/denali-js/denali-cli/compare/v0.0.16...v0.0.17) (2017-10-01)


### Bug Fixes

* fix dedent import ([#34](https://github.com/denali-js/denali-cli/issues/34)) ([07e6c42](https://github.com/denali-js/denali-cli/commit/07e6c42))



<a name="0.0.16"></a>
## [0.0.16](https://github.com/denali-js/denali-cli/compare/v0.0.15...v0.0.16) (2017-09-19)



<a name="0.0.15"></a>
## [0.0.15](https://github.com/denali-js/denali-cli/compare/v0.0.14...v0.0.15) (2017-09-19)


### Bug Fixes

* add package.json to build output, needed because addon dummy apps need a package.json to avoid picking up to addons, and it doesnt hurt elsewhere ([39cf01f](https://github.com/denali-js/denali-cli/commit/39cf01f))
* ensure failures to load denali result in error exit code ([0356b31](https://github.com/denali-js/denali-cli/commit/0356b31))


### Features

* add Builder.parentBuilder ([079e5c1](https://github.com/denali-js/denali-cli/commit/079e5c1))
* ensure spinner does not interfere with other process output ([daf72bb](https://github.com/denali-js/denali-cli/commit/daf72bb))



<a name="0.0.14"></a>
## [0.0.14](https://github.com/denali-js/denali-cli/compare/v0.0.13...v0.0.14) (2017-09-02)


### Bug Fixes

* add maindir support to blueprints for addon and app ([4adf3aa](https://github.com/denali-js/denali-cli/commit/4adf3aa))
* addons under test should automatically be built as child builders when running the dummy app ([1961547](https://github.com/denali-js/denali-cli/commit/1961547))
* refactor builder for clarity as well as fixes for building addon dummy apps ([01c42ba](https://github.com/denali-js/denali-cli/commit/01c42ba))



<a name="0.0.13"></a>
## [0.0.13](https://github.com/denali-js/denali-cli/compare/v0.0.11...v0.0.13) (2017-08-30)


### Bug Fixes

* **blueprint:** loosen restriction on denali version in blueprints ([#26](https://github.com/denali-js/denali-cli/issues/26)) ([88c554a](https://github.com/denali-js/denali-cli/commit/88c554a))
* **build:** copy yarn.lock into dist on build ([#13](https://github.com/denali-js/denali-cli/issues/13)) ([ec736dd](https://github.com/denali-js/denali-cli/commit/ec736dd))
* **lint:** add tslint dependency and fix existing lint issues ([#23](https://github.com/denali-js/denali-cli/issues/23)) ([6c5e76e](https://github.com/denali-js/denali-cli/commit/6c5e76e))
* **project:** queue spinner promises on watch ([#20](https://github.com/denali-js/denali-cli/issues/20)) ([8ab9102](https://github.com/denali-js/denali-cli/commit/8ab9102)), closes [#19](https://github.com/denali-js/denali-cli/issues/19)
* allow install/uninstall package methods to accept non-existent packages and still complete as many as possible ([7d07bf3](https://github.com/denali-js/denali-cli/commit/7d07bf3))
* augment plugin summaries with dist dirs ([3a49e93](https://github.com/denali-js/denali-cli/commit/3a49e93))
* clean dist before building ([65844d8](https://github.com/denali-js/denali-cli/commit/65844d8))
* clean up some redundant/unused code ([4103429](https://github.com/denali-js/denali-cli/commit/4103429))
* fix spacing for version announcment ([c44ad9b](https://github.com/denali-js/denali-cli/commit/c44ad9b))
* print version output on single line ([b64814b](https://github.com/denali-js/denali-cli/commit/b64814b))


### Features

* add install/uninstall package methods to blueprint ([a71440d](https://github.com/denali-js/denali-cli/commit/a71440d))
* add main-dir support to find-addons invocation ([7652197](https://github.com/denali-js/denali-cli/commit/7652197))
* remove prepublish step from blueprints since no longer needed with main-dir ([11588b4](https://github.com/denali-js/denali-cli/commit/11588b4))
* show if the CLI or denali installation in use is linked ([9f494f6](https://github.com/denali-js/denali-cli/commit/9f494f6))
* support abbreviated commands; fixes [#17](https://github.com/denali-js/denali-cli/issues/17) ([b8b2d01](https://github.com/denali-js/denali-cli/commit/b8b2d01))
