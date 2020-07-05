// facebook provider

// exports:
//   apis.
//        getPages(userId): get pages that the userid has access to
//        getPageReviews(pageId, accessToken): get page reviews
// 
//   createHandlers(app, [middlewaree]): create all route handlers
//
//   name: provider name
//   type: provider type (simple or link)
//   definition: provider definition

// never quite got the bizSdk up and running
//const bizSdk = require('facebook-nodejs-business-sdk');

const axios = require('axios');
const facebookauth = require('../../services/facebookauth.js');
const requesthandler = require('../../modules/requesthandler');

const providerName = 'facebook';

exports.name = providerName;
exports.type = 'link';
//exports.definition = provider.getDefinition(providerName);

// api's defined by this provider
exports.apis = {
  getPages: {
    name: 'getPages',
    provider: 'facebook',
    entity: 'facebook:pages',
    arrayKey: 'data',
    itemKey: 'id'
  },
  getPageReviews: {
    name: 'getPageReviews',
    provider: 'facebook',
    arrayKey: 'data',
    itemKey: 'created_time',
    sentimentField: 'recommendation_type',
    textField: 'review_text'
  },
};

exports.createHandlers = (app) => {
  // Get facebook api data endpoint
  app.get('/facebook', requesthandler.checkJwt, requesthandler.processUser, function(req, res){
    const refresh = req.query.refresh || false;
    requesthandler.getData(
      res, 
      req.userId, 
      exports.apis.getPages, 
      null,     // default entity name
      [req.userId], // parameter array
      refresh);
  });

  // Get facebook api data endpoint
  app.get('/facebook/reviews/:pageId', requesthandler.checkJwt, requesthandler.processUser, function(req, res){
    const pageId = req.params.pageId;
    const refresh = req.query.refresh || false;
    const accessToken = req.headers.token;
    requesthandler.getData(
      res, 
      req.userId, 
      exports.apis.getPageReviews, 
      `facebook:${pageId}`,  // entity name must be constructed dynamically
      [pageId, accessToken], // parameter array
      refresh);
  });

  // Post facebook reviews API - takes a page id as a parameter,
  // and multiple review ids in the body, and associates metadata with them
  // Data payload format:
  //     [
  //       { id: key1, meta1: value1, meta2: value2, ... },
  //       { id: key2, meta1: value1, meta2: value2, ... },
  //     ]
  app.post('/facebook/reviews/:pageId', requesthandler.checkJwt, requesthandler.processUser, function (req, res){
    const pageId = req.params.pageId;
    requesthandler.storeMetadata(
      res,
      req.userId,
      exports.apis.getPageReviews,
      `facebook:${pageId}`,
      req.body);
  });
}

exports.apis.getPages.func = async ([userId]) => {
  try {
    const user = await facebookauth.getFacebookAccessInfo(userId);
    const fb_userid = user && user.userId;
    const accessToken = user && user.accessToken;

    if (!accessToken || !fb_userid) {
      console.log('getPagesData: getFacebookAccessToken failed');
      return null;
    }

    const url = `https://graph.facebook.com/${fb_userid}/accounts?access_token=${accessToken}`;
    const headers = { 
      'content-type': 'application/json'
     };

    const response = await axios.get(
      url,
      {
        headers: headers
      });

      // response received successfully
    return response.data;
  } catch (error) {
    await error.response;
    console.log(`getPagesData: caught exception: ${error}`);
    return null;
  }
};

exports.apis.getPageReviews.func = async ([pageId, accessToken]) => {
  try {
    const url = `https://graph.facebook.com/v5.0/${pageId}/ratings?access_token=${accessToken}`;
    const headers = { 
      'content-type': 'application/json'
     };

    const response = await axios.get(
      url,
      {
        headers: headers
      });

      // response received successfully
    return response.data;
  } catch (error) {
    await error.response;
    console.log(`getPagesData: caught exception: ${error}`);
    return null;
  }
};

