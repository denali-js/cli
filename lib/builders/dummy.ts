import * as path from 'path';
import { without } from 'lodash';
import AppBuilder from './app';

export default class DummyBuilder extends AppBuilder {

  sources() {
    let sources = without(super.sources(), 'test');
    sources.push(path.join(this.dir, '..'));
    return sources;
  }

}
