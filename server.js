const express = require('express');
const path = require('path');
const cors = require('cors');
const bodyParser = require('body-parser');
const jwtAuthz = require('express-jwt-authz');

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
const { checkJwt, processUser } = require('./src/modules/requesthandler');

// import providers, database, storage, data access, datapipeline, profile, connections, entities, apidocs layers
const providers = require('./src/providers/providers');
const database = require('./src/data/database');
const dal = require('./src/data/dal');
const datapipeline = require('./src/modules/datapipeline');
const profile = require('./src/modules/profile');
const connections = require('./src/modules/connections');
const entities = require('./src/modules/entities');
const apidocs = require('./src/modules/apidocs');

// import snap data access layer and engine
const snapdal = require('./src/snap/snap-dal');


// beta processing
const beta = require('./src/modules/beta');

// import google provider for checking JWT
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

// Enable CORS
app.use(cors());

// Enable the use of request body parsing middleware
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
snapdal.createHandlers(app);
beta.createHandlers(app);
apidocs.createHandlers(app);

// create route handlers for each of the providers
providers.createHandlers(app);

// create a set of route handlers for the non-provider API calls
// these should trend towards zero as they get refactored out


// Get metadata API endpoint
app.get('/metadata', checkJwt, processUser, function(req, res){
  const returnMetadata = async () => {
    const metadata = await dal.getMetadata(req.userId) || {};
    res.status(200).send(metadata);
  }
  returnMetadata();
});
  
// Get history API endpoint
app.get('/history', checkJwt, processUser, function(req, res){
  const returnHistory = async () => {
    const history = await dal.getHistory(req.userId) || {};
    res.status(200).send(history);
  }
  returnHistory();
});



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


// Get timesheets API endpoint (OLD - ONLY HERE TO SHOW jwtAuthz)
app.get('/timesheets', checkJwt, jwtAuthz(['read:timesheets']), function(req, res){
  res.status(200).send({});
});

// main endpoint serves react bundle from /build
app.get('/*', function(req, res) {
  res.sendFile(path.join(__dirname, 'build', 'index.html'));
});

// Launch the API Server at PORT, or default port 8080
const port = process.env.PORT || 8080;
app.listen(port, () => {
  console.log('SnapMaster listening on port', port);
});
