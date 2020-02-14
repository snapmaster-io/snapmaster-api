// facebook provider

// exports:
//   apis.
//        getPages(userId): get pages that the userid has access to
//        getPageReviews(pageId, accessToken): get page reviews

// never quite got the bizSdk up and running
//const bizSdk = require('facebook-nodejs-business-sdk');

const axios = require('axios');
const facebookauth = require('../services/facebookauth.js');

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

