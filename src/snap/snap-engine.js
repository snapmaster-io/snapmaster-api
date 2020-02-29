// snap engine for snap language
// 
// exports:
//   activateSnap: activate a snap in the user's environment
//   deactivateSnap: deactivate a snap in the user's environment
//   installSnap: install a snap in the user's environment
//   triggerSnap: trigger a snap
//   uninstallSnap: uninstall a snap from the user's environment

const database = require('../data/database');
const dbconstants = require('../data/database-constants');

// install a snap in the user's environment
exports.installSnap = async (userId, snapId) => {
  try {

  } catch (error) {
    console.log(`triggerSnap: caught exception: ${error}`);
    return null;
  }
}

// trigger a snap
exports.triggerSnap = async (userId, snapId) => {
  try {
  } catch (error) {
    console.log(`triggerSnap: caught exception: ${error}`);
    return null;
  }
}
