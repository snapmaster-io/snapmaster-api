// Azure provider

// exports:
//   apis.
//
//   createHandlers(app, [middlewaree]): create all route handlers
// 
//   name: provider name
//   definition: provider definition

const provider = require('../provider');
const requesthandler = require('../../modules/requesthandler');

const providerName = 'azure';

exports.name = providerName;
exports.definition = provider.getDefinition(providerName);

// api's defined by this provider
exports.apis = {
};

exports.createHandlers = (app) => {
}
