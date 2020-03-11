// Slack provider

// exports:
//   apis.
//
//   createHandlers(app, [middlewaree]): create all route handlers
// 
//   provider: provider name
//   image: provider image url (local to SPA)
//   type: provider type (simple or link)
//   definition: provider definition

const provider = require('./provider');
const requesthandler = require('../modules/requesthandler');

const providerName = 'slack';

exports.provider = providerName;
exports.image = `/${providerName}-logo.png`;
exports.type = provider.simpleProvider;
exports.definition = provider.getDefinition(providerName);

// api's defined by this provider
exports.apis = {
};

exports.createHandlers = (app) => {
}

exports.invokeAction = async (userId, activeSnapId, param) => {
  const action = param.action;
  const channel = param.channel;
  const message = param.message;

  console.log(`slack: action ${action}, channel ${channel}, message ${message}`);
}