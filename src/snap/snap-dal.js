// snap data access layer for snap language
// 
// exports:
//   createHandlers(app): create handlers for GET and POST endpoints
//   createSnap(account, definition, private): create a snap in a user's account using the definition
//   getActveSnap(userId, activeSnapId): get an active snap record from the user's environment
//   getLogs(userId): get all logs for this user
//   getSnap(snapId): get a snap definition from the user's environment

const database = require('../data/database');
const dbconstants = require('../data/database-constants');
const snapengine = require('./snap-engine');
const requesthandler = require('../modules/requesthandler');

exports.createHandlers = (app) => {
  // Get gallery API endpoint
  app.get('/gallery', requesthandler.checkJwt, requesthandler.processUser, function(req, res){
    const returnGallery = async () => {
      const gallery = await getAllSnaps() || {};
      res.status(200).send(gallery);
    }
    returnGallery();
  });

  // Get logs API endpoint
  app.get('/logs', requesthandler.checkJwt, requesthandler.processUser, function(req, res){
    const returnLogs = async () => {
      const logs = await exports.getLogs(req.userId) || {};
      res.status(200).send(logs);
    }
    returnLogs();
  });

  // Get active snap logs API endpoint
  app.get('/logs/:activeSnapId', requesthandler.checkJwt, requesthandler.processUser, function(req, res){
    const activeSnapId = req.params.activeSnapId;
    const returnLogs = async () => {
      const logs = await getActiveSnapLogs(req.userId, activeSnapId) || {};
      res.status(200).send(logs);
    }
    returnLogs();
  });  

  // Get snaps API endpoint
  app.get('/snaps', requesthandler.checkJwt, requesthandler.processUser, function(req, res){
    const returnSnaps = async () => {
      const snaps = await getSnaps(req.userId) || {};
      res.status(200).send(snaps);
    }
    returnSnaps();
  });
    
  // Get snap API endpoint
  app.get('/snaps/:account/:snapName', requesthandler.checkJwt, requesthandler.processUser, function(req, res){
    const account = req.params.account;
    const snapName = req.params.snapName;
    if (!account || !snapName) {
      res.status(200).send({ message: 'error'});
      return;
    }

    const returnSnap = async () => {
      const snap = await exports.getSnap(`${account}/${snapName}`);
      res.status(200).send(snap);
    }
    returnSnap();
  });
    
  // Post snaps API endpoint
  // this will create a new snap, fork, or delete an existing snap with snapId
  app.post('/snaps', requesthandler.checkJwt, requesthandler.processUser, function(req, res){
    const action = req.body.action;
    const snapId = req.body.snapId;
    
    const create = async () => {
      const definition = req.body.definition;
      const snap = await exports.createSnap(req.userId, definition, true);
      if (snap) {
        res.status(200).send({ message: 'success', snap: snap });
      } else {
        res.status(200).send({ message: 'error' });
      }
    }

    const del = async () => {
      await deleteSnap(req.userId, snapId);
      res.status(200).send({ message: 'success' });
    }

    const edit = async () => {
      const snap = await editSnap(req.userId, snapId, req.body.private);
      res.status(200).send(snap ? { message: 'success', snap: snap } : { message: 'error' });
    }

    const fork = async () => {
      await forkSnap(req.userId, snapId);
      res.status(200).send({ message: 'success' });
    }

    switch (action) {
      case 'create':
        create();
        return;
      case 'delete':
        del();
        return;
      case 'edit':
        if (req.body.definition) {
          create();
        } else {
          edit();
        }
        return;
      case 'fork':
        fork();
        return;
      default:
        res.status(200).send({ message: 'Unknown action'});
        return;
    }
  });

  // Get active snaps API endpoint
  app.get('/activesnaps', requesthandler.checkJwt, requesthandler.processUser, function(req, res){
    const returnActiveSnaps = async () => {
      const activesnaps = await getActiveSnaps(req.userId) || {};
      res.status(200).send(activesnaps);
    }
    returnActiveSnaps();
  });

  // Get active snap logs API endpoint
  app.get('/activesnaps/:activeSnapId', requesthandler.checkJwt, requesthandler.processUser, function(req, res){
    const activeSnapId = req.params.activeSnapId;
    const returnActiveSnap = async () => {
      const activeSnap = await exports.getActiveSnap(req.userId, activeSnapId) || {};
      res.status(200).send(activeSnap);
    }
    returnActiveSnap();
  });  
      
  // Execute active snap API endpoint
  app.post('/activesnaps/:activeSnapId', requesthandler.checkJwt, requesthandler.processUser, function(req, res){
    const activeSnapId = req.params.activeSnapId;
    const executeSnap = async () => {
      snapengine.executeSnap(req.userId, activeSnapId, null, null);
      res.status(200).send();
    }
    executeSnap();
  });  
      
  // Post active snaps API endpoint
  app.post('/activesnaps', requesthandler.checkJwt, requesthandler.processUser, function(req, res){
    const action = req.body.action;
    const snapId = req.body.snapId;
    
    const activateSnap = async () => {
      const status = await snapengine.activateSnap(req.userId, snapId, req.body.params);
      res.status(200).send(status);
    }

    const deactivateSnap = async () => {
      const status = await snapengine.deactivateSnap(req.userId, snapId);
      res.status(200).send(status);
    }

    const editSnap = async () => {
      const status = await snapengine.editSnap(req.userId, snapId, req.body.params);
      res.status(200).send(status);
    }
    
    const pauseSnap = async () => {
      const status = await snapengine.pauseSnap(req.userId, snapId);
      res.status(200).send(status);
    }

    const resumeSnap = async () => {
      const status = await snapengine.resumeSnap(req.userId, snapId);
      res.status(200).send(status);
    }

    if (!snapId) {
      res.status(200).send({ message: 'Unknown snapId'});  
      return;
    }

    switch (action) {
      case 'activate':
        activateSnap();
        return;
      case 'deactivate':
        deactivateSnap();
        return;
      case 'edit':
        editSnap();
        return;
      case 'pause':
        pauseSnap();
        return;
      case 'resume':
        resumeSnap();
        return;
      default:
        res.status(200).send({ message: 'Unknown action'});
        return;
    }
  });
}

