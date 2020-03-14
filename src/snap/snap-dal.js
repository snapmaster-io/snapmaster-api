// snap data access layer for snap language
// 
// exports:
//   createHandlers(app): create handlers for GET and POST endpoints
//   getSnap: get an active snap record from the user's environment
//   getSnap: get a snap definition from the user's environment

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
      const logs = await getLogs(req.userId) || {};
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
  app.get('/snaps/:userId/:snapId', requesthandler.checkJwt, requesthandler.processUser, function(req, res){
    const userId = decodeURI(req.params.userId);
    const snapId = req.params.snapId;
    if (!userId || !snapId) {
      res.status(200).send({ message: 'error'});
      return;
    }

    const returnSnap = async () => {
      const snap = await exports.getSnap(userId, snapId) || {};
      res.status(200).send(snap);
    }
    returnSnap();
  });
    
  // Post snaps API endpoint
  // this will fork an existing snap with snapId
  // TODO: add a code path that creates a new snap
  app.post('/snaps', requesthandler.checkJwt, requesthandler.processUser, function(req, res){
    const action = req.body.action;
    const snapId = req.body.snapId;
    
    const create = async () => {
      const definition = req.body.definition;
      await createSnap(req.userId, definition);
      res.status(200).send({ message: 'success' });
    }

    const del = async () => {
      await deleteSnap(req.userId, snapId);
      res.status(200).send({ message: 'success' });
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
      
  // Post active snaps API endpoint
  app.post('/activesnaps', requesthandler.checkJwt, requesthandler.processUser, function(req, res){
    const action = req.body.action;
    const snapId = req.body.snapId;
    
    const activateSnap = async () => {
      const status = await snapengine.activateSnap(req.userId, snapId, req.body.params);
      if (status.message === 'success') {
        const activesnaps = await getActiveSnaps(req.userId) || {};
        status.data = activesnaps;
      }
      res.status(200).send(status);
    }

    const deactivateSnap = async () => {
      const status = await snapengine.deactivateSnap(req.userId, snapId);
      if (status.message === 'success') {
        const activesnaps = await getActiveSnaps(req.userId) || {};
        status.data = activesnaps;
      }
      res.status(200).send(status);
    }

    const pauseSnap = async () => {
      const status = await snapengine.pauseSnap(req.userId, snapId);
      if (status.message === 'success') {
        const activesnaps = await getActiveSnaps(req.userId) || {};
        status.data = activesnaps;
      }
      res.status(200).send(status);
    }

    const resumeSnap = async () => {
      const status = await snapengine.resumeSnap(req.userId, snapId);
      if (status.message === 'success') {
        const activesnaps = await getActiveSnaps(req.userId) || {};
        status.data = activesnaps;
      }
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

// get a snap definition from the user's environment
exports.getSnap = async (userId, snapId) => {
  try {
    let user = userId, snapName = snapId;

    // if snapId is given as "user/name", override the userId
    const snapArray = snapId.split('/');
    if (snapArray.length > 1) {
      [user, snapName] = snapArray;
    }

    // get the snap definition 
    const snap = await database.getDocument(user, dbconstants.snapsCollection, snapName);
    return snap;
  } catch (error) {
    console.log(`getSnap: caught exception: ${error}`);
    return null;
  }
}

/* 
 * A snap definition is specified as follows:
 * { 
 *   snapId: string,      // [userId/name]
 *   description: string, 
 *   private: boolean,
 *   trigger: string,     // tool name
 *   actions: [string],   // array of tool names
 *   url: string,         // typically points to a git repo file
 *   text: string         // inline definition of snap, in case URL doesn't exist
 * }
 */
  
// create a snap in the user's environment
const createSnap = async (userId, definition, private = false) => {
  try {
    const snap = snapengine.parseDefinition(userId, definition, private);
    if (!snap) {
      return null;
    }
    
    // store the snap object and return it
    await database.storeDocument(userId, dbconstants.snapsCollection, snap.name, snap);
    return snap;
  } catch (error) {
    console.log(`createSnap: caught exception: ${error}`);
    return null;
  }
}

// delete a snap in the user's environment
const deleteSnap = async (userId, snapId) => {
  try {
    const nameArray = snapId.split('/');
    const snapName = nameArray.length > 1 ? nameArray[1] : snapId;
    await database.removeDocument(userId, dbconstants.snapsCollection, snapName);
  } catch (error) {
    console.log(`deleteSnap: caught exception: ${error}`);
    return null;
  }
}

// fork a snap into the user's environment
const forkSnap = async (userId, snapId) => {
  try {
    // get the snap definition 
    const snap = await exports.getSnap(userId, snapId);
    if (!snap) {
      console.error(`forkSnap: cannot find snap ${snapId}`);
      return null;
    }

    // construct new name
    const forkedSnapId = `${userId}/${snap.name}`;
    snap.snapId = forkedSnapId;
    snap.private = true;

    // store the new snap
    await database.storeDocument(userId, dbconstants.snapsCollection, snap.name, snap);
  } catch (error) {
    console.log(`forkSnap: caught exception: ${error}`);
    return null;
  }
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

// get all snap execution logs across this user's environments
const getLogs = async (userId) => {
  try {
    const logs = await database.queryGroup(userId, dbconstants.logsCollection);
    return logs;
  } catch (error) {
    console.log(`getLogs: caught exception: ${error}`);
    return null;
  }
}

// get all snaps in the user's environment
const getSnaps = async (userId) => {
  try {
    const snaps = await database.query(userId, dbconstants.snapsCollection);
    return snaps;
  } catch (error) {
    console.log(`getSnaps: caught exception: ${error}`);
    return null;
  }
}
