// a firestore-based implementation of the database API

const Firestore = require('@google-cloud/firestore');
const dbconstants = require('./database-constants');
const environment = require('../modules/environment');
const cloudConfigFile = environment.getCloudPlatformConfigFile();
const projectId = environment.getProjectId();

const db = new Firestore({
  projectId: projectId,
  keyFilename: cloudConfigFile,
});

var users = db.collection('users');

// set the environment
exports.setEnv = (env) => {
  // the only impact for dev environment is to use a different collection
  if (env === 'dev') {
    users = db.collection('users-dev');
  }
};

// get a document from a collection
exports.getDocument = async (userId, collection, name) => {
  try {
    const doc = await users.doc(userId).collection(collection).doc(name).get();
    if (!doc.exists) {
      return null;
    }
    const data = doc.data();
    return data;
  } catch (error) {
    console.log(`getDocument: caught exception: ${error}`);
    return null;
  }  
}

// store a document into a collection
exports.storeDocument = async (userId, collection, name, data) => {
  try {
    const doc = users.doc(userId).collection(collection).doc(name);
    await doc.set(data);
  } catch (error) {
    console.log(`storeDocument: caught exception: ${error}`);
    return null;
  }  
}

// store a batch of documents passed in as data, using key as a name
exports.storeBatch = async (userId, collection, data, key, overwrite) => {
  try {    
    const coll = users.doc(userId).collection(collection);

    // await the completion of all documents, which are run in parallel
    await Promise.all(data.map(async (element) => {
      const keyString = '' + key;  // ensure key is a string
      const name = element[keyString];
      const docName = coll.doc(name);
      try {
        if (overwrite) {
          // overwrite the document regardless of whether it exists
          await docName.set(element);
        } else {
          // store the document only if it doesn't yet exist
          const doc = await docName.get();
          if (!doc.exists) {
            await docName.set(element);
          }
        }
      } catch (error) {
        console.log(`storeBatch: caught exception ${error} while storing ${name}`);
      }
    }));
  } catch (error) {
    console.log(`storeBatch: caught exception: ${error}`);
    return null;
  }  
}

// query for documents in a collection optionally based on a field value
// return the results as an array of objects
exports.query = async (userId, collection, field, value) => {
  try {
    const col = users.doc(userId).collection(collection);
    let snapshot;
    if (field && value) {
      // a query was passed in, so query the collection
      const query = col.where(field, '==', value);
      snapshot = await query.get();
    } else {
      // query was not passed in, so return all data in the collection
      snapshot = await col.get();
    }

    // get list of documents in snapshot, except __invoke_info
    const docArray = snapshot.docs.filter(item => item.id !== dbconstants.invokeInfo);

    // create a combined array with an entry from each document
    const array = docArray.map(doc => doc.data());

    // return results
    return array;
  } catch (error) {
    console.log(`query: caught exception: ${error}`);
    return null;
  }  
}

// query for documents in a collection group, optionally based on a field value
// return the results as an array of objects
exports.queryGroup = async (userId, collection, field, value) => {
  try {
    const col = db.collectionGroup(collection);
    let query = col.where(dbconstants.metadataUserIdField, '==', userId);
    if (field && value) {
      // a query was passed in, so chain it to the query
      query = query.where(field, '==', value);
    } 

    // get the document array that contains the query results
    const docArray = await query.get();

    // create a combined array with an entry from each document
    const array = docArray.docs.map(doc => doc.data());

    // return results
    return array;
  } catch (error) {
    console.log(`query: caught exception: ${error}`);
    return null;
  }  
}

// get all users as an array 
exports.getAllUsers = async () => {
  try {
    const snapshot = await users.get();
    return snapshot.docs.map(doc => doc.id);
  } catch (error) {
    console.log(`getAllUsers: caught exception: ${error}`);
    return null;
  }
}

// get user collections as an array
exports.getUserCollections = async (userId) => {
  try {
    const user = users.doc(userId);
    const snapshot = await user.listCollections();
    return snapshot.map(coll => coll.id);
  } catch (error) {
    console.log(`getUserCollections: caught exception: ${error}`);
    return null;
  }
}

// get user data by userid 
exports.getUserData = async (userId, connection) => {
  try {
    const doc = await users.doc(userId).get();
    if (!doc.exists) {
      return null;
    }
    const data = doc.data();

    // if a connection name was passed, return that data, otherwise the entire user struct
    return connection ? 
           data[connection] :
           data;
  } catch (error) {
    console.log(`getUserData: caught exception: ${error}`);
    return null;
  }
};

// store user data by userid
exports.setUserData = async (
  userId,            // userid to store data for
  connection,        // connection key
  data) => {         // data to store
  try {
    // get the current user record 
    const doc = await users.doc(userId).get();
    const user = doc.exists ? doc.data() : {};
    const connectionData = user[connection] || {};
    const mergedData = {...connectionData, ...data };

    // store the new connection data for this user
    user[connection] = mergedData;

    // store the modified user
    const u = await users.doc(userId).set(user);

    // return the refreshed user hash
    return mergedData;
  } catch (error) {
    console.log(`setUserData: caught exception: ${error}`);
    return null;
  }
}

// remove a connection from a userid
exports.removeConnection = async (
  userId,            // userid to store data for
  connection) => {   // connection key
  try {
    // get the current user record 
    const doc = await users.doc(userId).get();
    const user = doc.exists ? doc.data() : {};

    // remove this connection data for this user
    delete user[connection];

    // store the modified user
    const u = await users.doc(userId).set(user);

    // return the refreshed user hash
    return user;
  } catch (error) {
    console.log(`removeConnection: caught exception: ${error}`);
    return null;
  }
}

// remove a document from a collection
exports.removeDocument = async (
  userId,            // userid to store data for
  collection,        // collection to change
  document) => {     // document to remove
  try {
    // address the document in the collection
    const doc = users.doc(userId).collection(collection).doc(document);

    // remove the document
    await doc.delete();
  } catch (error) {
    console.log(`removeDocument: caught exception: ${error}`);
    return null;
  }
}

// calculate whether an token has expired based on this provider
exports.tokenExpired = (user) => {
  try {
    const timestamp = user.expiresAt;
    const now = Date.now();
    if (timestamp > now) {
      return false;
    }
    return true;
  } catch (error) {
    console.log(`tokenExpired: caught exception: ${error}`);
    return true;
  }
}

