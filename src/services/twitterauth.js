// twitter authentication utilities

// exports:
//   getTwitterAccessInfo(userId): abstracts all logic to retrieve a google access token

const database = require('../data/database');
const auth0 = require('../services/auth0');

exports.getTwitterAccessInfo = async (userId) => {

  const user = await database.getUserData(userId, 'twitter');

  // if an access token is already cached, and not expired, return it
  if (user && user.accessToken && user.accessTokenSecret && user.userId) {
    return user;
  }

  // we don't have a token, or it's already expired; need to 
  // obtain a new one from the management API
  try {
    const profile = await auth0.getAuth0Profile(userId);
    if (!profile) {
      console.log('getTwitterAccessInfo: getAuth0Profile failed');
      return null;
    }
    const info = await getTwitterInfoFromAuth0Profile(userId, profile);
    if (!info) {
      console.log('getTwitterAccessInfo: getTwitterInfoFromAuth0Profile failed');
      return null;
    }

    // return the twitter access info
    return info;
  } catch (error) {
    await error.response;
    console.log(`getTwitterAccessInfo: caught exception: ${error}`);
    return null;
  }
};

// extract twitter access token from auth0 profile information
// this method will cache the userid, access token, and access token secret  
//   userId is the Auth0 userid (key)
//   user is the struct returned from Auth0 management API
const getTwitterInfoFromAuth0Profile = async (userId, user) => {
  try {
    const userIdentity = user && user.identities && 
                         user.identities.find(i => i.provider === 'twitter');
    if (!userIdentity) {
      return null;
    }

    const accessToken = userIdentity.access_token;

    // if no access token, no way to proceed
    if (!accessToken) {
      return null;
    }

    const userData = {
      accessToken: accessToken,
      userId: userIdentity.user_id,
      accessTokenSecret: userIdentity.access_token_secret
    };
    
    // store / cache the user data 
    const mergedUserData = await database.setUserData(
      userId,
      'twitter',
      userData);

    // return the (potentially refreshed) user data
    return mergedUserData;
  } catch (error) {
    await error.response;
    console.log(`getTwitterInfoFromAuth0Profile: caught exception: ${error}`);
    return null;
  }
};

