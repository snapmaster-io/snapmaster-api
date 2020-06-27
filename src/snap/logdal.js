// log data access layer 
// 
// exports:
//   getActiveSnapLogs(userId, activeSnapId): get logs for an active snap for this user
//   getLogs(userId): get all logs for this user

const database = require('../data/database');
const dbconstants = require('../data/database-constants');

// get logs for an active snap in the user's environment
exports.getActiveSnapLogs = async (userId, activeSnapId) => {
  try {
    const logsCollection = `${dbconstants.activeSnapsCollection}/${activeSnapId}/${dbconstants.logsCollection}`;
    const logs = await database.query(userId, logsCollection);
    return logs;
  } catch (error) {
    console.log(`getActiveSnapLogs: caught exception: ${error}`);
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

