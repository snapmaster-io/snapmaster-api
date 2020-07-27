// Twilio provider

// exports:
//   createHandlers(app): create all route handlers
//   invokeAction(providerName, connectionInfo, activeSnapId, param): invoke an action
// 
//   entities.
//        accounts - the accounts entity
// 
//   name: provider name
//   definition: provider definition

const Twilio = require('twilio'); 
const provider = require('../provider');
const { successvalue, errorvalue } = require('../../modules/returnvalue');

const providerName = 'twilio';
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
  keyFields: ['sid', 'token'],
};

exports.createHandlers = (app) => {
}

exports.invokeAction = async (providerName, connectionInfo, activeSnapId, param) => {
  try {
    const action = param.action;
    if (!action) {
      const message = `missing required parameter "action"`;
      console.error(`invokeAction: ${message}`);
      return errorvalue(message);
    }
    const account = param.account;
    if (!account) {
      const message = `missing required parameter "account"`;
      console.error(`invokeAction: ${message}`);
      return errorvalue(message);
    }
    const to = param.to;
    if (!to) {
      const message = `missing required parameter "to"`;
      console.error(`invokeAction: ${message}`);
      return errorvalue(message);
    }
    const from = param.from;
    if (!from) {
      const message = `missing required parameter "from"`;
      console.error(`invokeAction: ${message}`);
      return errorvalue(message);
    }
    const message = param.message;
    if (!message) {
      const message = `missing required parameter "message"`;
      console.error(`invokeAction: ${message}`);
      return errorvalue(message);
    }
    const mediaUrl = param.mediaUrl || 'https://github.com/snapmaster-io/snapmaster/raw/master/public/SnapMaster-logo-220.png';

    if (action !== 'send') {
      const message = `unknown action "${action}"`;
      console.error(`invokeAction: ${message}`);
      return errorvalue(message);
    }

    console.log(`${providerName}: account ${account}, action ${action}, to ${to}, message ${message}`);

    // get client for calling API (either from the default account in connection info, or the account passed in)
    const client = await getClient(
      account === defaultEntityName ? 
        connectionInfo :
        param[entityName]
    );

    const msg = {
      body: message, 
      from,
      to,
      mediaUrl
    };

    // send message
    const response = await client.messages.create(msg);

    // return only the data 
    const output = JSON.parse(JSON.stringify(response));
    return successvalue(output);
  } catch (error) {
    console.error(`invokeAction: caught exception: ${error}`);
    return errorvalue(error.message);
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
    if (!entity.account || !entity.sid || !entity.token) {
      console.error('entityHandler: did not receive all authorization information');
      return null;
    }

    // retrieve the client
    const client = await getClient(entity);
    if (!client) {
      console.error('entityHandler: authorization failure');
      return null;
    }

    // add the entity attributes to the result
    const result = { 
      secret: {
        ...entity, 
      },
      __id: entity.account,
      __name: entity.account,
      __url: `https://www.twilio.com/console`,
    };

    return result;
  } catch (error) {
    await error.response;
    console.log(`entityHandler: caught exception: ${error}`);
    return null;
  }
}

const getClient = async (connectionInfo) => {
  try {
    const sid = connectionInfo.sid;
    if (!sid) {
      console.error('getClient: sid not found');
      return null;
    }

    const token = connectionInfo.token;
    if (!token) {
      console.error('getClient: token not found');
      return null;
    }    

    const client = new Twilio(sid, token);
    return client;
  } catch (error) {
    console.log(`getClient: caught exception: ${error}`);
    return null;
  }
}