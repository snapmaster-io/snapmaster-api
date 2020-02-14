// twitter provider

// exports:
//   apis.
//        getTweets(userId): get tweet data for the userId (note - userid is ignored in favor of access token)

const axios = require('axios');
const oauthSignature = require('oauth-signature');
const twitterauth = require('../services/twitterauth.js');
const environment = require('../modules/environment');
const twitterConfig = environment.getConfig(environment.twitter);

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

// could never get the Twitter client to work :(
// const Twitter = require('twitter');

exports.apis.getTweets.func = async ([userId]) => {
  try {
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
