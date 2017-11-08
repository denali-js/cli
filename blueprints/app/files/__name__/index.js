const Bundle = require('./dist/bundle');

let container = Bundle();
let application = container.lookup('app:application');
application.start();

export default application;
