// google authentication utilities
// 
// exports:
//   getGoogleAccessInfo(userId): abstracts all logic to retrieve all google access information (token and API key)
//   getGoogleAccessToken(userId): abstracts all logic to retrieve a google access token
//   validateJwt(token): validate bearer token provided by google cloud

const axios = require('axios');
const database = require('../data/database');
const auth0 = require('../services/auth0');
const environment = require('../modules/environment');
const config = require('../modules/config');

const { OAuth2Client } = require('google-auth-library');
const authClient = new OAuth2Client();

exports.getGoogleAccessInfo = async (userId) => {

  const user = await database.getUserData(userId, 'google-oauth2');

  // if an access token is already cached, and not expired, return it
  if (user && !database.tokenExpired(user)) {
    return user;
  }

  // we don't have a token, or it's already expired; need to 
  // obtain a new one from the management API
  try {
    const profile = await auth0.getAuth0Profile(userId);
    if (!profile) {
      console.log('getGoogleAccessInfo: getAuth0Profile failed');
      return null;
    }
    const userInfo = await getGoogleInfoFromAuth0Profile(userId, profile);
    if (!userInfo) {
      console.log('getGoogleAccessInfo: getGoogleInfoFromAuth0Profile failed');
      return null;
    }

    // return the google access token
    return userInfo;
  } catch (error) {
    await error.response;
    console.log(`getGoogleAccessInfo: caught exception: ${error}`);
    return null;
  }
}

exports.getGoogleAccessToken = async (userId) => {
  const userInfo = await exports.getGoogleAccessInfo(userId);
  return userInfo && userInfo.accessToken;
}

exports.validateJwt = async (token) => {
  try {
    await authClient.verifyIdToken({
      idToken: token,
      audience: `${environment.getEndpoint()}/invoke`,
    });

    // if the call succeeds, validation passed
    return true;
  } catch (error) {
    console.log(`validateJwt: caught exception: ${error}`);
    return false;
  }
}

// extract google access token from auth0 profile information
// this method will cache the access token, check for expiration, and refresh it if 
// necessary
//   userId is the Auth0 userid (key)
//   user is the struct returned from Auth0 management API
const getGoogleInfoFromAuth0Profile = async (userId, user) => {
  try {
    const userIdentity = user && user.identities && 
                         user.identities.find(i => i.provider === 'google-oauth2');
    if (!userIdentity) {
      return null;
    }

    var accessToken = userIdentity.access_token;
    const refreshToken = userIdentity.refresh_token; // could be empty
    const timestamp = user.updated_at;
    const expiresIn = userIdentity.expires_in;

    // if no access token, no way to proceed
    if (!accessToken) {
      return null;
    }

    const userData = {
      accessToken: accessToken,
      userId: userIdentity.user_id
    };

    // store / overwrite expiration if passed in
    if (timestamp && expiresIn) {
      // compute the expiration timestamp
      const ts = new Date(timestamp);
      ts.setSeconds(ts.getSeconds() + expiresIn);
      userData.expiresAt = ts.getTime();
    }
    
    // store / overwrite refresh token if passed in
    if (refreshToken) {
      userData.refreshToken = refreshToken;
    }
    
    // store / cache the newly retrieved user data 
    const thisUser = await database.setUserData(
      userId,
      'google-oauth2',
      userData);

    // check for token expiration
    if (database.tokenExpired(thisUser)) {
      accessToken = null;

      // get a new access token using the refresh token
      if (thisUser.refreshToken) {
        accessToken = await getAccessTokenForGoogleRefreshToken(userId, thisUser.refreshToken);
      } 
    }

    // if couldn't obtain a valid access token, return null
    if (!accessToken) {
      return null;
    }

    // replace the access token in the user data
    // we don't save it because we don't receive expiration info from google for the new access token...
    thisUser.accessToken = accessToken;

    // return the user info containing the (potentially refreshed) access token
    return thisUser;
  } catch (error) {
    await error.response;
    console.log(`getGoogleTokenFromAuth0Profile: caught exception: ${error}`);
    return null;
  }
}

// retrieve an access token from a refresh token, and cache the resulting 
// access token for that userId
const getAccessTokenForGoogleRefreshToken = async(userId, refreshToken) => {
  try {
    const googleConfig = config.getConfig(config.google);
    const url = 'https://www.googleapis.com/oauth2/v4/token';
    const headers = { 
      'content-type': 'application/json',
    };
    const body = {
      client_id: googleConfig.google_client_id,
      client_secret: googleConfig.google_client_secret,
      refresh_token: refreshToken,
      grant_type: 'refresh_token'
    }

    const response = await axios.post(
      url,
      body,
      {
        headers: headers
      },
    );
    const data = response.data;
    const accessToken = data && data.access_token;
    if (!accessToken) {
      return null;
    }

    const userData = {
      accessToken: accessToken
    };

    // compute the expiration timestamp
    const ts = new Date();
    ts.setSeconds(ts.getSeconds() + data.expires_in);
    userData.expiresAt = ts.getTime();
        
    // store / cache the user data 
    const thisUser = await database.setUserData(
      userId,
      'google-oauth2',
      userData);

    return accessToken;
  } catch (error) {
    await error.response;
    console.log(`getAccessTokenForGoogleRefreshToken: caught exception: ${error}`);
    return null;
  }
}
