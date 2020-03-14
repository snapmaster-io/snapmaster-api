// provider layer: defines and exports the set of providers
//
// exports:
//   providers {}: a hashmap of all available providers and api's they expose
//   createHandlers(app, middleware): invokes the createHandlers function in each of the registered providers
//   getProvider(providerName): returns the provider named providerName
//   providerDefinitions(): returns an array of all the provider definitions

// import providers
const providerNames = [
  'aws',
  'azure', 
  'circleci', 
  'docker', 
  'gcp', 
  'github', 
  'gitlab', 
  'pagerduty', 
  'slack', 
  'twilio'
];

const providerList = providerNames.map(p => {
  const providerFile = `./${p}/${p}`;
  const providerObject = require(providerFile);
  return providerObject;
});

// current list of supported providers
//const providerList = [aws, azure, circleci, gcp, github, gitlab, slack];

// legacy providers
const google = require('./legacy/google');
const facebook = require('./legacy/facebook');
const twitter = require('./legacy/twitter');
const yelp = require('./legacy/yelp');

exports.providers = {
//  'github': github.apis,
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

exports.getProvider = (providerName) => {
  const provider = providerList.find(p => p.provider === providerName);
  return provider;
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

