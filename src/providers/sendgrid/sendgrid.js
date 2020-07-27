// Sendgrid provider

// exports:
//   createHandlers(app): create all route handlers
//   invokeAction(providerName, connectionInfo, activeSnapId, param): invoke an action
// 
//   entities.
//        accounts - the accounts entity
// 
//   name: provider name
//   definition: provider definition

const sgMail = require('@sendgrid/mail');
const provider = require('../provider');
const { successvalue, errorvalue } = require('../../modules/returnvalue');

const providerName = 'sendgrid';
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
    const subject = param.subject;
    if (!subject) {
      const message = `missing required parameter "subject"`;
      console.error(`invokeAction: ${message}`);
      return errorvalue(message);
    }
    const message = param.message;
    if (!message) {
      const message = `missing required parameter "message"`;
      console.error(`invokeAction: ${message}`);
      return errorvalue(message);
    }
    let html = param.html;

    if (action !== 'send') {
      const message = `unknown action "${action}"`;
      console.error(`invokeAction: ${message}`);
      return errorvalue(message);
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

    return successvalue(response && response.length && response[0].statusMessage);
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