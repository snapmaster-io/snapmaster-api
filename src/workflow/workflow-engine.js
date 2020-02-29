// workflow engine for snap language
// 
// exports:
//   activateWorkflow: activate a workflow in the user's environment
//   deactivateWorkflow: deactivate a workflow in the user's environment
//   installWorkflow: install a workflow in the user's environment
//   triggerWorkflow: trigger a workflow
//   uninstallWorkflow: uninstall a workflow from the user's environment

const database = require('../data/database');
const dbconstants = require('../data/database-constants');

// install a workflow in the user's environment
exports.installWorkflow = async (userId, workflowId) => {
  try {

  } catch (error) {
    console.log(`triggerWorkflow: caught exception: ${error}`);
    return null;
  }
}

// trigger a workflow
exports.triggerWorkflow = async (userId, workflowId) => {
  try {
  } catch (error) {
    console.log(`triggerWorkflow: caught exception: ${error}`);
    return null;
  }
}
