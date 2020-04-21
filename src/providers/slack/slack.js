// Slack provider

// exports:
//   createHandlers(app): create all route handlers
//   invokeAction(providerName, connectionInfo, activeSnapId, param): invoke an action
// 
//   entities.
//        accounts - the accounts entity
// 
//   provider: provider name
//   image: provider image url (local to SPA)
//   type: provider type (simple or link)
//   definition: provider definition

const axios = require('axios');
const provider = require('../provider');

const providerName = 'slack';
const entityName = `${providerName}:workspaces`;
const defaultEntityName = `${entityName}:default`;

exports.provider = providerName;
exports.image = `/${providerName}-logo.png`;
exports.type = provider.simpleProvider;
exports.definition = provider.getDefinition(providerName);

// entities defined by this provider
exports.entities = {};
exports.entities[entityName] = {
  entity: entityName,
  provider: providerName,
  itemKey: '__id',
  keyFields: ['token'],
};

exports.createHandlers = (app) => {
}

exports.invokeAction = async (providerName, connectionInfo, activeSnapId, param) => {
  try {
    const action = param.action;
    const workspace = param.workspace;
    const channel = param.channel;
    const message = param.message;

    console.log(`${providerName}: workspace ${workspace}, action ${action}, channel ${channel}, message ${message}`);

    if (!action || !workspace || !channel || !message) {
      console.error('invokeAction: missing required parameter');
      return null;
    }

    // get token for calling API (either from the default workspace in connection info, or the workspace passed in)
    const token = await getToken(
      workspace === defaultEntityName ? 
        connectionInfo :
        param[entityName]
    );

    const url = 'https://slack.com/api/chat.postMessage';
    const headers = { 
      'content-type': 'application/json',
      'authorization': `Bearer ${token}`
    };

    const body = JSON.stringify({
      channel,
      text: message
    });

    const response = await axios.post(
      url,
      body,
      {
        headers: headers
      });

    return response.data;  
  } catch (error) {
    console.log(`invokeAction: caught exception: ${error}`);
    return null;
  }
}

// this function is called when a new entity (e.g. account) is added
// it validates the provider-specific account info, and constructs 
// the entity that will be stored by the caller
exports.entities[entityName].func = async ([connectionInfo]) => {
  try {
    // construct an object with all entity info
    const entity = {};
    for (const param of connectionInfo) {
      entity[param.name] = param.value;
    }

    // verify we have everything we need to authenticate
    if (!entity.workspace || !entity.token) {
      console.error('entityHandler: did not receive all authorization information');
      return null;
    }

    // retrieve the access token
    const token = await getToken(entity);
    if (!token) {
      console.error('entityHandler: authorization failure');
      return null;
    }

    const url = entity.workspace.substring('.slack.com') ? 
      entity.workspace : 
      `${entity.workspace}.slack.com`;

    // add the entity attributes to the result
    const result = { 
      secret: {
        ...entity, 
        token: token, 
      },
      __id: entity.workspace,
      __name: entity.workspace,
      __url: `https://${url}`,
      __triggers: exports.definition.triggers,
      __actions: exports.definition.actions,
    };

    return result;
  } catch (error) {
    await error.response;
    console.log(`entityHandler: caught exception: ${error}`);
    return null;
  }
}

const getToken = async (connectionInfo) => {
  try {
    const token = connectionInfo.token;
    if (!token) {
      console.error('getToken: token not found');
      return null;
    }    
    return token;
  } catch (error) {
    console.log(`getToken: caught exception: ${error}`);
    return null;
  }
}