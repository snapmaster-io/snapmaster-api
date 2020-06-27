// activesnap data access layer 
// 
// exports:
//   getActiveSnap(userId, activeSnapId): get an active snap from the user's environment
//   getActiveSnaps(userId): get all active snaps in the user's environment

const database = require('../data/database');
const dbconstants = require('../data/database-constants');

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

// get all active snaps in the user's environment
exports.getActiveSnaps = async (userId) => {
  try {
    const activeSnaps = await database.query(userId, dbconstants.activeSnapsCollection);
    return activeSnaps;
  } catch (error) {
    console.log(`getActiveSnaps: caught exception: ${error}`);
    return null;
  }
}