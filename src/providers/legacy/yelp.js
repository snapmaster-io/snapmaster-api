// yelp provider

// exports:
//   apis.
//        addBusiness([phone]): ad business to business listbased on a phone number
//        getBusinesses(): get businesses for this userId
//        getReviews([businessId]): get review data for the business ID
//        removeBusiness([userId, businessId]): remove this business ID from the list of businesses
//
//   createHandlers(app, [middlewaree]): create all route handlers
// 
//   provider: provider name
//   image: provider image url (local to SPA)
//   type: provider type (simple or link)
//   definition: provider definition

const axios = require('axios');
const provider = require('../provider');
const requesthandler = require('../../modules/requesthandler');
const config = require('../../modules/config');
const yelpConfig = config.getConfig(config.yelp);
const database = require('../../data/database.js');

const providerName = 'yelp';

exports.provider = providerName;
exports.image = `/${providerName}-logo.jpg`;
exports.type = provider.simpleProvider;
//exports.definition = provider.getDefinition(providerName);

// api's defined by this provider
exports.apis = {
  addBusiness: {
    name: 'addBusiness',
    provider: 'yelp',
    entity: 'yelp:businesses',
    arrayKey: 'businesses',
    itemKey: 'id'
  },
  getBusinesses: {
    name: 'getBusinesses',
    provider: 'yelp',
    entity: 'yelp:businesses',
    arrayKey: null,
    itemKey: 'id'
  },
  getReviews: {
    name: 'getReviews',
    provider: 'yelp',
    arrayKey: 'reviews',
    itemKey: 'id',
    ratingField: 'rating',
    sentimentTextField: 'text',
    textField: 'text'
  },
  removeBusiness: {
    name: 'removeBusiness',
    provider: 'yelp',
    entity: 'yelp:businesses',
    itemKey: 'id'
  },
};

exports.createHandlers = (app) => {
  // Get yelp api data endpoint - returns list of businesses
  app.get('/yelp', requesthandler.checkJwt, requesthandler.processUser, function(req, res){
    requesthandler.invokeProvider(
      res, 
      req.userId, 
      exports.apis.getBusinesses, 
      null,     // use the default entity name
      [req.userId]); // parameter array
  });

  // Get yelp api data endpoint
  app.get('/yelp/reviews/:businessId', requesthandler.checkJwt, requesthandler.processUser, function(req, res){
    const businessId = req.params.businessId;
    const refresh = req.query.refresh || false;
    requesthandler.getData(
      res, 
      req.userId, 
      exports.apis.getReviews, 
      `yelp:${businessId}`,  // entity name must be constructed dynamically
      [businessId], // parameter array
      refresh);
  });

  // Post yelp reviews API - takes a business id as a parameter,
  // and multiple review ids in the body, and associates metadata with them
  // Data payload format:
  //     [
  //       { id: key1, meta1: value1, meta2: value2, ... },
  //       { id: key2, meta1: value1, meta2: value2, ... },
  //     ]
  app.post('/yelp/reviews/:businessId', requesthandler.checkJwt, requesthandler.processUser, function (req, res){
    const businessId = req.params.businessId;
    requesthandler.storeMetadata(
      res,
      req.userId,
      exports.apis.getReviews,
      `yelp:${businessId}`,
      req.body);
  });

  // Post yelp business API - adds or removes a business
  app.post('/yelp', requesthandler.checkJwt, requesthandler.processUser, function (req, res){
    const action = req.body && req.body.action;

    const add = async () => {
      requesthandler.invokeProvider(
        res, 
        req.userId, 
        exports.apis.addBusiness, 
        null,     // use the default entity name
        [req.body.phone]); // parameter array
    }

    const remove = async () => {
      requesthandler.invokeProvider(
        res, 
        req.userId, 
        exports.apis.removeBusiness, 
        null,     // use the default entity name
        [req.userId, req.body.businessId]); // parameter array
    }

    if (action === 'add' && req.body && req.body.phone) {
      add();
      return;
    }

    if (action === 'remove' && req.body && req.body.businessId) {
      remove();
      return;
    }

    res.status(200).send({ message: 'Unknown action'}); 
  });
}

exports.apis.addBusiness.func = async ([phone]) => {
  try {
    const normalizedPhoneNumber = normalize(phone);
    const url = `https://api.yelp.com/v3/businesses/search/phone?phone=${normalizedPhoneNumber}`;
    const headers = { 
      'content-type': 'application/json',
      'authorization': `Bearer ${yelpConfig.api_key}`
     };

    const response = await axios.get(
      url,
      {
        headers: headers
      });
    
    // if the API found a business with this phone number return it
    if (response.data && response.data.businesses && response.data.businesses.length) {
      return response.data;
    }
    
    // return null if the business was not found
    return null;
  } catch (error) {
    await error.response;
    console.log(`addBusiness: caught exception: ${error}`);
    return null;
  }
};

exports.apis.getBusinesses.func = async () => {
  // this is a no-op - invokeProvider does the work to return the yelp:businsses entity
  return [];
};

exports.apis.getReviews.func = async ([businessId]) => {
  try {
    const url = `https://api.yelp.com/v3/businesses/${businessId}/reviews`;
    const headers = { 
      'content-type': 'application/json',
      'authorization': `Bearer ${yelpConfig.api_key}`
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
    console.log(`getReviews: caught exception: ${error}`);
    return null;
  }
};

exports.apis.removeBusiness.func = async ([userId, businessId]) => {
  try {
    // remove the document from the businesses collection
    await database.removeDocument(userId, 'yelp:businesses', businessId);

    // invokeProvider will re-read the yelp:businesses collection and return it
    return [];
  } catch (error) {
    await error.response;
    console.log(`removeBusiness: caught exception: ${error}`);
    return null;
  }
};

const normalize = (phone) => {
  // remove any punctuation (hyphens, dots, parens)
  phone = phone.replace(/[- .()]/g, "");

  // if this is an american business phone number of length 10, add a "+1" in front of it
  if (phone.length === 10) {
    phone = `+1${phone}`;
  }

  return phone;
}