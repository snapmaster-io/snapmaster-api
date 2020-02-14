// google provider

// exports:
//   apis.
//        getCalendarData(userId): get calendar data for the userId
//        getGoogleLocations(userId): get google mybusiness location data

const axios = require('axios');
const googleauth = require('../services/googleauth.js');

// api's defined by this provider
// the actual function is added after it is defined below
exports.apis = {
  placeholder: {
    name: 'placeholder',
    provider: 'google-oauth2',
    entity: 'google-oauth2:placeholder',
    arrayKey: 'items',
    itemKey: 'id'
  },
  getCalendarData: {
    name: 'getCalendarData',
    provider: 'google-oauth2',
    entity: 'google-oauth2:calendars',
    arrayKey: 'items',
    itemKey: 'id'
  },
  getGoogleLocations: {
    name: 'getGoogleLocation',
    provider: 'google-oauth2',
  },
};

exports.apis.placeholder.func = async ([userId]) => {
  try {
    // the placeholder API just serves to go through the access token mechanics
    const accessToken = await googleauth.getGoogleAccessToken(userId);
    if (!accessToken) {
      console.log('placeholder: getGoogleAccessToken failed');
      return null;
    }

    return null;
  } catch (error) {
    await error.response;
    console.log(`placeholder: caught exception: ${error}`);
    return null;
  }
};

exports.apis.getCalendarData.func = async ([userId]) => {
  try {
    const accessToken = await googleauth.getGoogleAccessToken(userId);
    if (!accessToken) {
      console.log('getCalendarData: getGoogleAccessToken failed');
      return null;
    }

    const url = 'https://www.googleapis.com/calendar/v3/users/me/calendarList';
    //const url = 'https://www.google.com/m8/feeds/contacts/ogazitt%40gmail.com/full';
    const headers = { 
      'content-type': 'application/json',
      'authorization': `Bearer ${accessToken}`
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
    console.log(`getCalendarData: caught exception: ${error}`);
    return null;
  }
};

exports.apis.getGoogleLocations.func = async ([userId]) => {
  try {
    const accessToken = await googleauth.getGoogleAccessToken(userId);
    if (!accessToken) {
      console.log('getGoogleLocations: getGoogleAccessToken failed');
      return null;
    }

    const url = 'https://mybusiness.googleapis.com/v4/googleLocations:search';
    const headers = { 
      'content-type': 'application/json',
      'authorization': `Bearer ${accessToken}`
    };
    const body = {
      resultCount: 10,
      search_query: 'fatburger'
    }

    const response = await axios.post(
      url,
      body,
      {
        headers: headers
      },
    );

    // response received successfully
    console.log(`getGoogleLocations data: ${response.data}`);
    return response.data;
  } catch (error) {
    await error.response;
    console.log(`getGoogleLocations: caught exception: ${error}`);
    return null;
  }
};

