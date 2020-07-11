// snap engine 
// 
// exports:
//   activateSnap(userId, snapId, params): activate a snap into the user's environment
//   deactivateSnap(userId, activeSnapId): deactivate an active snap in the user's environment
//   executeSnap(userId, activeSnapId, params): execute snap actions
//   pauseSnap(userId, activeSnapId): pause an active snap in the user's environment
//   resumeSnap(userId, activeSnapId): resume a paused snap in the user's environment

const database = require('../data/database');
const dbconstants = require('../data/database-constants');
const snapdal = require('./snapdal');
const providers = require('../providers/providers');
const connections = require('../modules/connections');
const credentials = require('../modules/credentials');
const { successvalue, errorvalue } = require('../modules/returnvalue');
const {JSONPath} = require('jsonpath-plus');
const axios = require('axios');

// provider definition keys
const keys = {
  actions: 'action',
  triggers: 'event'
}

// activate a snap into the user's environment
exports.activateSnap = async (userId, snapId, params, activeSnapId = null) => {
  try {
    let activeSnap = {};
    let snap;
    if (activeSnapId) {
      // get the active snap object
      activeSnap = await database.getDocument(userId, dbconstants.activeSnapsCollection, activeSnapId);
      if (!activeSnap) {
        const message = `could not find active snap ID ${activeSnapId}`;
        console.error(`activateSnap: ${message}`);
        return errorvalue(message);
      }

      // use the snap definition that is embedded in the activeSnap
      snap = activeSnap.snap;
    } 

    // if we don't have a snap yet, retrieve it.  older activeSnaps didn't embed the 
    // snap yet, and this code path helps with migration
    if (!snap) {
      const result = await snapdal.getSnap(snapId);
      if (!result || result.error || !result.data) {
        const message = `could not find snap ${snapId}`;
        console.error(`activateSnap: ${message}`);
        return errorvalue(message);
      }
      snap = result.data
    }

    if (!snap.provider) {
      const message = `could not find provider for ${snapId}`;
      console.error(`activateSnap: ${message}`);
      return errorvalue(message);
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

    // create a new object based on the trigger parameter
    const triggerParam = { ...boundParams.find(c => c.name === snap.trigger) };

    // bind entities to the parameter (this mutates the parameter)
    // this is where connection information that is stored on a per-entity basis gets added to the parameter
    // for example, for Docker, the docker:accounts entity for the account gets retrieved and added to parameter
    // 
    // this is done on a new object (triggerParam) so that it is never stored/logged in the activesnap
    await bindEntitiesToParameter(userId, provider.definition.triggers, triggerParam, keys.triggers);

    // active snap ID is current timestamp
    const timestamp = new Date().getTime();
    activeSnapId = activeSnapId || ("" + timestamp);

    activeSnap = {
      ...activeSnap,
      activeSnapId: activeSnapId,
      userId: userId,
      snapId: snapId,
      snap: snap,
      provider: provider.name,
      state: dbconstants.snapStateActive,
      activated: timestamp,
      trigger: snap.trigger,
      params: params,
      boundParams: boundParams
    };

    // get the provider's connection information
    const connInfo = await getConnectionInfo(userId, snap.provider);
    if (!connInfo) {
      const message = 'could not obtain connection info to activate snap';
      console.error(`activateSnap: ${message}`);
      return errorvalue(message);
    }

    // create the snap trigger
    const triggerData = await provider.createTrigger(provider.name, connInfo, userId, activeSnapId, triggerParam);
    if (!triggerData) {
      const message = 'could not create trigger when activating snap';
      console.error(`activateSnap: ${message}`);
      return errorvalue(message);
    }

    // a lack of a url indicates an error, and the return value is the error message
    if (!triggerData.url) {
      const message = `error creating trigger: ${triggerData}`;
      console.error(`activateSnap: ${message}`);
      return errorvalue(message);
    }

    // add the trigger data to the activesnap record
    activeSnap.triggerData = triggerData;

    // store the activated snap information
    await database.storeDocument(userId, dbconstants.activeSnapsCollection, activeSnapId, activeSnap);

    return successvalue(activeSnap);
  } catch (error) {
    console.error(`activateSnap: caught exception: ${error}`);
    return errorvalue(`error encountered while activating snap: ${error.message}`, error);
  }
}

// deactivate a snap in the user's environment
exports.deactivateSnap = async (userId, activeSnapId) => {
  try {
    // get the active snap object
    const activeSnap = await database.getDocument(userId, dbconstants.activeSnapsCollection, activeSnapId);
    if (!activeSnap) {
      const message = `could not find active snap ID ${activeSnapId}`;
      console.error(`deactivateSnap: ${message}`);
      return errorvalue(message);
    }

    // if the snap is active (not paused), delete the trigger
    if (activeSnap.state !== "paused") {
      // find the trigger parameter
      const param = activeSnap.boundParams.find(p => p.name === activeSnap.trigger);

      // retrieve the provider
      const provider = providers.getProvider(activeSnap.provider);

      // get the provider's connection information
      const connInfo = await getConnectionInfo(userId, activeSnap.provider);
      if (!connInfo) {
        const message = 'could not obtain connection info to deactivate snap';
        console.error(`deactivateSnap: ${message}`);
        return errorvalue(message);
      }

      // create a new object based on the trigger parameter
      const triggerParam = { ...param };

      // bind entities to the parameter (this mutates the parameter)
      // this is where connection information that is stored on a per-entity basis gets added to the parameter
      // for example, for Docker, the docker:accounts entity for the account gets retrieved and added to parameter
      // 
      // this is done on a new object (triggerParam) so that it is never stored/logged in the activesnap
      await bindEntitiesToParameter(userId, provider.definition.triggers, triggerParam, keys.triggers);
      
      // delete the snap trigger
      const response = await provider.deleteTrigger(activeSnap.provider, connInfo, activeSnap.triggerData, triggerParam);
      if (response == null) {
        // TODO: fix this code path. currently we need a way to delete all snap artifacts when it gets deactivated, but 
        // also return the message below 
        // return { message: 'could not remove trigger for this snap - use the trigger info action to remove it manually from the provider' };
      }
    }
    
    // delete all docs in the logs collection under the active snap document
    const docName = `${userId}/${dbconstants.activeSnapsCollection}/${activeSnapId}`;
    await database.removeCollection(docName, dbconstants.logsCollection);

    // delete the active snap from the database
    await database.removeDocument(userId, dbconstants.activeSnapsCollection, activeSnapId);
    return successvalue(null);
  } catch (error) {
    console.error(`deactivateSnap: caught exception: ${error}`);
    return errorvalue(`error encountered while deactivating snap: ${error.message}`, error);
  }
}

// edit a running snap in the user's environment
exports.editSnap = async (userId, activeSnapId, params) => {
  try {
    // get the active snap object
    const activeSnap = await database.getDocument(userId, dbconstants.activeSnapsCollection, activeSnapId);
    if (!activeSnap) {
      const message = `could not find active snap ID ${activeSnapId}`;
      console.error(`editSnap: ${message}`);
      return errorvalue(message);
    }

    // if the snap is active (not paused), delete the trigger
    if (activeSnap.state !== "paused") {
      // find the trigger parameter
      const param = activeSnap.boundParams.find(p => p.name === activeSnap.trigger);

      // retrieve the provider
      const provider = providers.getProvider(activeSnap.provider);

      // get the provider's connection information
      const connInfo = await getConnectionInfo(userId, activeSnap.provider);
      if (!connInfo) {
        const message = 'could not obtain connection info to edit snap';
        console.error(`editSnap: ${message}`);
        return errorvalue(message);
      }

      // create a new object based on the trigger parameter
      const triggerParam = { ...param };

      // bind entities to the parameter (this mutates the parameter)
      // this is where connection information that is stored on a per-entity basis gets added to the parameter
      // for example, for Docker, the docker:accounts entity for the account gets retrieved and added to parameter
      // 
      // this is done on a new object (triggerParam) so that it is never stored/logged in the activesnap
      await bindEntitiesToParameter(userId, provider.definition.triggers, triggerParam, keys.triggers);
            
      // delete the snap trigger
      const response = await provider.deleteTrigger(activeSnap.provider, connInfo, activeSnap.triggerData, triggerParam);
      if (response === null) {
        const message = 'could not remove trigger for this snap - try deactivating and reactivating it with new parameters';
        console.error(`editSnap: ${message}`);
        return errorvalue(message);
      }
    }

    // now, activate the snap using the new parameters
    return await exports.activateSnap(userId, activeSnap.snapId, params, activeSnapId);
  } catch (error) {
    console.error(`editSnap: caught exception: ${error}`);
    return errorvalue(`error editing snap: ${error.message}`, error);
  }
}

// execute an action
exports.executeAction = async (userId, actionId, operation, params) => {
  try {
    // validate incoming userId and actionId, operation
    if (!userId || !actionId || !operation) {
      const message = 'missing action or operation';
      console.error(`executeAction: ${message}`);
      return { error: true, message: message };
    }

    // get the account name associated with the user
    const account = await getAccount(userId);
    if (!account) {
      const message = `cannot find account for userId ${userId}`;
      console.error(`executeAction: ${message}`);
      return { error: true, message: message };
    }

    // re-construct action name to ensure it's in the user's account
    const nameArray = actionId.split('/');
    const actionName = nameArray.length > 1 ? nameArray[1] : actionId;

    // get action object
    const action = await database.getDocument(account, dbconstants.actionsCollection, actionName);
    if (!action) {
      const message = `cannot find action ID ${actionId}`;
      console.error(`executeAction: ${message}`);
      return { error: true, message: message };
    }

    // execute the action
    const output = await executeAction(userId, action, operation, params);
    return output;
  } catch (error) {
    console.error(`executeAction: caught exception: ${error}`);
    return null;
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
    const snap = activeSnap.snap;//await snapdal.getSnap(activeSnap.snapId);
    if (!snap) {
      console.error(`executeSnap: cannot find snapId ${activeSnap.snapId}`);
      return null;
    }    

    // execute actions
    for (const action of snap.actions) {
      // locate the parameter object for this action
      let param = activeSnap.boundParams.find(c => c.name === action);

      // get the provider for this action
      const provider = providers.getProvider(param.provider);

      // bind the payload to the parameter
      param = bindPayloadToParameter(param, payload);

      // bind entities to the parameter (this mutates the parameter)
      // this is where connection information that is stored on a per-entity basis gets added to the parameter
      // for example, for GCP, the gcp:projects entity for the project gets retrieved and added to parameter
      // 
      // this is done on a new object (actionParam) so that it is never stored/logged in the activesnap
      // create a new object based on the the parameters for this action
      const actionParam = { ...param };
      await bindEntitiesToParameter(userId, provider.definition.actions, actionParam, keys.actions);

      // get the provider's connection information
      // this brings in global connection information stored in the top-level user struct
      // TODO: phase this out so that all connection info comes from provider entities as above
      const connInfo = await getConnectionInfo(userId, param.provider);

      // invoke the provider
      const output = await provider.invokeAction(param.provider, connInfo, activeSnapId, actionParam);

      // log the action execution (with the parameter object that doesn't contain entity info)
      const actionLog = {
        name: param.name,
        provider: param.provider,
        action: param.action,
        state: dbconstants.executionStateExecuted,
        param: param,
        output: output
      }

      await updateLog(logObject, actionLog);
    }

    // log the completed state
    logObject.state = dbconstants.executionStateComplete;
    await updateLog(logObject);

  } catch (error) {
    console.error(`executeSnap: caught exception: ${error}`);

    // log the error state
    logObject.state = dbconstants.executionStateError;
    await updateLog(logObject);

    // increment and store execution counter in activeSnap document
    activeSnap.errorCounter = activeSnap.errorCounter ? activeSnap.errorCounter + 1 : 1;
    await database.storeDocument(userId, dbconstants.activeSnapsCollection, activeSnapId, activeSnap);

    return null;
  }
}

// pause an active snap
exports.pauseSnap = async (userId, activeSnapId) => {
  try {
    // get the active snap object
    const activeSnap = await database.getDocument(userId, dbconstants.activeSnapsCollection, activeSnapId);
    if (!activeSnap) {
      const message = `could not find active snap ID ${activeSnapId}`;
      console.error(`pauseSnap: ${message}`);
      return errorvalue(message);
    }

    // if the snap is paused (not active), return a message to that effect
    if (activeSnap.state === "paused") {
      const message = `active snap ${activeSnapId} is already paused`;
      console.error(`resumeSnap: ${message}`);
      return errorvalue(message);
    }

    // find the trigger parameter
    const param = activeSnap.boundParams.find(p => p.name === activeSnap.trigger);

    // retrieve the provider
    const provider = providers.getProvider(activeSnap.provider);

    // get the provider's connection information
    const connInfo = await getConnectionInfo(userId, activeSnap.provider);
    if (!connInfo) {
      const message = 'could not obtain connection info to pause snap';
      console.error(`pauseSnap: ${message}`);
      return errorvalue(message);
  }

    // create a new object based on the trigger parameter
    const triggerParam = { ...param };

    // bind entities to the parameter (this mutates the parameter)
    // this is where connection information that is stored on a per-entity basis gets added to the parameter
    // for example, for Docker, the docker:accounts entity for the account gets retrieved and added to parameter
    // 
    // this is done on a new object (triggerParam) so that it is never stored/logged in the activesnap
    await bindEntitiesToParameter(userId, provider.definition.triggers, triggerParam, keys.triggers);
          
    // delete the snap trigger
    const response = await provider.deleteTrigger(activeSnap.provider, connInfo, activeSnap.triggerData, triggerParam);
    if (response == null) {
      const message = 'could not remove trigger for this snap - try deactivating it';
      console.error(`pauseSnap: ${message}`);
      return errorvalue(message);
    }

    // set the snap state to "paused"
    activeSnap.state = dbconstants.snapStatePaused;
    activeSnap.activated = new Date().getTime();
    
    // store the new state of the active snap 
    await database.storeDocument(userId, dbconstants.activeSnapsCollection, activeSnapId, activeSnap);
    return successvalue(activeSnap);
  } catch (error) {
    console.error(`pauseSnap: caught exception: ${error}`);
    return errorvalue(`error encountered while pausing snap: ${error.message}`, error);
  }
}

// resume a paused snap 
exports.resumeSnap = async (userId, activeSnapId) => {
  try {
    // get the active snap object
    const activeSnap = await database.getDocument(userId, dbconstants.activeSnapsCollection, activeSnapId);
    if (!activeSnap) {
      const message = `could not find active snap ID ${activeSnapId}`;
      console.error(`resumeSnap: ${message}`);
      return errorvalue(message);
    }

    // if the snap is active (not paused), return a message to that effect
    if (activeSnap.state !== "paused") {
      const message = `active snap ${activeSnapId} is already active`;
      console.error(`resumeSnap: ${message}`);
      return errorvalue(message);
    }

    // find the trigger parameter
    const param = activeSnap.boundParams.find(p => p.name === activeSnap.trigger);

    // retrieve the provider
    const provider = providers.getProvider(activeSnap.provider);

    // get the provider's connection information
    const connInfo = await getConnectionInfo(userId, activeSnap.provider);
    if (!connInfo) {
      const message = 'could not obtain connection info to resume snap';
      console.error(`resumeSnap: ${message}`);
      return errorvalue(message);
  }

    // create a new object based on the trigger parameter
    const triggerParam = { ...param };

    // bind entities to the parameter (this mutates the parameter)
    // this is where connection information that is stored on a per-entity basis gets added to the parameter
    // for example, for Docker, the docker:accounts entity for the account gets retrieved and added to parameter
    // 
    // this is done on a new object (triggerParam) so that it is never stored/logged in the activesnap
    await bindEntitiesToParameter(userId, provider.definition.triggers, triggerParam, keys.triggers);
    
    // re-create the snap trigger
    const triggerData = await provider.createTrigger(provider.name, connInfo, userId, activeSnapId, triggerParam);
    if (!triggerData) {
      const message = 'could not re-create trigger for this snap - try deactivating it';
      console.error(`resumeSnap: ${message}`);
      return errorvalue(message);
    }

    // set the snap state to "active", and refresh timestamp and triggerData
    activeSnap.state = dbconstants.snapStateActive;
    activeSnap.activated = new Date().getTime();
    activeSnap.triggerData = triggerData;

    // store the new state of the active snap 
    await database.storeDocument(userId, dbconstants.activeSnapsCollection, activeSnapId, activeSnap);
    return successvalue(activeSnap);
  } catch (error) {
    console.error(`resumeSnap: caught exception: ${error}`);
    return errorvalue(`error encountered while resuming snap: ${error.message}`, error);
  }
}

// bind entities to parameter by retrieving the entity value and adding to the parameter
const bindEntitiesToParameter = async (userId, definitions, param, key) => {
  try {
    // find the definition in the provider action definitions based on the key
    const definition = definitions.find(t => t.name === param[key]);
    if (!definition) {
      console.error(`bindEntitiesToParameter: action ${param.action} not found in provider definition`);
      return;
    }

    // if no parameters, no work to be done
    if (!definition.parameters) {
      return;
    }
    
    // retrieve the entity for each parameter annotated with an entity
    for (const p of definition.parameters) {
      if (p.entity) {
        // find the parameter value
        const value = param[p.name];
        if (value) {
          // get the entity
          let entity = await database.getDocument(userId, p.entity, value);          
          if (entity) {
            // determine whether there is a secret associated with this entity
            if (entity[dbconstants.keyField]) {
              // get and parse the secret value
              const value = await credentials.get(userId, entity[dbconstants.keyField]);
              if (value) {
                const parsedValue = JSON.parse(value);
                entity = { ...entity, ...parsedValue };  
              }
            }
            // augment the parameter with the entity using the entity name as a key
            param[p.entity] = entity;
          }
        }
      }
    }
  } catch (error) {
    console.error(`bindEntitiesToParameter: caught exception: ${error}`);
  }
}

// bind parameters to config by replacing ${paramname} with the parameter value
// returns the bound config object
const bindParameters = (config, params) => {
  try {
    // iterate over each entry in the config array
    const boundConfig = config.map(c => {
      // construct a new config entry
      const configEntry = { ...c };

      // iterate over the config keys and bind parameters
      if (params) {
        for (const key of Object.keys(c)) {
          for (const param of params) {
            //const paramNameRegex = new RegExp(`\$${param.name}`, 'g');

            // grab the current value as a string
            const currentValue = '' + configEntry[key];

            // grab the value of the parameter
            const paramValue = param.value;

            // set the config entry value, replacing the ${param} with its value
            configEntry[key] = currentValue.replace(`$${param.name}`, paramValue);
          }
        }
      }
      // return the newly constructed entry
      return configEntry;
    });

    // return the bound config
    return boundConfig;
  } catch (error) {
    console.error(`bindParameters: caught exception: ${error}`);
  }
}

// bind payload by finding all JSONPath expressions and evaluating against the payload value
const bindPayloadToParameter = (param, payload) => {
  const regex = /\$\.[a-zA-Z][a-zA-Z0-9._\[\]]*/g;

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

const executeAction = async (userId, action, operation, params) => {
  try {
    // get the connection information
    const connectionInfo = await getConnectionInfo(userId, action.provider);

    const url = `${action.url}/${operation}`;
    const body = {
      connectionInfo,
      action: operation,
    };

    // add parameter values to the body
    for (const param of params) {
      body[param.name] = param.value;
    }

    const headers = { 
      'content-type': 'application/json',
      //'authorization': `Bearer ${token}`
    };

    const response = await axios.post(
      url,
      body,
      {
        headers: headers
      });

    // construct output message
    const output = response.data;
    return output;
  } catch (error) {
    console.error(`executeAction: caught exception: ${error}`);
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

const getConnectionInfo = async (userId, providerName) => {
  try {
    const connectionInfo = await connections.getConnectionInfo(userId, providerName);

    // back-compat: older formats stored connection info as an array of objects
    if (connectionInfo.length) {
      // normalize connection info into a single object
      const connectionInfoObject = {};
      for (const param of connectionInfo) {
        connectionInfoObject[param.name] = param.value;
      }
      return connectionInfoObject;
    }

    // return the connectionInfo object
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

    // get the trigger parameter
    const triggerParam = activeSnap.boundParams.find(p => p.name === activeSnap.trigger);

    // create the log object
    const logObject = {
      timestamp,
      state: dbconstants.executionStateTriggered,
      userId,
      activeSnapId: activeSnap.activeSnapId,
      snapId: activeSnap.snapId,
      trigger: activeSnap.provider,
      triggerName: activeSnap.trigger,
      event: triggerParam && triggerParam.event,
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
      const message = `'${key}' not specified`;
      console.error(`validateConfigSection: ${message}`);
      return message;
    }

    // find the definition in the provider definitions based on the key
    const definition = definitions.find(t => t.name === definitionKey);
    if (!definition) {
      const message = `'${key}' not found in provider definition`;
      console.error(`validateConfigSection: ${message}`);
      return message;
    }

    // if no required parameters defined, pass the validation
    if (!definition.parameters) {
      return null;
    }

    // validate that we have each of the required parameters
    for (const param of definition.parameters) {
      if (param.required) {
        if (!config[param.name]) {
          const message = `required parameter '${param.name}' not found in snap config`;
          console.error(`validateConfigSection: ${message}`);
          return message;
        }
      }
    }

    // config is valid
    return null;
  } catch (error) {
    console.error(`validateConfigSection: caught exception: ${error}`);
    return `error validating config section: ${error}`;
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
    const invalid = validateConfigSection(provider.definition.triggers, keys.triggers, config);
    if (invalid) {
      const message = `${provider.name} provider failed to validate config in snap ${snap.snapId}`;
      console.error(`validateSnap: ${message}`);
      return errorvalue(`${message}: ${invalid}`);
    }

    // validate parameters against the action definitions
    for (const action of snap.actions) {
      // get the config for this action
      const config = snap.config && snap.config.find && snap.config.find(c => c.name === action);

      // get the provider for the action
      const provider = providers.getProvider(config.provider);

      // validate parameters against the action definitions
      const invalid = validateConfigSection(provider.definition.actions, keys.actions, config);
      if (invalid) {
        const message = `${provider.name} provider failed to validate config in snap ${snap.snapId}`;
        console.error(`validateSnap: ${message}`);
        return errorvalue(`${message}: ${invalid}`);
      }
    }

    // return null indicating a valid snap
    return null;
  } catch (error) {
    console.error(`validateSnap: caught exception: ${error}`);
    return errorvalue(`error validating snap config: ${error}`, error);
  }
}
