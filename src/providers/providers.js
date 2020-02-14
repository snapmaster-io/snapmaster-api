// provider layer: defines and exports the set of providers
//
// exports:
//   providers {}: a hashmap of all available providers and api's they expose

// import providers
const google = require('./google');
const facebook = require('./facebook');
const twitter = require('./twitter');
const yelp = require('./yelp');

exports.providers = {
  'google-oauth2': google.apis,
  'facebook': facebook.apis,
  'twitter': twitter.apis,
  'yelp': yelp.apis
}
