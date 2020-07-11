// log data access layer 
// 
// exports:
//   getActiveSnapLogs(userId, activeSnapId): get logs for an active snap for this user
//   getLogs(userId): get all logs for this user

const database = require('../data/database');
const dbconstants = require('../data/database-constants');
const { successvalue, errorvalue } = require('../modules/returnvalue');

// get logs for an active snap in the user's environment
exports.getActiveSnapLogs = async (userId, activeSnapId) => {
  try {
    const logsCollection = `${dbconstants.activeSnapsCollection}/${activeSnapId}/${dbconstants.logsCollection}`;
    const logs = await database.query(userId, logsCollection);
    return successvalue(logs);
  } catch (error) {
    console.error(`getActiveSnapLogs: caught exception: ${error}`);
    return errorvalue(error.message, error);
  }
}

// get all snap execution logs across this user's environments
exports.getLogs = async (userId) => {
  try {
    const logs = await database.queryGroup(userId, dbconstants.logsCollection);
    return successvalue(logs);
  } catch (error) {
    console.error(`getLogs: caught exception: ${error}`);
    return errorvalue(error.message, error);
  }
}

