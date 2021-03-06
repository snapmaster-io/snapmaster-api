// snap data access layer 
// 
// exports:
//   createSnap(userId, definition, private): create a snap in a user's account using the definition
//   deleteSnap(userId, snapId): delete a snap in a user's environment
//   editSnap(userId, snapId, privacy): edit a snap in the user's environment
//   forkSnap(userId, snapId): fork a snap into the user's environment
//   getAllSnaps(): get all snaps across all user environments
//   getSnap(snapId): get a snap definition from the user's environment
//   getSnaps(userId): get all snaps in the user's environment

const database = require('../data/database');
const dbconstants = require('../data/database-constants');
const { successvalue, errorvalue } = require('../modules/returnvalue');
const YAML = require('yaml');

/* 
 * A snap definition is specified as follows:
 * { 
 *   snapId: string,      // [account/name]
 *   description: string, 
 *   private: boolean,
 *   trigger: string,     // tool name
 *   actions: [string],   // array of tool names
 *   url: string,         // typically points to a git repo file
 *   text: string         // inline definition of snap, in case URL doesn't exist
 * }
 */

exports.createSnap = async (userId, definition, private = false) => {
  try {
    // validate definition
    if (!definition) {
      const message = 'snap must have a definition';
      console.error(`createSnap: ${message}`);
      return errorvalue(message);
    }

    // get the account name associated with the user
    const account = await getAccount(userId);
    if (!account) {
      const message = `cannot find account for userId ${userId}`;
      console.error(`createSnap: ${message}`);
      return errorvalue(message);
    }

    // parse the snap definition
    const response = parseDefinition(account, definition, private);
    if (response.error) {
      return response;
    }

    // store the snap's userId
    const snap = response.data;
    snap.userId = userId;
    
    // store the snap object and return it
    const storedSnap = await database.storeDocument(account, dbconstants.snapsCollection, snap.name, snap);
    return successvalue(storedSnap);
  } catch (error) {
    console.error(`createSnap: caught exception: ${error}`);
    return errorvalue(error.message, error);
  }
}
  
// delete a snap in the user's environment
exports.deleteSnap = async (userId, snapId) => {
  try {
    // get the account name associated with the user
    const account = await getAccount(userId);
    if (!account) {
      const message = `cannot find account for userId ${userId}`;
      console.error(`deleteSnap: ${message}`);
      return errorvalue(message);
    }

    const nameArray = snapId.split('/');
    const snapName = nameArray.length > 1 ? nameArray[1] : snapId;
    const localSnapId = `${account}/${snapName}`;

    // get the snap definition 
    const response = await exports.getSnap(localSnapId);
    if (!response.ok) {
      return response;
    }

    // if the snap was found, remove it
    await database.removeDocument(account, dbconstants.snapsCollection, snapName);
    return successvalue(response.snap);
  } catch (error) {
    console.error(`deleteSnap: caught exception: ${error}`);
    return errorvalue(error.message, error);
  }
}

// edit a snap in the user's environment
exports.editSnap = async (userId, snapId, privacy) => {
  try {
    // get the account name associated with the user
    const account = await getAccount(userId);
    if (!account) {
      const message = `cannot find account for userId ${userId}`;
      console.error(`editSnap: ${message}`);
      return errorvalue(message);
    }

    // re-construct snap name to ensure it's in the user's account
    const nameArray = snapId.split('/');
    const snapName = nameArray.length > 1 ? nameArray[1] : snapId;
    const localSnapId = `${account}/${snapName}`;

    // get the snap definition 
    const response = await exports.getSnap(localSnapId);
    if (!response.ok) {
      return response;
    }

    // set the privacy flag
    const snap = response.data;
    snap.private = privacy;

    // save the updated snap and return it
    await database.storeDocument(account, dbconstants.snapsCollection, snapName, snap);

    // return the updated snap
    return exports.getSnap(localSnapId);
  } catch (error) {
    console.error(`editSnap: caught exception: ${error}`);
    return errorvalue(error.message, error);
  }
}

