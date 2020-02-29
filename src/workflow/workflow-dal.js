// workflow data access layer for snap language
// 
// exports:
//   createWorkflow: create a workflow in the user's environment
//   deleteWorkflow: delete a workflow in the user's environment

const database = require('../data/database');
const dbconstants = require('../data/database-constants');

// install a workflow in the user's environment
exports.createWorkflow = async (userId, workflowId, definition) => {
  try {
    await database.storeDocument(userId, dbconstants.workflowsCollection, workflowId, definition);
  } catch (error) {
    console.log(`createWorkflow: caught exception: ${error}`);
    return null;
  }
}

// trigger a workflow
exports.deleteWorkflow = async (userId, workflowId) => {
  try {
    await database.removeDocument(userId, dbconstants.workflowsCollection, workflowId);
  } catch (error) {
    console.log(`deleteWorkflow: caught exception: ${error}`);
    return null;
  }
}
