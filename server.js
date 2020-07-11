const express = require('express');
const path = require('path');
const cors = require('cors');
const bodyParser = require('body-parser');

// disable authorization middleware
//const jwtAuthz = require('express-jwt-authz');
// use authorization middleware like this: jwtAuthz(['read:timesheets'])

// get environment (dev or prod) based on environment variable
const env = process.env.ENV || 'prod';
console.log('environment:', env);
const configuration = env === 'devhosted' ? 'prod' : env;
console.log('configuration:', configuration);
const account = env === 'devhosted' ? 'dev' : env;
console.log('account:', account);

// set the environment in the environment service
const environment = require('./src/modules/environment');
environment.setEnv(account);
environment.setDevMode(configuration === environment.dev);

// import middleware
const requesthandler = require('./src/modules/requesthandler');

// import providers, database, storage, data access, datapipeline, profile, connections, entities, apidocs
const providers = require('./src/providers/providers');
const database = require('./src/data/database');
const dal = require('./src/data/dal');
const datapipeline = require('./src/modules/datapipeline');
const profile = require('./src/modules/profile');
const connections = require('./src/modules/connections');
const entities = require('./src/modules/entities');
const oauth = require('./src/modules/oauth');
const apidocs = require('./src/modules/apidocs');

// import API handlers
const snaphandlers = require('./src/snap/snaphandlers');
const activesnaphandlers = require('./src/snap/activesnaphandlers');
const actionhandlers = require('./src/snap/actionhandlers');
const loghandlers = require('./src/snap/loghandlers');

// beta processing
const beta = require('./src/modules/beta');

// import google auth for checking JWT
const google = require('./src/services/googleauth');

// get persistence provider based on environment variable
const persistenceProvider = process.env.PROVIDER || 'firestore';
console.log('provider:', persistenceProvider);

// set database persistence layer based on provider and environment
database.setProvider(persistenceProvider);
database.setEnv(configuration);

// create the data pipeline based on the environment
datapipeline.createDataPipeline(configuration);

// create a new express app
const app = express();

// enable CORS
app.use(cors());

// enable request body parsing middleware
app.use(bodyParser.json({ limit: '10mb' }));
app.use(bodyParser.urlencoded({
  extended: true
}));

// configure a static file server
app.use(express.static(path.join(__dirname, 'build')));

// create route handlers for modules that process incoming calls
connections.createHandlers(app);
profile.createHandlers(app);
entities.createHandlers(app);
snaphandlers.createHandlers(app);
activesnaphandlers.createHandlers(app);
actionhandlers.createHandlers(app);
loghandlers.createHandlers(app);
beta.createHandlers(app);
oauth.createHandlers(app);
apidocs.createHandlers(app);

// create route handlers for each of the providers
providers.createHandlers(app);

// invoke endpoint: this is only called from the pubsub push subscription
app.post('/invoke', function(req, res){
  console.log('POST /invoke');
  const message = Buffer.from(req.body.message.data, 'base64').toString('utf-8');
  console.log(`\tData: ${message}`);

  const auth = req.headers.authorization;
  const [, token] = auth.match(/Bearer (.*)/);

  // validate the authorization bearer JWT
  if (google.validateJwt(token)) {
    // invoke the data pipeline message handler
    // this will dispatch to the appropriate event handler based on the 'action' in the body
    datapipeline.messageHandler(message);
  }

  res.status(204).send();
});

// main endpoint serves react bundle from /build
app.get('/*', function(req, res) {
  res.sendFile(path.join(__dirname, 'build', 'index.html'));
});

// handle all unauthorized errors by returning a 401
app.use(function (err, req, res, next) {
  if (err.name === 'UnauthorizedError') {
    // return a 401 status with no other payload
    res.status(401).send();
  }
});

// Launch the API Server at PORT, or default port 8080
const port = process.env.PORT || 8080;
app.listen(port, () => {
  console.log('SnapMaster listening on port', port);
});
