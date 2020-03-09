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

// import the auth0 service
const auth0 = require('./src/services/auth0');

// import middleware
const { checkJwt, processUser } = require('./src/modules/requesthandler');

// import providers, database, storage, data access, datapipeline, profile, connections layers
const providers = require('./src/providers/providers');
const database = require('./src/data/database');
const dbconstants = require('./src/data/database-constants');
const dal = require('./src/data/dal');
const datapipeline = require('./src/modules/datapipeline');
const profile = require('./src/modules/profile');
const connections = require('./src/modules/connections');

// import snap data access layer
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

// create route handlers for each of the providers
providers.createHandlers(app);

// create a set of route handlers for the non-provider API calls
//

// Get connections API endpoint
//app.get('/connections', checkJwt, jwtAuthz(['read:timesheets']), function(req, res){
app.get('/connections', checkJwt, processUser, function(req, res){
  const returnConnections = async () => {
    const conns = await connections.getConnections(req.userId) || {};
    res.status(200).send(conns);
  }
  returnConnections();
});

// Post connections API endpoint adds or removes a simple connection
app.post('/connections', checkJwt, processUser, function(req, res){
  const action = req.body && req.body.action;
  const provider = req.body && req.body.provider;

  const add = async () => {
    await connections.addConnection(req.userId, provider);
    res.status(200).send({ message: 'success'});
  }

  const remove = async () => {
    await connections.removeConnection(req.userId, provider);
    res.status(200).send({ message: 'success'});
  }

  if (action === 'add' && provider) {
    add();
    return;
  }

  if (action === 'remove' && provider) {
    remove();
    return;
  }

  res.status(200).send({ message: 'Unknown action'});  
});

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

// Get gallery API endpoint
app.get('/gallery', checkJwt, processUser, function(req, res){
  const returnGallery = async () => {
    const gallery = await snapdal.getAllSnaps() || {};
    res.status(200).send(gallery);
  }
  returnGallery();
});

// Get profile API endpoint
app.get('/profile', checkJwt, processUser, function(req, res){
  const returnProfile = async () => {
    // retrieve the profile data from the app and from auth0 
    const appProfile = await profile.getProfile(req.userId) || {};
    const auth0profile = await auth0.getAuth0Profile(req.userId);

    // create a consolidated profile with app data overwriting auth0 data
    const fullProfile = {...auth0profile, ...appProfile};

    // ensure the [identities] come fresh from auth0 
    if (auth0profile && auth0profile.identities) {
      fullProfile.identities = auth0profile.identities;
    }
    res.status(200).send(fullProfile);
  }
  returnProfile();
});

// Post profile API endpoint
app.post('/profile', checkJwt, processUser, function(req, res){
  const storeProfile = async () => {
    await profile.storeProfile(req.userId, req.body);
    res.status(200).send({ message: 'success' });
  }
  storeProfile();
});

// Get snaps API endpoint
app.get('/snaps', checkJwt, processUser, function(req, res){
  const returnSnaps = async () => {
    const snaps = await snapdal.getSnaps(req.userId) || {};
    res.status(200).send(snaps);
  }
  returnSnaps();
});
  

// Get snap API endpoint
app.get('/snaps/:userId/:snapId', checkJwt, processUser, function(req, res){
  const userId = decodeURI(req.params.userId);
  const snapId = req.params.snapId;
  if (!userId || !snapId) {
    res.status(200).send({ message: 'error'});
    return;
  }

  const returnSnap = async () => {
    const snap = await snapdal.getSnap(userId, snapId) || {};
    res.status(200).send(snap);
  }
  returnSnap();
});
  
// Post snaps API endpoint
// this will fork an existing snap with snapId
// TODO: add a code path that creates a new snap
app.post('/snaps', checkJwt, processUser, function(req, res){
  const action = req.body.action;
  const snapId = req.body.snapId;
  
  const createSnap = async () => {
    const definition = req.body.definition;
    await snapdal.createSnap(req.userId, definition);
    res.status(200).send({ message: 'success' });
  }

  const deleteSnap = async () => {
    await snapdal.deleteSnap(req.userId, snapId);
    res.status(200).send({ message: 'success' });
  }

  const forkSnap = async () => {
    await snapdal.forkSnap(req.userId, snapId);
    res.status(200).send({ message: 'success' });
  }

  if (action === 'create') {
    createSnap();
    return;
  }

  if (action === 'delete' && snapId) {
    deleteSnap();
    return;
  }

  if (action === 'fork' && snapId) {
    forkSnap();
    return;
  }

  res.status(200).send({ message: 'Unknown action'});  
});