/* 
 * A snap definition is specified as follows:
 * { 
 *   snapId: string,      // [account/name]
 *   description: string, 
 *   private: boolean,
 *   trigger: string,     // tool name
 *   actions: [string],   // array of tool names
 *   url: string,         // typically points to a git repo file
 *   text: string         // inline definition of snap, in case URL doesn't exist
 * }
 */

exports.createSnap = async (userId, definition, private = false) => {
  try {
    // get the account name associated with the user
    const account = await getAccount(userId);
    if (!account) {
      console.error(`createSnap: cannot find account for userId ${userId}`);
      return null;
    }

    // parse the snap definition
    const snap = snapengine.parseDefinition(account, definition, private);
    if (!snap) {
      return null;
    }

    // store the snap's userId
    snap.userId = userId;
    
    // store the snap object and return it
    await database.storeDocument(account, dbconstants.snapsCollection, snap.name, snap);
    return snap;
  } catch (error) {
    console.log(`createSnap: caught exception: ${error}`);
    return null;
  }
}

// get an active snap record from the user's environment
exports.getActiveSnap = async (userId, activeSnapId) => {
  try {
    const activeSnap = await database.getDocument(userId, dbconstants.activeSnapsCollection, activeSnapId);
    return activeSnap;
  } catch (error) {
    console.log(`getActiveSnap: caught exception: ${error}`);
    return null;
  }
}

// get all snap execution logs across this user's environments
exports.getLogs = async (userId) => {
  try {
    const logs = await database.queryGroup(userId, dbconstants.logsCollection);
    return logs;
  } catch (error) {
    console.log(`getLogs: caught exception: ${error}`);
    return null;
  }
}

// get a snap definition from the user's environment
exports.getSnap = async (snapId) => {
  try {
    // snapId must be given as "user/name"
    const [account, snapName] = snapId.split('/');
    if (!account || !snapName) {
      console.error(`getSnap: invalid snapId ${snapId}`)
      return null;
    }

    // get the snap definition 
    const snap = await database.getDocument(account, dbconstants.snapsCollection, snapName);
    return snap;
  } catch (error) {
    console.log(`getSnap: caught exception: ${error}`);
    return null;
  }
}
  