// fork a snap into the user's environment
exports.forkSnap = async (userId, snapId) => {
  try {
    // get the account name associated with the user
    const account = await getAccount(userId);
    if (!account) {
      const message = `cannot find account for userId ${userId}`;
      console.error(`forkSnap: ${message}`);
      return errorvalue(message);
    }

    // get the snap definition 
    const response = await exports.getSnap(snapId);
    if (!response.ok) {
      return response;
    }

    // set the privacy flag
    const snap = response.data;
    if (!snap) {
      const message = `cannot find snap ${snapId}`;
      console.error(`forkSnap: ${message}`);
      return errorvalue(message);
    }

    // construct new name
    const forkedSnapId = `${account}/${snap.name}`;
    snap.snapId = forkedSnapId;
    snap.private = true;
    snap.account = account;
    snap.userId = userId;

    // store the new snap
    await database.storeDocument(account, dbconstants.snapsCollection, snap.name, snap);

    // return the new snapId
    return successvalue(snap);
  } catch (error) {
    console.error(`forkSnap: caught exception: ${error}`);
    return errorvalue(error.message, error);
  }
}

// get all snaps across all user environments
exports.getAllSnaps = async () => {
  try {
    const snaps = await database.queryGroup(null, dbconstants.snapsCollection, dbconstants.snapPrivateField, false);
    return successvalue(snaps);
  } catch (error) {
    console.error(`getAllSnaps: caught exception: ${error}`);
    return errorvalue(error.message, error);
  }
}

// get a snap definition from the user's environment
exports.getSnap = async (snapId) => {
  try {
    // snapId must be given as "user/name"
    const [account, snapName] = snapId.split('/');
    if (!account || !snapName) {
      const message = `invalid snapId ${snapId}`;
      console.error(`getSnap: ${message}`)
      return errorvalue(message);
    }

    // get the snap definition 
    const snap = await database.getDocument(account, dbconstants.snapsCollection, snapName);
    if (!snap) {
      return errorvalue(`snap ${snapId} not found`);
    }
    return successvalue(snap);
  } catch (error) {
    console.error(`getSnap: caught exception: ${error}`);
    return errorvalue(error.message, error);
  }
}

// get all snaps in the user's environment
exports.getSnaps = async (userId) => {
  try {
    // get the account name associated with the user
    const account = await getAccount(userId);
    if (!account) {
      const message = `cannot find account for userId ${userId}`;
      console.error(`getSnap: ${message}`)
      return errorvalue(message);
    }

    // get all the snaps in the user's account
    const snaps = await database.query(account, dbconstants.snapsCollection);
    if (!snaps) {
      return errorvalue('no snaps found');
    }
    return successvalue(snaps);
  } catch (error) {
    console.error(`getSnaps: caught exception: ${error}`);
    return errorvalue(error.message, error);
  }
}

// get account for a userId
const getAccount = async (userId) => {
  // retrieve the account associated with the user
  const user = await database.getUserData(userId, dbconstants.profile);
  const account = user && user.account;
  return account;
}

// parse snap YAML definition into a snap object
const parseDefinition = (account, definition, privateFlag) => {
  try {
    const snapDefinition = YAML.parse(definition);

    const snapId = `${account}/${snapDefinition.name}`;
    const name = snapDefinition.name;
    const triggerName = snapDefinition.trigger;
    const config = snapDefinition.config;
    const triggerConfigSection = triggerName && config && config.find && config.find(c => c.name === triggerName);
    const provider = triggerConfigSection && triggerConfigSection.provider;

    const snap = { 
      snapId: snapId,
      account: account,
      name: name,
      description: snapDefinition.description, 
      provider: provider,
      trigger: snapDefinition.trigger,
      actions: snapDefinition.actions,
      parameters: snapDefinition.parameters,
      config: snapDefinition.config,
      private: privateFlag,
      text: definition
    };

    // validate required fields
    for (const field of ['account', 'name', 'trigger', 'actions', 'config']) {
      if (!snap[field]) {
        const message = `snap definition did not contain required field "${field}"`;
        console.error(`parseDefinition: ${message}`);
        return errorvalue(message);
      }
    }

    if (!snap.actions || snap.actions.length === 0) {
      const message = `snap definition did not contain any actions`;
      console.error(`parseDefinition: ${message}`);
      return errorvalue(message);
    }

    if (snap.name.indexOf(' ') >= 0) {
      const message = `snap name cannot contain spaces`;
      console.error(`parseDefinition: ${message}`);
      return errorvalue(message);
    }

    if (snap.trigger.indexOf(' ') >= 0) {
      const message = `trigger name cannot contain spaces`;
      console.error(`parseDefinition: ${message}`);
      return errorvalue(message);
    }

    if (snap.actions.find(a => a.indexOf(' ') >= 0)) {
      const message = `action names cannot contain spaces`;
      console.error(`parseDefinition: ${message}`);
      return errorvalue(message);
    }

    return successvalue(snap);
  } catch (error) {
    console.error(`parseDefinition: caught exception: ${error}`);
    return errorvalue(error.message, error);
  }
}
