// auth0 management API utility functions

// exports:
// getAuth0Profile(userId): abstracts all logic to retrieve Auth0 profile for a user
// getManagementAPIAccessToken(): get Auth0 management API access token
// linkAccounts(): link a primary and a secondary account
// unlinkAccounts(): unlink a primary and a secondary account

const axios = require('axios');
const database = require('../data/database');
const environment = require('../modules/environment');
const auth0Config = environment.getConfig(environment.auth0);

// get a user's Auth0 profile from the management API
exports.getAuth0Profile = async (userId) => {
  try {
    const managementToken = await exports.getManagementAPIAccessToken();
    if (!managementToken) {
      console.log('getAuth0Profile: getManagementAPIAccessToken failed');
      return null;
    }
    
    const result = await getAuth0ProfileInfo(userId, managementToken);
    if (!result) {
      console.log('getAuth0Profile: getAuth0ProfileInfo failed');
      return null;
    }
    // return the profile 
    return result;
  } catch (error) {
    await error.response;
    console.log(`getAuth0Profile: caught exception: ${error}`);
    return null;
  }
};

// get a management API access token
exports.getManagementAPIAccessToken = async () => {
  try {
    const url = `https://${auth0Config.domain}/oauth/token`;
    const headers = { 'content-type': 'application/json' };
    const body = { 
      client_id: auth0Config.client_id,
      client_secret: auth0Config.client_secret,
      audience: `https://${auth0Config.domain}/api/v2/`,
      grant_type: 'client_credentials'
    };

    const response = await axios.post(
      url,
      body,
      {
        headers: headers
      });
    const data = response.data;
    if (data && data.access_token) {
      return data.access_token;
    }
    return null;
  } catch (error) {
    await error.response;
    console.log(`getManagementAPIAccessToken: caught exception: ${error}`);
    return null;
  }
};

// link a primary and secondary account
exports.linkAccounts = async (primaryUserId, secondaryUserId) => {
  try {
    const managementToken = await exports.getManagementAPIAccessToken();
    if (!managementToken) {
      console.log('linkAccounts: getManagementAPIAccessToken failed');
      return null;
    }

    // get provider|userId out of compound userId passed in
    [provider, userId] = secondaryUserId.split('|');

    const url = `https://${auth0Config.domain}/api/v2/users/${primaryUserId}/identities`;
    const headers = { 
      'content-type': 'application/json',
      'authorization': `Bearer ${managementToken}`      
    };
    const body = { 
      provider: provider,
      user_id: userId
    };

    const response = await axios.post(
      url,
      body,
      {
        headers: headers
      });
    const data = response.data;

    // add a provider section to the user data with the secondary userid
    await database.setUserData(primaryUserId, provider, { userId: userId });

    // return data;  // this will leak credentials!
    return { message: 'success' };
  } catch (error) {
    await error.response;
    console.log(`linkAccounts: caught exception: ${error}`);
    return null;
  }
};

// unlink a primary and secondary account
exports.unlinkAccounts = async (primaryUserId, secondaryUserId) => {
  try {
    const managementToken = await exports.getManagementAPIAccessToken();
    if (!managementToken) {
      console.log('linkAccounts: getManagementAPIAccessToken failed');
      return null;
    }

    // get provider|userId out of compound userId passed in
    [provider, userId] = secondaryUserId.split('|');

    const url = `https://${auth0Config.domain}/api/v2/users/${primaryUserId}/identities/${provider}/${userId}`;
    const headers = { 
      'content-type': 'application/json',
      'authorization': `Bearer ${managementToken}`      
    };

    const response = await axios.delete(
      url,
      {
        headers: headers
      });
    const data = response.data;

    // remove the unlinked connection from the user store
    await database.removeConnection(primaryUserId, provider);

    // return data;  // this will leak credentials!
    return { message: 'success' };
  } catch (error) {
    await error.response;
    console.log(`unlinkAccounts: caught exception: ${error}`);
    return null;
  }
};

// get Auth0 profile information for a specific userId, using the mgmt API token
const getAuth0ProfileInfo = async (userId, managementToken) => {
  try {
    const url = encodeURI(`https://${auth0Config.domain}/api/v2/users/${userId}`);
    const headers = { 
      'content-type': 'application/json',
      'authorization': `Bearer ${managementToken}`
    };

    const response = await axios.get(
      url,
      {
        headers: headers
      });
    return response.data;
  } catch (error) {
    await error.response;
    console.log(`getAuth0ProfileInfo: caught exception: ${error}`);
    return null;
  }
};

