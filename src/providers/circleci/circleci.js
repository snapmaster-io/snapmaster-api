// CircleCI provider

// exports:
//   apis.
//
//   createHandlers(app, [middlewaree]): create all route handlers
// 
//   provider: provider name
//   image: provider image url (local to SPA)
//   type: provider type (simple or link)
//   definition: provider definition

const provider = require('../provider');
const requesthandler = require('../../modules/requesthandler');

const providerName = 'circleci';

exports.provider = providerName;
exports.image = `/${providerName}-logo.png`;
exports.definition = provider.getDefinition(providerName);
exports.type = exports.definition.connection && exports.definition.connection.type;

// api's defined by this provider
exports.apis = {
};

exports.createHandlers = (app) => {
}
