// snap engine 
// 
// exports:
//   activateSnap(userId, snapId, params): activate a snap into the user's environment
//   deactivateSnap(userId, activeSnapId): deactivate an active snap in the user's environment
//   executeSnap(userId, activeSnapId, params): execute snap actions
//   parseDefinition(userId, definition, privateFlag): parse a yaml definition into a snap object
//   pauseSnap(userId, activeSnapId): pause an active snap in the user's environment
//   resumeSnap(userId, activeSnapId): resume a paused snap in the user's environment

const database = require('../data/database');
const dbconstants = require('../data/database-constants');
const snapdal = require('./snap-dal');
const { simpleProvider, linkProvider } = require('../providers/provider');
const providers = require('../providers/providers');
const YAML = require('yaml');
const {JSONPath} = require('jsonpath-plus');

// provider definition keys
const keys = {
  actions: 'action',
  triggers: 'event'
}

// activate a snap into the user's environment
exports.activateSnap = async (userId, snapId, params = null) => {
  try {
    // get the snap object
    const snap = await snapdal.getSnap(snapId);
    if (!snap) {
      const message = `could not find snap ${snapId}`;
      console.error(`activateSnap: ${message}`);
      return { message: message };
    }

    if (!snap.provider) {
      const message = `could not find provider for ${snapId}`;
      console.error(`activateSnap: ${message}`);
      return { message: message };
    }

    // get the provider for the trigger
    const provider = providers.getProvider(snap.provider);

    // validate the snap definition against the parameters provided
    const message = await validateSnap(snap);
    if (message) {
      // a non-null message indicates an error
      return message;
    }

    // bind the parameters for the snap
    const boundParams = bindParameters(snap.config, params);

    // active snap ID is current timestamp
    const timestamp = new Date().getTime();
    const activeSnapId = "" + timestamp;

    const activeSnap = {
      activeSnapId: activeSnapId,
      userId: userId,
      snapId: snapId,
      provider: provider.provider,
      state: dbconstants.snapStateActive,
      activated: timestamp,
      trigger: snap.trigger,
      params: params,
      boundParams: boundParams
    }

    // find the trigger parameter
    const triggerParam = boundParams.find(p => p.name === snap.trigger);

    // create the snap trigger
    const triggerData = await provider.createTrigger(userId, activeSnapId, triggerParam);
    if (!triggerData) {
      return { message: 'could not activate snap' };
    }

    // add the trigger data to the activesnap record
    activeSnap.triggerData = triggerData;

    // store the activated snap information
    await database.storeDocument(userId, dbconstants.activeSnapsCollection, activeSnapId, activeSnap);

    return { message: 'success' };
  } catch (error) {
    console.log(`activateSnap: caught exception: ${error}`);
    return { message: 'could not activate snap' };
  }
}

// deactivate a snap in the user's environment
exports.deactivateSnap = async (userId, activeSnapId) => {
  try {
    // get the active snap object
    const activeSnap = await database.getDocument(userId, dbconstants.activeSnapsCollection, activeSnapId);
    if (!activeSnap) {
      return { message: `could not find active snap ID ${activeSnapId}`};
    }

    // delete the snap trigger
    const provider = providers.getProvider(activeSnap.provider);
    await provider.deleteTrigger(userId, activeSnap.triggerData);

    // delete all docs in the logs collection under the active snap document
    const docName = `${userId}/${dbconstants.activeSnapsCollection}/${activeSnapId}`;
    await database.removeCollection(docName, dbconstants.logsCollection);

    // delete the active snap from the database
    await database.removeDocument(userId, dbconstants.activeSnapsCollection, activeSnapId);
    return { message: 'success' };
  } catch (error) {
    console.log(`deactivateSnap: caught exception: ${error}`);
    return { message: `deactivateSnap error: ${error.message}`};
  }
}

