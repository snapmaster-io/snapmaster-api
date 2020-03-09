// snap data access layer for snap language
// 
// exports:
//   activateSnap: activate a snap into the user's environment
//   createSnap: create a snap in the user's environment
//   deactivateSnap: deactivate an active snap in the user's environment
//   deleteSnap: delete a snap in the user's environment
//   forkSnap: fork a snap into the user's environment
//   getActiveSnaps: get active snaps in the user's environment
//   getAllSnaps: get all snaps across all user environments
//   getSnap: get a snap definition from the user's environment
//   getSnaps: get all snaps in the user's environment

const database = require('../data/database');
const dbconstants = require('../data/database-constants');
const engine = require('./snap-engine');
const providers = require('../providers/providers');

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

// activate a snap into the user's environment
exports.activateSnap = async (userId, snapId, params = null) => {
  try {
    // parse snapId (which is in account/name format)
    const [user, name] = snapId.split('/');
    if (!user || !name) {
      return { message: `activateSnap: snapId ${snapId} not in user/name format` };
    }

    // get the snap structure
    const snap = await database.getDocument(user, dbconstants.snapsCollection, name); 
    if (!snap || !snap.trigger) {
      return { message: `activateSnap: could not find snap ${user}/${name}` };
    }

    // get the provider for the trigger
    const provider = providers.getProvider(snap.trigger);

    // active snap ID is current timestamp
    const activeSnapId = new Date().getTime().toString();
    const activeSnap = {
      activeSnapId: activeSnapId,
      userId: userId,
      snapId: snapId,
      provider: provider.provider,
      params: params
    }

    // create the snap trigger
    const triggerData = await provider.createTrigger(userId, activeSnapId, params);
    if (!triggerData) {
      return { message: 'could not activate snap' };
    }

    // add the trigger data to the activesnap record
    activeSnap.triggerData = triggerData;

    // store the activated snap information
    await database.storeDocument(userId, dbconstants.activeSnapsCollection, activeSnapId, activeSnap);

    return { message: 'success' };
  } catch (error) {
    console.log(`activateSnap: caught exception: ${error}`);
    return { message: 'could not activate snap' };
  }
}

// create a snap in the user's environment
exports.createSnap = async (userId, definition, private = false) => {
  try {
    const snapDefinition = engine.parseDefinition(definition);
    const snapId = `${userId}/${snapDefinition.name}`;
    const name = snapDefinition.name;

    const snap = { 
      snapId: snapId,
      userId: userId,
      name: name,
      description: snapDefinition.description, 
      parameters: snapDefinition.parameters,
      trigger: snapDefinition.tools.trigger,
      actions: snapDefinition.tools.actions,
      private: private,
      text: definition
    };
    
    // store the snap object and return it
    await database.storeDocument(userId, dbconstants.snapsCollection, name, snap);
    return snap;
  } catch (error) {
    console.log(`createSnap: caught exception: ${error}`);
    return null;
  }
}

// deactivate a snap in the user's environment
exports.deactivateSnap = async (userId, activeSnapId) => {
  try {
    // get the active snap structure
    const activeSnap = await database.getDocument(userId, dbconstants.activeSnapsCollection, activeSnapId);
    if (!activeSnap) {
      return { message: `could not find active snap ID ${activeSnapId}`};
    }

    // delete the snap trigger
    const provider = providers.getProvider(activeSnap.provider);
    await provider.deleteTrigger(userId, activeSnap.triggerData);

    // delete the active snap from the database
    await database.removeDocument(userId, dbconstants.activeSnapsCollection, activeSnapId);
    return { message: 'success' };
  } catch (error) {
    console.log(`deactivateSnap: caught exception: ${error}`);
    return { message: `deactivateSnap error: ${error.message}`};
  }
}

// delete a snap in the user's environment
exports.deleteSnap = async (userId, snapId) => {
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
exports.forkSnap = async (userId, snapId) => {
  try {
    // extract userId for snap to fork (either [__userid__/snapname] or the snapmaster userid)
    const snapNameArray = snapId.split('/');
    const snapUserId = snapNameArray.length > 1 ? snapNameArray[0] : dbconstants.snapMasterUserId;

    // extract snap name (either [userid/__snapname__] or the snapId passed in if it's not a composite)
    const snapName = snapNameArray.length > 1 ? snapNameArray[1] : snapId;

    // get the snap definition 
    const snap = await database.getDocument(snapUserId, dbconstants.snapsCollection, snapName);

    // construct new name
    const forkedSnapId = `${userId}/${snapName}`;
    snap.snapId = forkedSnapId;
    snap.private = true;

    // store the new snap
    await database.storeDocument(userId, dbconstants.snapsCollection, snapName, snap);
  } catch (error) {
    console.log(`forkSnap: caught exception: ${error}`);
    return null;
  }
}

// get active snaps in the user's environment
exports.getActiveSnaps = async (userId) => {
  try {
    const activeSnaps = await database.query(userId, dbconstants.activeSnapsCollection);
    return activeSnaps;
  } catch (error) {
    console.log(`getActiveSnaps: caught exception: ${error}`);
    return null;
  }
}

// get all snaps across all user environments
exports.getAllSnaps = async () => {
  try {
    const snaps = await database.queryGroup(null, dbconstants.snapsCollection, dbconstants.snapPrivateField, false);
    return snaps;
  } catch (error) {
    console.log(`getAllSnaps: caught exception: ${error}`);
    return null;
  }
}

// get a snap definition from the user's environment
exports.getSnap = async (userId, snapId) => {
  try {
    // get the snap definition 
    const snap = await database.getDocument(userId, dbconstants.snapsCollection, snapId);
    return snap;
  } catch (error) {
    console.log(`getSnap: caught exception: ${error}`);
    return null;
  }
}

// get all snaps in the user's environment
exports.getSnaps = async (userId) => {
  try {
    const snaps = await database.query(userId, dbconstants.snapsCollection);
    return snaps;
  } catch (error) {
    console.log(`getSnaps: caught exception: ${error}`);
    return null;
  }
}

// NOT SURE I NEED ANY OF THESE

// get all installed snaps in the user's environment
exports.getInstalledSnaps = async (userId) => {
  try {
    const snaps = await database.query(userId, dbconstants.installedsnapsCollection);
    return snaps;
  } catch (error) {
    console.log(`getInstalledSnaps: caught exception: ${error}`);
    return null;
  }
}

// install a snap in the user's environment
exports.installSnap = async (userId, snapId) => {
  try {
    await database.storeDocument(userId, dbconstants.installedsnapsCollection, snapId, { snapId: snapId });
  } catch (error) {
    console.log(`installSnap: caught exception: ${error}`);
    return null;
  }
}

// uninstall a snap from the user's environment
exports.uninstallSnap = async (userId, snapId) => {
  try {
    await database.removeDocument(userId, dbconstants.installedsnapsCollection, snapId);
  } catch (error) {
    console.log(`installSnap: caught exception: ${error}`);
    return null;
  }
}

