// provider layer: defines and exports the set of providers
//
// exports:
//   providers {}: a hashmap of all available providers and api's they expose
//   createHandlers(app, middleware): invokes the createHandlers function in each of the registered providers
//   providerDefinitions(): returns an array of all the provider definitions

// import providers
const aws = require('./aws');
const azure = require('./azure');
const circleci = require('./circleci');
const gcp = require('./gcp');
const github = require('./github');
const gitlab = require('./gitlab');
const slack = require('./slack');

// current list of supported providers
const providerList = [aws, azure, circleci, gcp, github, gitlab, slack];

// legacy providers
const google = require('./google');
const facebook = require('./facebook');
const twitter = require('./twitter');
const yelp = require('./yelp');

exports.providers = {
  'github': github.apis,
  'google-oauth2': google.apis,
  'facebook': facebook.apis,
  'twitter': twitter.apis,
  'yelp': yelp.apis
}

exports.createHandlers = (app) => {
  for (const provider of providerList) {
    provider.createHandlers(app);
  }
}

exports.providerDefinitions = () => {
  return providerList.map(provider => {
    return {
      provider: provider.provider,
      image: provider.image,
      type: provider.type,
      definition: provider.definition
    }
  });
}