// execute a snap that has been triggered
exports.executeSnap = async (userId, activeSnapId, params, payload) => {

  // declare logObject and activeSnap to make them available in catch block
  let logObject, activeSnap;

  try {
    // validate incoming userId and activeSnapId
    if (!userId || !activeSnapId) {
      return null;
    }

    // get activeSnap object
    activeSnap = await database.getDocument(userId, dbconstants.activeSnapsCollection, activeSnapId);
    if (!activeSnap) {
      return { message: `could not find active snap ID ${activeSnapId}`};
    }

    // log snap invocation
    logObject = await logInvocation(userId, activeSnap, params, payload);

    // increment and store execution counter in activeSnap document
    activeSnap.executionCounter = activeSnap.executionCounter ? activeSnap.executionCounter + 1 : 1;
    await database.storeDocument(userId, dbconstants.activeSnapsCollection, activeSnapId, activeSnap);

    // load snap definition via snapId
    const snap = await snapdal.getSnap(activeSnap.snapId);
    if (!snap) {
      console.error(`executeSnap: cannot find snapId ${activeSnap.snapId}`);
      return null;
    }    

    // execute actions
    for (const action of snap.actions) {
      // get the parameter object
      let param = activeSnap.boundParams.find(c => c.name === action);
      const provider = providers.getProvider(param.provider);

      // bind the payload to the parameter
      const newParam = bindPayloadToParameter(param, payload);

      // get the provider's connection information
      const connInfo = await getConnectionInfo(userId, param.provider);

      // invoke the provider
      const output = await provider.invokeAction(param.provider, connInfo, activeSnapId, newParam);

      // log the action execution
      const actionLog = {
        provider: param.provider,
        state: dbconstants.executionStateExecuted,
        param: newParam,
        output: output
      }

      await updateLog(logObject, actionLog);
    }

    // log the completed state
    logObject.state = dbconstants.executionStateComplete;
    await updateLog(logObject);

  } catch (error) {
    console.log(`executeSnap: caught exception: ${error}`);

    // log the error state
    logObject.state = dbconstants.executionStateError;
    await updateLog(logObject);

    // increment and store execution counter in activeSnap document
    activeSnap.errorCounter = activeSnap.errorCounter ? activeSnap.errorCounter + 1 : 1;
    await database.storeDocument(userId, dbconstants.activeSnapsCollection, activeSnapId, activeSnap);

    return null;
  }
}

exports.parseDefinition = (account, definition, privateFlag) => {
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
    if (!snap.account || !snap.name || !snap.trigger || !snap.actions || !snap.config) {
      console.error('parseDefinition: definition did not contain required fields');
      return null;
    }

    return snap;
  } catch (error) {
    console.log(`parseDefinition: caught exception: ${error}`);
    return null;
  }
}

// pause an active snap
exports.pauseSnap = async (userId, activeSnapId) => {
  try {
    // get the active snap object
    const activeSnap = await database.getDocument(userId, dbconstants.activeSnapsCollection, activeSnapId);
    if (!activeSnap) {
      return { message: `could not find active snap ID ${activeSnapId}`};
    }

    // delete the snap trigger
    const provider = providers.getProvider(activeSnap.provider);
    await provider.deleteTrigger(userId, activeSnap.triggerData);

    // set the snap state to "paused"
    activeSnap.state = dbconstants.snapStatePaused;
    activeSnap.activated = new Date().getTime();
    
    // store the new state of the active snap 
    await database.storeDocument(userId, dbconstants.activeSnapsCollection, activeSnapId, activeSnap);
    return { message: 'success' };
  } catch (error) {
    console.log(`pauseSnap: caught exception: ${error}`);
    return { message: `pauseSnap error: ${error.message}`};
  }
}

// resume a paused snap 
exports.resumeSnap = async (userId, activeSnapId) => {
  try {
    // get the active snap object
    const activeSnap = await database.getDocument(userId, dbconstants.activeSnapsCollection, activeSnapId);
    if (!activeSnap) {
      return { message: `could not find active snap ID ${activeSnapId}`};
    }

    // find the trigger parameter
    const triggerParam = activeSnap.boundParams.find(p => p.name === activeSnap.trigger);

    // re-create the snap trigger
    const provider = providers.getProvider(activeSnap.provider);
    const triggerData = await provider.createTrigger(userId, activeSnapId, triggerParam);
    if (!triggerData) {
      return { message: 'could not re-create trigger for this snap - try deactivating it' };
    }

    // set the snap state to "active", and refresh timestamp and triggerData
    activeSnap.state = dbconstants.snapStateActive;
    activeSnap.activated = new Date().getTime();
    activeSnap.triggerData = triggerData;

    // store the new state of the active snap 
    await database.storeDocument(userId, dbconstants.activeSnapsCollection, activeSnapId, activeSnap);
    return { message: 'success' };
  } catch (error) {
    console.log(`resumeSnap: caught exception: ${error}`);
    return { message: `resumeSnap error: ${error.message}`};
  }
}

// bind parameters to config by replacing ${paramname} with the parameter value
// returns the bound config object
const bindParameters = (config, params) => {
  // iterate over each entry in the config array
  const boundConfig = config.map(c => {
    // construct a new config entry
    const configEntry = { ...c };
    for (const key of Object.keys(c)) {
      for (const param of params) {
        const paramNameRegex = new RegExp(`\$${param.name}`, 'g');
        const paramValue = param.value;
        // copy the config entry, replacing the ${param} with its value
        configEntry[key] = configEntry[key].replace(`$${param.name}`, paramValue);
      }
    }
    // return the newly constructed entry
    return configEntry;
  });

  // return the bound config
  return boundConfig;
}

// bind payload by finding all JSONPath expressions and evaluating against the payload value
const bindPayloadToParameter = (param, payload) => {
  const regex = /\$\.[a-zA-Z][a-zA-Z0-9._]*/g;

  // construct a new config entry
  const newParam = { ...param };
  for (const key of Object.keys(param)) {
    // match the parameter value against the jsonpath regex
    const matches = param[key].match(regex);
    if (matches) {
      let value = param[key];
      // evaluate jsonpath expressions and replace them in value string
      for (const jsonPath of matches) {
        const result = JSONPath(jsonPath, payload);
        if (result && result.length > 0) {
          value = value.replace(jsonPath, result[0]);
        }
      }

      // replace the value with the new string
      newParam[key] = value;
    }
  }

  return newParam;
}