// delete a snap in the user's environment
const deleteSnap = async (userId, snapId) => {
  try {
    // get the account name associated with the user
    const account = await getAccount(userId);
    if (!account) {
      console.error(`deleteSnap: cannot find account for userId ${userId}`);
      return null;
    }

    const nameArray = snapId.split('/');
    const snapName = nameArray.length > 1 ? nameArray[1] : snapId;
    await database.removeDocument(account, dbconstants.snapsCollection, snapName);
  } catch (error) {
    console.log(`deleteSnap: caught exception: ${error}`);
    return null;
  }
}

// edit a snap in the user's environment
const editSnap = async (userId, snapId, privacy) => {
  try {
    // get the account name associated with the user
    const account = await getAccount(userId);
    if (!account) {
      console.error(`editSnap: cannot find account for userId ${userId}`);
      return null;
    }

    // get the snap definition 
    const snap = await exports.getSnap(snapId);
    if (!snap) {
      console.error(`editSnap: cannot find snap ${snapId}`);
      return null;
    }

    // set the privacy flag
    snap.private = privacy;

    // re-construct snap name to ensure it's in the user's account
    const nameArray = snapId.split('/');
    const snapName = nameArray.length > 1 ? nameArray[1] : snapId;

    // save the updated snap and return it
    await database.storeDocument(account, dbconstants.snapsCollection, snapName, snap);

    // return the updated snap
    return exports.getSnap(snapId);
  } catch (error) {
    console.log(`deleteSnap: caught exception: ${error}`);
    return null;
  }
}

// fork a snap into the user's environment
const forkSnap = async (userId, snapId) => {
  try {
    // get the account name associated with the user
    const account = await getAccount(userId);
    if (!account) {
      console.error(`forkSnap: cannot find account for userId ${userId}`);
      return null;
    }

    // get the snap definition 
    const snap = await exports.getSnap(snapId);
    if (!snap) {
      console.error(`forkSnap: cannot find snap ${snapId}`);
      return null;
    }

    // construct new name
    const forkedSnapId = `${account}/${snap.name}`;
    snap.snapId = forkedSnapId;
    snap.private = true;
    snap.account = account;
    snap.userId = userId;

    // store the new snap
    await database.storeDocument(account, dbconstants.snapsCollection, snap.name, snap);
  } catch (error) {
    console.log(`forkSnap: caught exception: ${error}`);
    return null;
  }
}

// get account for a userId
const getAccount = async (userId) => {
  // retrieve the account associated with the user
  const user = await database.getUserData(userId, dbconstants.profile);
  const account = user.account;
  return account;
}

// get active snaps in the user's environment
const getActiveSnaps = async (userId) => {
  try {
    const activeSnaps = await database.query(userId, dbconstants.activeSnapsCollection);
    return activeSnaps;
  } catch (error) {
    console.log(`getActiveSnaps: caught exception: ${error}`);
    return null;
  }
}

// get logs for an active snap in the user's environment
const getActiveSnapLogs = async (userId, activeSnapId) => {
  try {
    const logsCollection = `${dbconstants.activeSnapsCollection}/${activeSnapId}/${dbconstants.logsCollection}`;
    const logs = await database.query(userId, logsCollection);
    return logs;
  } catch (error) {
    console.log(`getActiveSnapLogs: caught exception: ${error}`);
    return null;
  }
}

// get all snaps across all user environments
const getAllSnaps = async () => {
  try {
    const snaps = await database.queryGroup(null, dbconstants.snapsCollection, dbconstants.snapPrivateField, false);
    return snaps;
  } catch (error) {
    console.log(`getAllSnaps: caught exception: ${error}`);
    return null;
  }
}

// get all snaps in the user's environment
const getSnaps = async (userId) => {
  try {
    // get the account name associated with the user
    const account = await getAccount(userId);
    if (!account) {
      console.error(`getSnaps: cannot find account for userId ${userId}`);
      return null;
    }

    // get all the snaps in the user's account
    const snaps = await database.query(account, dbconstants.snapsCollection);
    return snaps;
  } catch (error) {
    console.log(`getSnaps: caught exception: ${error}`);
    return null;
  }
}
