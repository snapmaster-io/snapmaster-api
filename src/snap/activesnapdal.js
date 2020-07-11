// activesnap data access layer 
// 
// exports:
//   getActiveSnap(userId, activeSnapId): get an active snap from the user's environment
//   getActiveSnaps(userId): get all active snaps in the user's environment

const database = require('../data/database');
const dbconstants = require('../data/database-constants');
const { successvalue, errorvalue } = require('../modules/returnvalue');

// get an active snap record from the user's environment
exports.getActiveSnap = async (userId, activeSnapId) => {
  try {
    const activeSnap = await database.getDocument(userId, dbconstants.activeSnapsCollection, activeSnapId);
    if (!activeSnap) {
      return errorvalue(`active snap ${activeSnapId} not found`);
    }
    return successvalue(activeSnap);
  } catch (error) {
    console.error(`getActiveSnap: caught exception: ${error}`);
    return errorvalue(error.message, error);
  }
}

// get all active snaps in the user's environment
exports.getActiveSnaps = async (userId) => {
  try {
    const activeSnaps = await database.query(userId, dbconstants.activeSnapsCollection);
    if (!activeSnaps) {
      return errorvalue("could not retrieve active snaps");
    }
    return successvalue(activeSnaps);
  } catch (error) {
    console.error(`getActiveSnaps: caught exception: ${error}`);
    return errorvalue(error.message, error);
  }
}