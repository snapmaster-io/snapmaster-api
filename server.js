const express = require('express');
const path = require('path');
const cors = require('cors');
const bodyParser = require('body-parser');

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

// import providers, database, storage, data access, profile, connections, entities, apidocs, events
const providers = require('./src/providers/providers');
const database = require('./src/data/database');
const profile = require('./src/modules/profile');
const connections = require('./src/modules/connections');
const entities = require('./src/modules/entities');
const oauth = require('./src/modules/oauth');
const apidocs = require('./src/modules/apidocs');
const events = require('./src/modules/events');

// import API handlers
const snaphandlers = require('./src/snap/snaphandlers');
const activesnaphandlers = require('./src/snap/activesnaphandlers');
const actionhandlers = require('./src/snap/actionhandlers');
const loghandlers = require('./src/snap/loghandlers');

// beta processing
const beta = require('./src/modules/beta');

// get persistence provider based on environment variable
const persistenceProvider = process.env.PROVIDER || 'firestore';
console.log('provider:', persistenceProvider);

// set database persistence layer based on provider and environment
database.setProvider(persistenceProvider);
database.setEnv(configuration);

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
  const message = `SnapMaster service started on port ${port}`;
  console.log(message);

  // if running in a hosted environment, send an event on the pubsub topic
  if (!environment.getDevMode()) {
    events.post(message);
  }
});