// Get active snaps API endpoint
app.get('/activesnaps', checkJwt, processUser, function(req, res){
  const returnSnaps = async () => {
    const snaps = await snapdal.getActiveSnaps(req.userId) || {};
    res.status(200).send(snaps);
  }
  returnSnaps();
});
  
// Post active snaps API endpoint
app.post('/activesnaps', checkJwt, processUser, function(req, res){
  const action = req.body.action;
  const snapId = req.body.snapId;
  
  const activateSnap = async () => {
    const status = await snapdal.activateSnap(req.userId, snapId, req.body.params);
    res.status(200).send(status);
  }

  const deactivateSnap = async () => {
    const status = await snapdal.deactivateSnap(req.userId, snapId);
    res.status(200).send(status);
  }

  if (action === 'activate' && snapId) {
    activateSnap();
    return;
  }

  if (action === 'deactivate' && snapId) {
    deactivateSnap();
    return;
  }

  res.status(200).send({ message: 'Unknown action'});  
});

// Link API endpoint
// body: 
//  { 
//    action: 'link' | 'unlink',
//    primaryUserId <could be empty, in which case use req.user[sub]>
//    secondaryUserId <in the format 'provider|userid'>
//  }
app.post('/link', checkJwt, function(req, res){
  const userId = req.body && req.body.primaryUserId || req.user['sub'];
  const action = req.body && req.body.action;
  const secondaryUserId = req.body && req.body.secondaryUserId;
  console.log(`POST /link: ${action} ${userId}, ${secondaryUserId}`);

  const link = async () => {
    // link accounts
    const data = await auth0.linkAccounts(userId, secondaryUserId);

    // set refresh history flag
    if (data) {
      await database.setUserData(userId, dbconstants.refreshHistory, { refresh: true });
      res.status(200).send(data);  
    } else {
      res.status(200).send({ message: 'link failed' });
    }
  }

  const unlink = async () => {
    const data = await auth0.unlinkAccounts(userId, secondaryUserId);
    res.status(200).send(data || { message: 'unlink failed' });
  }

  if (action === 'link' && userId && secondaryUserId) {
    link();
    return;
  }

  if (action === 'unlink' && userId && secondaryUserId) {
    unlink();
    return;
  }

  res.status(200).send({ message: 'Unknown action'});
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

// request access endpoint: this is an unauthenticated request that stores 
// an email address that requests access to the beta
app.post('/requestaccess', function(req, res){
  console.log('POST /requestaccess');
  const email = req.body.email;
  console.log(`\Email: ${email}`);

  // validate simple auth token
  const auth = req.headers.authorization;
  const [, token] = auth.match(/Bearer (.*)/);
  const phrase = Buffer.from(token, 'base64').toString();
  const regex = new RegExp(`${email}SnapMaster`);
  const isValid = phrase.match(regex);

  const requestAccess = async () => {
    await beta.requestAccess(email, req.body);
    res.status(200).send();
  }

  if (isValid) {
    requestAccess();
  }
});

// validate code: this is an unauthenticated request that validates an email
// has been authorized to join the beta
app.post('/validatecode', function(req, res){
  console.log('POST /validatecode');
  const email = req.body.email;
  console.log(`\Email: ${email}`);

  // validate simple auth token
  const auth = req.headers.authorization;
  const [, token] = auth.match(/Bearer (.*)/);
  const phrase = Buffer.from(token, 'base64').toString();
  const regex = new RegExp(`${email}SnapMaster`);
  const isValid = phrase.match(regex);
  
  const validateEmail = async () => {
    const data = beta.validateEmail(email);
    res.status(200).send(data);
  }

  if (isValid) {
    validateEmail();
  } else {
    res.status(200).send();
  }
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
