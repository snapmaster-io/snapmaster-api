// twitter provider

// exports:
//   apis.
//        getTweets(userId): get tweet data for the userId (note - userid is ignored in favor of access token)
//
//   createHandlers(app, [middlewaree]): create all route handlers
// 
//   provider: provider name
//   image: provider image url (local to SPA)
//   type: provider type (simple or link)
//   definition: provider definition

const axios = require('axios');
const oauthSignature = require('oauth-signature');
const twitterauth = require('../../services/twitterauth.js');
const provider = require('../provider');
const requesthandler = require('../../modules/requesthandler');
const config = require('../../modules/config');

// could never get the Twitter client to work :(
// const Twitter = require('twitter');

const providerName = 'twitter';

exports.provider = providerName;
exports.image = `/${providerName}-logo.jpg`;
exports.type = provider.linkProvider;
//exports.definition = provider.getDefinition(providerName);

// api's defined by this provider
exports.apis = {
  getTweets: {
    name: 'getTweets',
    provider: 'twitter',
    entity: 'twitter:mentions',
    arrayKey: null,
    itemKey: 'id_str',
    sentimentTextField: 'text',
    textField: 'text'
  },
};

exports.createHandlers = (app) => {
  // Get twitter api data endpoint
  app.get('/twitter', requesthandler.checkJwt, requesthandler.processUser, function(req, res){
    const refresh = req.query.refresh || false;
    requesthandler.getData(
      res, 
      req.userId, 
      exports.apis.getTweets, 
      null,     // default entity name
      [req.userId], // parameter array
      refresh);
  });

  // Post twitter mentions API - takes multiple tweet ids in the body and 
  // associates metadata with them
  // Data payload format:
  //     [
  //       { id: key1, meta1: value1, meta2: value2, ... },
  //       { id: key2, meta1: value1, meta2: value2, ... },
  //     ]
  app.post('/twitter/mentions', requesthandler.checkJwt, requesthandler.processUser, function (req, res){
    requesthandler.storeMetadata(
      res,
      req.userId,
      exports.apis.getTweets,
      null,     // default entity name
      req.body);
  });

  // Post twitter mentions API - takes a tweet id as a parameter,
  // and associates the metdata found in the body 
  // Data payload format:
  //   { meta1: value1, meta2: value2, ... }
  app.post('/twitter/mentions/:tweetId', requesthandler.checkJwt, requesthandler.processUser, function (req, res){
    // construct the metadata array in the expected format
    const metadataArray = [{ ...req.body, id: tweetId }];
    requesthandler.storeMetadata(
      res,
      req.userId,
      exports.apis.getTweets,
      metadataArray); 
  });
}

exports.apis.getTweets.func = async ([userId]) => {
  try {
    const twitterConfig = config.getConfig(config.twitter);

    const user = await twitterauth.getTwitterAccessInfo(userId);
    if (!user) {
      console.log('getTweets: getTwitterAccessInfo failed');
      return null;
    }

    /* couldn't get the twitter javascript client to work :(
    const twitter = new Twitter({
      consumerKey: twitterConfig.twitter_consumer_key,
      consumerSecret: twitterConfig.twitter_consumer_secret,
      access_token_key: user.accessToken,
      access_token_secrets: user.accessTokenSecret});        
      
    const response = await twitter.get('statuses/mentions_timeline', {});
    return response.data;
    */

    const httpMethod = 'GET',
    d = new Date(),
    timestamp = Math.round(d.getTime() / 1000),
    //url = 'https://api.twitter.com/1.1/statuses/mentions_timeline.json?count=5',
    url = 'https://api.twitter.com/1.1/statuses/mentions_timeline.json',
    parameters = {
      oauth_consumer_key: twitterConfig.twitter_consumer_key,
      oauth_nonce: 'B1R6tk7SguJ', // BUGBUG: generate new nonce
      oauth_signature_method: 'HMAC-SHA1',
      oauth_timestamp: timestamp,
      oauth_token: user.accessToken,
      oauth_version: '1.0',
      //count: '5'
    },
    consumerSecret = twitterConfig.twitter_consumer_secret,
    tokenSecret = user.accessTokenSecret,
    // generates a RFC 3986 encoded, BASE64 encoded HMAC-SHA1 hash
    encodedSignature = oauthSignature.generate(httpMethod, url, parameters, consumerSecret, tokenSecret),
    // generates a BASE64 encode HMAC-SHA1 hash
    signature = oauthSignature.generate(httpMethod, url, parameters, consumerSecret, tokenSecret,
        { encodeSignature: false});        
        
    // construct authorization header - very order-dependent!
    const headers = { 
      'content-type': 'application/json',
      'authorization': `OAuth oauth_consumer_key="${twitterConfig.twitter_consumer_key}",oauth_token="${user.accessToken}",oauth_signature_method="HMAC-SHA1",oauth_timestamp="${timestamp}",oauth_nonce="B1R6tk7SguJ",oauth_version="1.0",oauth_signature="${encodedSignature}"`
      // 'authorization': `Bearer ${user}`
     };

    const response = await axios.get(
      url,
      {
        headers: headers
      });

    // do some processing on the results, to remove arrays within arrays
    // the latter breaks the firestore data model
    response.data.forEach(element => {
      if (element.place && element.place.bounding_box) {
        element.place.bounding_box = null;
      }
    });

    // response received successfully
    return response.data;
  } catch (error) {
    await error.response;
    console.log(`getTweets: caught exception: ${error}`);
    return null;
  }
};
