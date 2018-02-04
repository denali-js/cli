const bundle = require('../../tmp/-dummy/dummy.bundle');
const container = bundle();

const Application = container.lookup('app:application');
const application = new Application(container.loader, { environment: process.env.NODE_ENV || 'development' });
application.start();

module.exports = application;

