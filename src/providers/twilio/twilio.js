// Twilio provider

// exports:
//   apis.
//
//   createHandlers(app): create all route handlers
//   invokeAction(providerName, connectionInfo, activeSnapId, param): invoke an action
// 
//   provider: provider name
//   image: provider image url (local to SPA)
//   type: provider type (simple or link)
//   definition: provider definition

const Twilio = require('twilio'); 
const provider = require('../provider');

const providerName = 'twilio';

exports.provider = providerName;
exports.image = `/${providerName}-logo.png`;
exports.type = provider.simpleProvider;
exports.definition = provider.getDefinition(providerName);

// api's defined by this provider
exports.apis = {
};

exports.createHandlers = (app) => {
}

exports.invokeAction = async (providerName, connectionInfo, activeSnapId, param) => {
  try {
    const action = param.action;
    const to = param.to;
    const message = param.message;
    const from = param.from;
    const mediaUrl = param.mediaUrl || 'https://github.com/snapmaster-io/snapmaster/raw/master/public/SnapMaster-logo-220.png';

    console.log(`${providerName}: action ${action}, to ${to}, message ${message}`);

    if (!action || !to || !from || !message) {
      console.error('invokeAction: missing required parameter');
      return null;
    }

    // get token for calling API
    const client = await getClient(connectionInfo);
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
    return output;
  } catch (error) {
    console.log(`invokeAction: caught exception: ${error}`);
    return null;
  }  
}

const getClient = async (connectionInfo) => {
  try {
    const account = connectionInfo.find(p => p.name === 'account');
    const token = connectionInfo.find(p => p.name === 'token');

    if (!account || !token) {
      return null;
    }

    const client = new Twilio(account.value, token.value);
    return client;
  } catch (error) {
    console.log(`getClient: caught exception: ${error}`);
    return null;
  }
}