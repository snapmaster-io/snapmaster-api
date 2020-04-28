// credentials management
// 
// exports:
//   get(userId, name): returns the secret associated with "name"
//   remove(userId, name): removes the secret value under "name"
//   set(userId, name, value): stores the secret value under "name"

const database = require('../data/database');
const dbconstants = require('../data/database-constants');
const secrets = require('../services/secrets');
const CryptoJS = require('crypto-js');

// cache the secret for the snapmaster UserID
var snapmasterSecret;

exports.get = async (userId, name) => {
  try {
    // get the secret
    const secret = await secrets.get(name);
    if (!secret) {
      console.error(`get: could not find secret ${name}`);
      return null;
    }

    // check if the secret was encrypted, based on its name prefix
    if (name.includes(`aes-`)) {
      // check if this is the snapmaster user
      if (userId === dbconstants.snapMasterUserId) {
        // check if caching snapmaster secret key
        if (snapmasterSecret) {
          return decrypt(secret, snapmasterSecret);
        }
      }

      const userKey = await getUserKey(userId);
      if (!userKey) {
        console.error(`get: user key for userId ${userId} not found`);
        return null;
      }

      // get the user secret stored under the user key
      const userSecret = await secrets.get(userKey);

      // if this is the snapmaster userid, cache the snapmaster secret
      if (userId === dbconstants.snapMasterUserId) {
        snapmasterSecret = userSecret;
      }

      // decrypt the secret using the CryptoJS library
      const bytes = CryptoJS.AES.decrypt(secret, userSecret);
      const plaintext = bytes.toString(CryptoJS.enc.Utf8);
      return plaintext;
    }

    // secret was stored in plaintext - return it
    return secret;
  } catch (error) {
    console.error(`get: caught exception: ${error}`);
    return null;
  }
}

exports.remove = async (userId, key) => {
  try {
    const encodedKey = key.replace(/[\:\|]/g, '-');
    await secrets.remove(encodedKey);
  } catch (error) {
    console.error(`remove: caught exception: ${error}`);
    return null;
  }
}

exports.set = async (userId, key, value) => {
  try {
    let userSecret;
    const encodedKey = key.replace(/[\:\|\.]/g, '-');
    let userKey = await getUserKey(userId);

    // if there isn't a user key, create one now
    if (!userKey) {
      userSecret = createRandomKey();
      const encodedUserId = userId.replace(/[\:\|\.]/g, '-');
      userKey = await secrets.set(encodedUserId, userSecret);
      if (userKey) {
        // store the key name in user profile
        setUserKey(userId, userKey);
      }
    } else {
      // retrieve the user secret based on the user key 
      userSecret = await secrets.get(userKey);
    }

    // encrypt the secret value using the user secret
    const encryptedSecret = CryptoJS.AES.encrypt(value, userSecret).toString();

    // prefix the key with "aes-"
    const finalKey = `aes-${encodedKey}`;

    // store the secret and return the key name
    const name = await secrets.set(finalKey, encryptedSecret);
    return name;
  } catch (error) {
    console.error(`set: caught exception: ${error}`);
    return null;
  }
}

const createRandomKey = () => {
  return Math.random().toString(36).replace('0.', '');
}

const decrypt = (secret, key) => {
  // decrypt the secret using the CryptoJS library
  const bytes = CryptoJS.AES.decrypt(secret, key);
  const plaintext = bytes.toString(CryptoJS.enc.Utf8);
  return plaintext;
}

const getProfile = async (userId) => {
  try {
    const profile = await database.getUserData(userId, dbconstants.profile);
    return profile;
  } catch (error) {
    console.log(`getProfile: caught exception: ${error}`);
    return null;
  }
}

const getUserKey = async (userId) => {
  const userProfile = await getProfile(userId);
  if (userProfile.key) {
    return userProfile.key;
  }
}

const setUserKey = async (userId, key) => {
  const userProfile = await getProfile(userId) || {};
  userProfile.key = key;
  storeProfile(userId, userProfile);
}

const storeProfile = async (userId, profile) => {
  try {
    await database.setUserData(userId, dbconstants.profile, profile);
  } catch (error) {
    console.log(`storeProfile: caught exception: ${error}`);
  }
}
