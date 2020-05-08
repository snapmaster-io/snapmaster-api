// Sendgrid provider

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

const sgMail = require('@sendgrid/mail');
const provider = require('../provider');

const providerName = 'sendgrid';
const entityName = `${providerName}:accounts`;
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
  keyFields: ['sid', 'token'],
};

exports.createHandlers = (app) => {
}

exports.invokeAction = async (providerName, connectionInfo, activeSnapId, param) => {
  try {
    const action = param.action;
    const account = param.account;
    const to = param.to;
    const from = param.from;
    const subject = param.subject;
    const message = param.message;
    let html = param.html;

    console.log(`${providerName}: account ${account}, action ${action}, to ${to}, message ${message}`);

    if (!action || !account || !to || !from || !message) {
      console.error('invokeAction: missing required parameter');
      return null;
    }

    if (action !== 'send') {
      console.error(`invokeAction: unknown action "${action}"`);
      return null;
    }

    // get client for calling API (either from the default account in connection info, or the account passed in)
    const token = await getToken(
      account === defaultEntityName ? 
        connectionInfo :
        param[entityName]
    );

    sgMail.setApiKey(token);

    // provide a default html value
    if (!html) {
      html = `<strong>${message}</strong>`;
    }
  
    const msg = {
      to,
      from,
      subject,
      text: message,
      html
    };
  
    // send the email
    const response = await sgMail.send(msg);

    return response[0].statusMessage;
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
    if (!entity.account || !entity.apikey) {
      console.error('entityHandler: did not receive all authorization information');
      return null;
    }

    // retrieve the client
    const client = await getToken(entity);
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
      __url: `https://app.sendgrid.com`,
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
    const token = connectionInfo.apikey;
    if (!token) {
      console.error('getToken: apikey not found');
      return null;
    }
    return token;
  } catch (error) {
    console.log(`getClient: caught exception: ${error}`);
    return null;
  }
}