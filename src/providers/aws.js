// AWS provider

// exports:
//   apis.

//   provider: provider name
//   image: provider image url (local to SPA)
//   type: provider type (simple or link)
//   definition: provider definition

const provider = require('./provider');

const providerName = 'aws';

exports.provider = providerName;
exports.image = `/${providerName}-logo.jpg`;
exports.type = provider.simpleProvider;
exports.definition = provider.getDefinition(providerName);

// api's defined by this provider
exports.apis = {
};
