// snap engine 
// 
// exports:
//   activateSnap(userId, snapId, params): activate a snap into the user's environment
//   deactivateSnap(userId, activeSnapId): deactivate an active snap in the user's environment
//   parseDefinition(userId, definition, privateFlag): parse a yaml definition into a snap object
//   executeSnap(userId, activeSnapId, params): execute snap actions

const database = require('../data/database');
const dbconstants = require('../data/database-constants');
const snapdal = require('./snap-dal');
const providers = require('../providers/providers');
const YAML = require('yaml');

// provider definition keys
const keys = {
  actions: 'action',
  triggers: 'event'
}

// activate a snap into the user's environment
exports.activateSnap = async (userId, snapId, params = null) => {
  try {
    // get the snap object
    const snap = await snapdal.getSnap(userId, snapId);
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
    const activeSnapId = new Date().getTime().toString();
    const activeSnap = {
      activeSnapId: activeSnapId,
      userId: userId,
      snapId: snapId,
      provider: provider.provider,
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
    // get the active snap structure
    const activeSnap = await database.getDocument(userId, dbconstants.activeSnapsCollection, activeSnapId);
    if (!activeSnap) {
      return { message: `could not find active snap ID ${activeSnapId}`};
    }

    // delete the snap trigger
    const provider = providers.getProvider(activeSnap.provider);
    await provider.deleteTrigger(userId, activeSnap.triggerData);

    // delete the active snap from the database
    await database.removeDocument(userId, dbconstants.activeSnapsCollection, activeSnapId);
    return { message: 'success' };
  } catch (error) {
    console.log(`deactivateSnap: caught exception: ${error}`);
    return { message: `deactivateSnap error: ${error.message}`};
  }
}

// execute a snap that has been triggered
exports.executeSnap = async (userId, activeSnapId, params) => {
  try {
    // validate incoming userId and activeSnapId
    if (!userId || !activeSnapId) {
      return null;
    }

    // get activeSnap object
    const activeSnap = await database.getDocument(userId, dbconstants.activeSnapsCollection, activeSnapId);
    if (!activeSnap) {
      return { message: `could not find active snap ID ${activeSnapId}`};
    }

    // load snap definition via snapId
    const snap = await snapdal.getSnap(userId, activeSnap.snapId);
    if (!snap) {
      console.error(`executeSnap: cannot find snapId ${activeSnap.snapId}`);
      return null;
    }

    console.log(`executing snap ${snap.snapId}`);

    // execute actions
    for (const action of snap.actions) {
      // get the parameter object
      const param = activeSnap.boundParams.find(c => c.name === action);
      const provider = providers.getProvider(param.provider);

      // invoke the provider
      const status = await provider.invokeAction(userId, activeSnapId, param);
    }

  } catch (error) {
    console.log(`executeSnap: caught exception: ${error}`);
    return null;
  }
}

exports.parseDefinition = (userId, definition, privateFlag) => {
  try {
    const snapDefinition = YAML.parse(definition);

    const snapId = `${userId}/${snapDefinition.name}`;
    const name = snapDefinition.name;
    const triggerName = snapDefinition.trigger;
    const config = snapDefinition.config;
    const triggerConfigSection = triggerName && config && config.find && config.find(c => c.name === triggerName);
    const provider = triggerConfigSection && triggerConfigSection.provider;

    const snap = { 
      snapId: snapId,
      userId: userId,
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
    if (!snap.name || !snap.trigger || !snap.actions || !snap.config) {
      console.error('parseDefinition: definition did not contain required fields');
      return null;
    }

    return snap;
  } catch (error) {
    console.log(`parseDefinition: caught exception: ${error}`);
    return null;
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

// validates a config section against the provider definition
//   definitions: a provider definition section (either triggers or actions)
//   key: either keys.triggers or keys.actions
//   config: the config section of the snap
//
// returns true for a valid config section, false for failed validation
const validateConfigSection = (definitions, key, config) => {

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


`
config:
  - name: github
    provider: github
    repo: $repo
    event: push
    branch: master

- name: push
  description: push event into a repository
  parameters:
  - name: repo
    description: name of git repository
    required: true
  - name: branch
    description: name of branch
    required: false
`