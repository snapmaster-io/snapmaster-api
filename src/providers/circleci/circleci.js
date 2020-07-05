// CircleCI provider

// exports:
//   apis.
//
//   createHandlers(app, [middlewaree]): create all route handlers
// 
//   name: provider name
//   definition: provider definition

const provider = require('../provider');
const axios = require('axios');

const providerName = 'circleci';
const entityName = `${providerName}:accounts`;
const defaultEntityName = `${entityName}:default`;

exports.name = providerName;
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
    const account = param.account;
    const project = param.project;

    console.log(`${providerName}: account ${account}, action ${action}, project ${project}`);

    if (!action || !account || !project) {
      console.error('invokeAction: missing required parameter');
      return null;
    }

    if (action !== 'trigger-pipeline') {
      console.error(`invokeAction: unknown action "${action}"`);
      return null;
    }

    // get token for calling API (either from the default entity in connection info, or the entity passed in)
    const token = await getToken(
      account === defaultEntityName ? 
        connectionInfo :
        param[entityName]
    );

    const baseUrl = 'https://circleci.com/api/v2/project';
    const url = `${baseUrl}/${project}/pipeline`;
    const headers = { 
      'Circle-Token': `${token}`
    };

    const response = await axios.post(
      url,
      "",
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
    if (!entity.username || !entity.token) {
      console.error('entityHandler: did not receive all authorization information');
      return null;
    }

    // retrieve the access token
    const token = await getToken(entity);
    if (!token) {
      console.error('entityHandler: authorization failure');
      return null;
    }

    // add the entity attributes to the result
    const result = { 
      secret: {
        ...entity, 
        token: token, 
      },
      __id: entity.username,
      __name: entity.username,
      __url: `https://circleci.com/dashboard`,
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
    const token = connectionInfo.token || connectionInfo.access_token;
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
