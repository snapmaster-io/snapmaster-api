// action data access layer 
// 
// exports:
//   createAction(userId, url, definition): create a action in a user's account using the definition
//   deleteAction(userId, actionId): delete a action in a user's environment
//   editAction(userId, actionId, privacy): edit a action in the user's environment
//   forkAction(userId, actionId): fork a action into the user's environment
//   getAction(actionId): get a action definition from the user's environment
//   getActions(userId): get all actions in the user's environment

const YAML = require('yaml');
const database = require('../data/database');
const dbconstants = require('../data/database-constants');

/* 
 * An action definition is specified as follows:
 * { 
 *   actionId: string,    // [account/name]
 *   description: string, 
 *   provider: string,    // provider name if any
 *   actions: [string],   // array of tool names
 *   url: string,         // base URL for the action
 *   text: string         // inline definition of action
 * }
 */

// create an action in the user's environment using the definition
exports.createAction = async (userId, url, definition) => {
  try {
    // get the account name associated with the user
    const account = await getAccount(userId);
    if (!account) {
      const message = `cannot find account for userId ${userId}`;
      console.error(`createAction: ${message}`);
      return message;
    }

    // parse the action definition
    const action = parseDefinition(account, definition);
    if (!action || !action.actionId) {
      // if no actionId field, then this is an error message
      return action;
    }

    // store the action's userId
    action.userId = userId;

    // store the action
    action.url = url;
    
    // store the action object and return it
    const storedAction = await database.storeDocument(account, dbconstants.actionsCollection, action.name, action);
    return storedAction;
  } catch (error) {
    console.log(`createAcion: caught exception: ${error}`);
    return null;
  }
}

// delete an action in the user's environment
exports.deleteAction = async (userId, actionId) => {
  try {
    // get the account name associated with the user
    const account = await getAccount(userId);
    if (!account) {
      console.error(`deleteAction: cannot find account for userId ${userId}`);
      return null;
    }

    const nameArray = actionId.split('/');
    const actionName = nameArray.length > 1 ? nameArray[1] : actionId;

    // get the action definition 
    const action = await database.getDocument(account, dbconstants.actionsCollection, actionName);
    if (action) {
      // if the action was found, remove it
      await database.removeDocument(account, dbconstants.actionsCollection, actionName);
      return action;
    }

    return null;
  } catch (error) {
    console.log(`deleteAction: caught exception: ${error}`);
    return null;
  }
}

// edit an action in the user's environment
exports.editAction = async (userId, actionId, privacy) => {
  try {
    // get the account name associated with the user
    const account = await getAccount(userId);
    if (!account) {
      console.error(`editAction: cannot find account for userId ${userId}`);
      return null;
    }

    // re-construct action name to ensure it's in the user's account
    const nameArray = actionId.split('/');
    const actionName = nameArray.length > 1 ? nameArray[1] : actionId;
    const localActionId = `${account}/${actionName}`;

    // get the action definition 
    const action = await exports.getAction(localActionId);
    if (!action) {
      console.error(`editAction: cannot find action ${localActionId}`);
      return null;
    }

    // set the privacy flag
    action.private = privacy;

    // save the updated action and return it
    await database.storeDocument(account, dbconstants.actionsCollection, actionName, action);

    // return the updated action
    return exports.getAction(localActionId);
  } catch (error) {
    console.log(`deleteAction: caught exception: ${error}`);
    return null;
  }
}

// fork an action into the user's environment
exports.forkAction = async (userId, actionId) => {
  try {
    // get the account name associated with the user
    const account = await getAccount(userId);
    if (!account) {
      console.error(`forkAction: cannot find account for userId ${userId}`);
      return null;
    }

    // get the action definition 
    const action = await exports.getAction(actionId);
    if (!action) {
      console.error(`forkAction: cannot find action ${actionId}`);
      return null;
    }

    // construct new name
    const forkedActionId = `${account}/${action.name}`;
    action.actionId = forkedActionId;
    action.private = true;
    action.account = account;
    action.userId = userId;

    // store the new action
    await database.storeDocument(account, dbconstants.actionsCollection, action.name, action);

    // return the new actionId
    return action;
  } catch (error) {
    console.log(`forkAction: caught exception: ${error}`);
    return null;
  }
}

// get an action definition from the user's environment
exports.getAction = async (actionId) => {
  try {
    // actionId must be given as "user/name"
    const [account, actionName] = actionId.split('/');
    if (!account || !actionName) {
      console.error(`getAction: invalid actionId ${actionId}`)
      return null;
    }

    // get the action definition 
    const action = await database.getDocument(account, dbconstants.actionsCollection, actionName);
    return action;
  } catch (error) {
    console.log(`getAction: caught exception: ${error}`);
    return null;
  }
}

// get all actions in the user's environment
exports.getActions = async (userId) => {
  try {
    // get the account name associated with the user
    const account = await getAccount(userId);
    if (!account) {
      console.error(`getActions: cannot find account for userId ${userId}`);
      return null;
    }

    // get all the actions in the user's account
    const actions = await database.query(account, dbconstants.actionsCollection);
    return actions;
  } catch (error) {
    console.log(`getActions: caught exception: ${error}`);
    return null;
  }
}

// get account for a userId
const getAccount = async (userId) => {
  // retrieve the account associated with the user
  const user = await database.getUserData(userId, dbconstants.profile);
  const account = user.account;
  return account;
}

// parse action YAML definition into an action object
const parseDefinition = (account, definition) => {
  try {
    const actionDefinition = YAML.parse(definition);

    const actionId = `${account}/${actionDefinition.name}`;
    const name = actionDefinition.name;

    const action = { 
      actionId: actionId,
      account: account,
      name: name,
      description: actionDefinition.description, 
      actions: actionDefinition.actions,
      provider: actionDefinition.provider,
      text: definition
    };

    // validate required fields
    for (const field of ['account', 'name', 'actions']) {
      if (!action[field]) {
        const message = `action definition did not contain required field "${field}"`;
        console.error(`parseDefinition: ${message}`);
        return message;
      }
    }

    if (!action.actions || action.actions.length === 0) {
      const message = `action definition did not contain any actions`;
      console.error(`parseDefinition: ${message}`);
      return message;
    }

    if (action.name.indexOf(' ') >= 0) {
      const message = `action name cannot contain spaces`;
      console.error(`parseDefinition: ${message}`);
      return message;
    }

    return action;
  } catch (error) {
    console.log(`parseDefinition: caught exception: ${error}`);
    return `unknown error: ${error}`;
  }
}
