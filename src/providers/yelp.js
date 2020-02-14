// yelp provider

// exports:
//   apis.
//        addBusiness([phone]): ad business to business listbased on a phone number
//        getBusinesses(): get businesses for this userId
//        getReviews([businessId]): get review data for the business ID
//        removeBusiness([userId, businessId]): remove this business ID from the list of businesses

const axios = require('axios');
const environment = require('../modules/environment');
const yelpConfig = environment.getConfig(environment.yelp);
const database = require('../data/database.js');

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