const getConnectionInfo = async (userId, providerName) => {
  try {
    // retrieve the provider
    const provider = providers.getProvider(providerName);

    // if this is an OAuth link provider, call the provider's getAccessInfo method to retrieve token info
    if (provider.type === linkProvider) {
      const info = provider.getAccessInfo(userId);
      return info;
    }

    // retrieve connection info from the user's connection info in the profile
    const connection = await database.getUserData(userId, providerName);
    const connectionInfo = connection && connection.connectionInfo;
    return connectionInfo;
  } catch (error) {
    console.error(`getConnectionInfo: caught exception: ${error}`);
    return null;
  }
}

// log the invocation in the logs collection
const logInvocation = async (userId, activeSnap, params, payload) => {
  try {
    const activeSnapId = activeSnap.activeSnapId;
    const timestamp = new Date().getTime();
    const documentName = "" + timestamp;
    const logObject = {
      timestamp,
      state: dbconstants.executionStateTriggered,
      userId,
      activeSnapId: activeSnap.activeSnapId,
      snapId: activeSnap.snapId,
      trigger: activeSnap.provider,
      actions: [],
      params,
      payload
    };

    const logsCollection = `${dbconstants.activeSnapsCollection}/${activeSnapId}/${dbconstants.logsCollection}`;
    await database.storeDocument(userId, logsCollection,documentName, logObject);

    // log the invocation in the console
    console.log(`executing snap ${activeSnap.snapId}`);

    return logObject;
  } catch (error) {
    console.error(`logInvocation: caught exception: ${error}`);
    return null;
  }
}

// update the log entry in the logs collection
const updateLog = async (logObject, actionLog) => {
  try {
    const documentName = "" + logObject.timestamp;
    const userId = logObject.userId;
    const activeSnapId = logObject.activeSnapId;
    if (actionLog) {
      logObject.actions.push(actionLog);
    }

    const logsCollection = `${dbconstants.activeSnapsCollection}/${activeSnapId}/${dbconstants.logsCollection}`;
    await database.storeDocument(userId, logsCollection,documentName, logObject);

    return logObject;
  } catch (error) {
    console.error(`updateLog: caught exception: ${error}`);
    return null;
  }
}

// validates a config section against the provider definition
//   definitions: a provider definition section (either triggers or actions)
//   key: either keys.triggers or keys.actions
//   config: the config section of the snap
//
// returns true for a valid config section, false for failed validation
const validateConfigSection = (definitions, key, config) => {
  try {
    // ensure config contains the key
    const definitionKey = config[key];
    if (!definitionKey) {
      console.error(`validateConfigSection: ${key} not specified`);
      return false;
    }

    // find the definition in the provider definitions based on the key
    const definition = definitions.find(t => t.name === definitionKey);
    if (!definition) {
      console.error(`validateConfigSection: key ${key} not found in provider definition`);
      return false;
    }

    // validate that we have each of the required parameters
    for (const param of definition.parameters) {
      if (param.required) {
        if (!config[param.name]) {
          console.error(`validateTriggerConfig: required parameter ${param.name} not found in snap config`);
          return false;
        }
      }
    }

    // config is valid
    return true;
  } catch (error) {
    console.error(`validateConfigSection: caught exception: ${error}`);
    return false;
  }
}

// validates snap against provider definition
// NOTE: returns an error message, or null on success
const validateSnap = async (snap) => {
  try {
    // get the config for the trigger
    const config = snap.config && snap.config.find && snap.config.find(c => c.name === snap.trigger);

    // get the provider for the trigger
    const provider = providers.getProvider(config.provider);

    // validate parameters against the trigger definitions
    const valid = validateConfigSection(provider.definition.triggers, keys.triggers, config);
    if (!valid) {
      const message = `${provider.provider} failed to validate config in snap ${snap.snapId}`;
      console.error(`activateSnap: ${message}`);
      return { message: message };
    }

    // validate parameters against the action definitions
    for (const action of snap.actions) {
      // get the config for this action
      const config = snap.config && snap.config.find && snap.config.find(c => c.name === action);

      // get the provider for the action
      const provider = providers.getProvider(config.provider);

      // validate parameters against the action definitions
      const valid = validateConfigSection(provider.definition.actions, keys.actions, config);
      if (!valid) {
        const message = `${provider.provider} failed to validate config in snap ${snap.snapId}`;
        console.error(`activateSnap: ${message}`);
        return { message: message };
      }
    }

    // return null indicating a valid snap
    return null;
  } catch (error) {
    console.error(`validateSnap: caught exception: ${error}`);
  }
}
