// some generic database get/set functions for various entities
// 
// setup:
//   setProvider: sets the provider
//   setEnv: set enviroment (dev / prod)
// wrapper methods:
//   getDocument: get a document from a collection
//   storeDocument: store a document into a collection
//   storeBatch: shred an array into a batch of documents in a collection
//   query: query for documents across a collection, consolidate into an array 
//   getAllUsers: get all users stored in system as an array
//   getUserCollections: get all collections for the user
//   getUserData: get user info from provider
//   setUserData: set user info in provider
//   removeConnection: remove connection for user in provider
//   removeDocument: remove a document from a collection
//   tokenExpired: check whether access token expired

// import constants
const dbconstants = require('./database-constants')

// import providers
const firestore = require('./database-firestore')
const memory = require('./database-memory')

// define providers hash
const providers = {
  firestore: firestore,
  memory: memory
}

// define name of metadata "collection"
exports.metadata = '__metadata';

// set the provider
var provider = providers['firestore']

// set the provider to use for persistence (default to firestore)
exports.setProvider = (prov = 'firestore') => {
  provider = providers[prov]
}

// set the environment (dev or prod)
exports.setEnv = (env = 'prod') => {
  // ensure there is a setEnv method before calling it
  provider.setEnv && provider.setEnv(env);

  // for non-production environments, append env to metadata collection name
  if (env !== 'prod') {
    exports.metadata = `__metadata-${env}`;
  }
}

// get a document from a collection
exports.getDocument = async (userId, collection, name) => {
  return await provider.getDocument(userId, collection, name);
}

// store a document into a collection
exports.storeDocument = async (userId, collection, name, data) => {
  return await provider.storeDocument(userId, collection, name, data);
}

// store a batch of documents passed in as data, using key as a name
exports.storeBatch = async (userId, collection, data, key, overwrite = false) => {
  return await provider.storeBatch(userId, collection, data, key, overwrite);
}

// query for documents in a collection optionally based on a field value
// return the results as an array of objects
exports.query = async (userId, collection, field = null, value = null) => {
  return await provider.query(userId, collection, field, value);
}

// query for documents in a collection group, optionally based on a field value
// return the results as an array of objects
exports.queryGroup = async (userId, collection, field = null, value = null) => {
  return await provider.queryGroup(userId, collection, field, value);
}

// get all users
exports.getAllUsers = async () => {
  const users = await provider.getAllUsers();

  // filter out the system info synthetic user
  return users.filter(u => u !== dbconstants.systemInfo && u !== dbconstants.signups);
}

// get user collections
exports.getUserCollections = async (userId) => {
  return await provider.getUserCollections(userId);
}

// get user data by userid 
exports.getUserData = async (userId, connection) => {
  return await provider.getUserData(userId, connection)
}

// store user data by userid
exports.setUserData = async (
  userId,                // userid to store data for
  connection,            // which connection to use
  data) => {             // data to store
  return await provider.setUserData(userId, connection, data)
}

// remove a section for a particular connection
exports.removeConnection = async (
  userId,                // userid to store data for
  connection) => {       // which connection to remove
  return await provider.removeConnection(userId, connection)
}

// remove a document from a particular entity collection
exports.removeDocument = async (
  userId,                // userid to store data for
  collection,            // which collection to change
  id) => {               // which document to remove
  return await provider.removeDocument(userId, collection, id)
}

exports.tokenExpired = (user) => {
  return provider.tokenExpired(user);
}
