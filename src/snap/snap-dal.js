// snap data access layer for snap language
// 
// exports:
//   createSnap: create a Snap in the user's environment
//   deleteSnap: delete a Snap in the user's environment

const database = require('../data/database');
const dbconstants = require('../data/database-constants');

/* 
 * A snap definition is specified as follows:
 * { 
 *   snapId: string [userId/name],
 *   private: boolean,
 *   url: url [typically points to a git repo file],
 *   text: string [inline definition of snap, in case URL doesn't exist]
 * }
 */

// create a snap in the user's environment
exports.createSnap = async (userId, snapId, definition) => {
  try {
    await database.storeDocument(userId, dbconstants.snapsCollection, snapId, definition);
  } catch (error) {
    console.log(`createSnap: caught exception: ${error}`);
    return null;
  }
}

// delete a snap in the user's environment
exports.deleteSnap = async (userId, snapId) => {
  try {
    await database.removeDocument(userId, dbconstants.snapsCollection, snapId);
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
    const snap = await database.getDocument(snapUserId, dbconstants.snapsCollection, snapId);

    // construct new name
    const forkedsnapName = `${userId}/${snapName}`;

    // store the new snap
    await database.storeDocument(userId, dbconstants.snapsCollection, forkedsnapName, snap);
  } catch (error) {
    console.log(`forkSnap: caught exception: ${error}`);
    return null;
  }
}

// get all snaps across all user environments
exports.getAllSnaps = async (userId) => {
  try {
    const snaps = await database.queryGroup(userId, dbconstants.snapsCollection, dbconstants.snapPrivateField, false);
    return snaps;
  } catch (error) {
    console.log(`getSnaps: caught exception: ${error}`);
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

