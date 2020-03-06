// github authentication utilities
// 
// exports:
//   getGithubAccessInfo(userId): abstracts all logic to retrieve a FB access token / userid

const database = require('../data/database');
const auth0 = require('../services/auth0');

exports.getGithubAccessInfo = async (userId) => {

  const user = await database.getUserData(userId, 'github');

  // if an access token and userid are already cached, return the user info
  if (user && user.accessToken && user.userId) {
    return user;
  }

  // we don't have a token; need to obtain a new one from the management API
  try {
    const profile = await auth0.getAuth0Profile(userId);
    if (!profile) {
      console.log('getGithubAccessInfo: getAuth0Profile failed');
      return null;
    }
    const info = await getGithubInfoFromAuth0Profile(userId, profile);
    if (!info) {
      console.log('getGithubAccessInfo: getGithubInfoFromAuth0Profile failed');
      return null;
    }

    // return the github access info
    return info;
  } catch (error) {
    await error.response;
    console.log(`getGithubAccessInfo: caught exception: ${error}`);
    return null;
  }
};

// extract github access token from auth0 profile information
// this method will cache the access token, check for expiration, and refresh it if 
// necessary
//   userId is the Auth0 userid (key)
//   user is the struct returned from Auth0 management API
const getGithubInfoFromAuth0Profile = async (userId, user) => {
  try {
    const userIdentity = user && user.identities && 
                         user.identities.find(i => i.provider === 'github');
    if (!userIdentity) {
      return null;
    }

    var accessToken = userIdentity.access_token;

    // if no access token, no way to proceed
    if (!accessToken) {
      return null;
    }

    // store / cache the access token 
    const mergedUserData = await database.setUserData(
      userId,
      'github',
      { 
        accessToken: accessToken,
        userId: userIdentity.user_id
      });

    // HACK: return the current user info without obtaining long-lived token
    return mergedUserData;
  } catch (error) {
    await error.response;
    console.log(`getGithubInfoFromAuth0Profile: caught exception: ${error}`);
    return null;
  }
};

