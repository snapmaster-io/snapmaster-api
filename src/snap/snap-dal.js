// snap data access layer for snap language
// 
// exports:
//   createSnap: create a snap in the user's environment
//   deleteSnap: delete a snap in the user's environment
//   forkSnap: fork a snap into the user's environment
//   getActiveSnaps: get active snaps in the user's environment
//   getAllSnaps: get all snaps across all user environments
//   getSnap: get a snap definition from the user's environment
//   getSnaps: get all snaps in the user's environment

const database = require('../data/database');
const dbconstants = require('../data/database-constants');
const engine = require('./snap-engine');

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
exports.createSnap = async (userId, definition, private = false) => {
  try {
    const snap = engine.parseDefinition(userId, definition, private);
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
    // extract snap name (either [userid/__snapname__] or the snapId passed in if it's not a composite)
    const snapNameArray = snapId.split('/');
    const snapName = snapNameArray.length > 1 ? snapNameArray[1] : snapId;

    // get the snap definition 
    const snap = await exports.getSnap(userId, dbconstants.snapsCollection, snapId);
    if (!snap) {
      console.error(`forkSnap: cannot find snap ${snapId}`);
      return null;
    }

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
