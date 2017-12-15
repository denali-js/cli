import 'main-dir';
import * as sourcemaps from 'source-map-support';
import * as path from 'path';
import Application from './application';

sourcemaps.install();

let application = new Application({
  environment: process.env.NODE_ENV || 'development',
  dir: path.dirname(__dirname)
});

application.start();

export default application;
