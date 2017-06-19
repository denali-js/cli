export default function environmentConfig(environment) {
  let config = {
    server: {
      port: process.env.PORT || 3000
    },
    // == Migrations
    //
    // If you are planning on using migrations with your database, uncomment this
    // section and provide the relevant database driver and connection details
    //
    // migrations: {
    //   db: {
    //     client: 'pg',
    //     connection: {}
    //   }
    // },
    database: {

    }
  };

  if (environment === 'development') {
    // development-specific config
  }

  if (environment === 'production') {
    // production-specific config

    // == SSL
    //
    // You can start Denali in SSL mode by providing your private key and
    // certificate, or your pfx file contents
    //
    // config.server.ssl = {
    //   key: fs.readFileSync('privatekey.pem'),
    //   cert: fs.readFileSync('certificate.pem')
    // };
    //
    // or,
    //
    // config.server.ssl = {
    //   pfx: fs.readFileSync('server.pfx')
    // };
    //
  }

  return config;
}
