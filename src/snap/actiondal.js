// action data access layer 
// 
// exports:
//   createAction(userId, url, definition): create a action in a user's account using the definition
//   deleteAction(userId, actionId): delete a action in a user's environment
//   editAction(userId, actionId, privacy): edit a action in the user's environment
//   forkAction(userId, actionId): fork a action into the user's environment
//   getAction(actionId): get a action definition from the user's environment
//   getActions(userId): get all actions in the user's environment

const database = require('../data/database');
const dbconstants = require('../data/database-constants');
const { successvalue, errorvalue } = require('../modules/returnvalue');
const YAML = require('yaml');

/* 
 * An action definition is specified as follows:
 * { 
 *   actionId: string,    // [account/name]
 *   description: string, 
 *   provider: string,    // provider name if any
 *   actions: [],         // array of actin definitions
 *   url: string,         // base URL for the action
 *   text: string         // inline definition of action
 * }
 */

// create an action in the user's environment using the definition
exports.createAction = async (userId, url, definition) => {
  try {
    // validate url and definition
    if (!url) {
      const message = 'action must have a url';
      console.error(`createAction: ${message}`);
      return errorvalue(message);
    }    
    if (!definition) {
      const message = 'action must have a definition';
      console.error(`createAction: ${message}`);
      return errorvalue(message);
    }

    // remove any trailing '/' or '/__metadata' from url
    if (url.endsWith('/')) {
      url = url.substring(0, url.length - 1);
    }
    const mdsuffix = '/__metadata';
    if (url.endsWith(mdsuffix)) {
      url = url.substring(0, url.length - mdsuffix.length);
    }
    
    // get the account name associated with the user
    const account = await getAccount(userId);
    if (!account) {
      const message = `cannot find account for userId ${userId}`;
      console.error(`createAction: ${message}`);
      return errorvalue(message);
    }

    // parse the action definition
    const response = parseDefinition(account, definition);
    if (response.error) {
      return response;
    }

    // store the action's userId
    const action = response.data;
    action.userId = userId;

    // store the action
    action.url = url;
    
    // store the action object and return it
    const storedAction = await database.storeDocument(account, dbconstants.actionsCollection, action.name, action);
    return successvalue(storedAction);
  } catch (error) {
    console.log(`createAction: caught exception: ${error}`);
    return errorvalue(error.message, error);
  }
}

// delete an action in the user's environment
exports.deleteAction = async (userId, actionId) => {
  try {
    // get the account name associated with the user
    const account = await getAccount(userId);
    if (!account) {
      const message = `cannot find account for userId ${userId}`;
      console.error(`deleteAction: ${message}`);
      return errorvalue(message);
    }

    const nameArray = actionId.split('/');
    const actionName = nameArray.length > 1 ? nameArray[1] : actionId;
    const localActionId = `${account}/${actionName}`;

    // get the action definition 
    const action = await database.getDocument(account, dbconstants.actionsCollection, actionName);
    if (!action) {
      const message = `cannot find action ${localActionId}`;
      console.error(`deleteAction: ${message}`);
      return errorvalue(message);
    }

    // if the action was found, remove it
    await database.removeDocument(account, dbconstants.actionsCollection, actionName);
    return successvalue(action);
  } catch (error) {
    console.log(`deleteAction: caught exception: ${error}`);
    return errorvalue(error.message, error);
  }
}

// get an action definition from the user's environment
exports.getAction = async (actionId) => {
  try {
    // actionId must be given as "user/name"
    const [account, actionName] = actionId.split('/');
    if (!account || !actionName) {
      const message = `invalid actionId ${actionId}`;
      console.error(`getAction: ${message}`)
      return errorvalue(message);
    }

    // get the action definition 
    const action = await database.getDocument(account, dbconstants.actionsCollection, actionName);
    if (!action) {
      return errorvalue(`action ${actionId} not found`);
    }
    return successvalue(action);
  } catch (error) {
    console.error(`getAction: caught exception: ${error}`);
    return errorvalue(error.message, error);
  }
}

// get all actions in the user's environment
exports.getActions = async (userId) => {
  try {
    // get the account name associated with the user
    const account = await getAccount(userId);
    if (!account) {
      const message = `cannot find account for userId ${userId}`;
      console.error(`getActions: ${message}`)
      return errorvalue(message);
    }

    // get all the actions in the user's account
    const actions = await database.query(account, dbconstants.actionsCollection);
    if (!actions) {
      return errorvalue(`no actions found`);
    }
    return successvalue(actions);
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
        return errorvalue(message);
      }
    }

    if (!action.actions || action.actions.length === 0) {
      const message = `action definition did not contain any actions`;
      console.error(`parseDefinition: ${message}`);
      return errorvalue(message);
    }

    if (action.name.indexOf(' ') >= 0) {
      const message = `action name cannot contain spaces`;
      console.error(`parseDefinition: ${message}`);
      return errorvalue(message);
    }

    return successvalue(action);
  } catch (error) {
    console.error(`parseDefinition: caught exception: ${error}`);
    return errorvalue(error.message, error);
  }
}
