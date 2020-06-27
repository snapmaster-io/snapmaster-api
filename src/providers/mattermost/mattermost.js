// Mattermost provider

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

const providerName = 'mattermost';
const entityName = `${providerName}:servers`;
const defaultEntityName = `${entityName}:default`;

exports.provider = providerName;
exports.image = `/${providerName}-logo.png`;
exports.definition = provider.getDefinition(providerName);
exports.type = exports.definition.connection && exports.definition.connection.type;

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
    let server = param.server;
    const team = param.team;
    const channel = param.channel;
    const message = param.message;

    console.log(`${providerName}: server ${server}, team ${team}, action ${action}, channel ${channel}, message ${message}`);

    if (!action || !server || !team || !channel || !message) {
      console.error('invokeAction: missing required parameter');
      return null;
    }

    // get token for calling API (either from the default server in connection info, or the server passed in)
    const token = await getToken(
      server === defaultEntityName ? 
        connectionInfo :
        param[entityName]
    );

    // use the server in the connection info for the default entity
    if (server === defaultEntityName) {
      server = connectionInfo.server.replace('https://', '');
    }

    const baseUrl = `https://${server}/api/v4`
    const channelPath = encodeURI(`${baseUrl}/teams/name/${team}/channels/name/${channel}`);
    const headers = { 
      'content-type': 'application/json',
      'authorization': `Bearer ${token}`
    };

    const channelIDResponse = await axios.get(channelPath, { headers: headers });
    const channelID = channelIDResponse && channelIDResponse.data && channelIDResponse.data.id;
    if (!channelID) {
      console.error(`invokeAction: could not find channel ID for team ${team} channel ${channel}`);
      return null;
    }

    const postPath = `${baseUrl}/posts`
    const body = JSON.stringify({
      channel_id: channelID,
      message
    });

    const response = await axios.post(
      postPath,
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
    if (!entity.server || !entity.token) {
      console.error('entityHandler: did not receive all authorization information');
      return null;
    }

    // retrieve the access token
    const token = await getToken(entity);
    if (!token) {
      console.error('entityHandler: authorization failure');
      return null;
    }

    const server = entity.server.replace('https://', '');
    entity.server = server;

    // add the entity attributes to the result
    const result = { 
      secret: {
        ...entity, 
        token: token, 
      },
      __id: entity.server,
      __name: entity.server,
      __url: `https://${server}`,
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