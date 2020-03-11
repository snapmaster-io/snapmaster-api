// user profile management

// exports:
//   createHandlers(app): create handlers for GET and POST endpoints

const database = require('../data/database');
const dbconstants = require('../data/database-constants');
const auth0 = require('../services/auth0');
const requesthandler = require('./requesthandler');

exports.notifyEmail = 'notifyEmail';
exports.notifySms = 'notifySms';
exports.negativeFeedback = 'negativeFeedback';
exports.allFeedback = 'allFeedback';
exports.noFeedback = 'none';

exports.createHandlers = (app) => {
  // Get profile API endpoint
  app.get('/profile', requesthandler.checkJwt, requesthandler.processUser, function(req, res){
    const returnProfile = async () => {
      // retrieve the profile data from the app and from auth0 
      const appProfile = await getProfile(req.userId) || {};
      const auth0profile = await auth0.getAuth0Profile(req.userId);

      // create a consolidated profile with app data overwriting auth0 data
      const fullProfile = {...auth0profile, ...appProfile};

      // ensure the [identities] come fresh from auth0 
      if (auth0profile && auth0profile.identities) {
        fullProfile.identities = auth0profile.identities;
      }
      res.status(200).send(fullProfile);
    }
    returnProfile();
  });

  // Post profile API endpoint
  app.post('/profile', requesthandler.checkJwt, requesthandler.processUser, function(req, res){
    const store = async () => {
      await storeProfile(req.userId, req.body);
      res.status(200).send({ message: 'success' });
    }
    store();
  });

}
// retrieve all metadata for all data entities 
const getProfile = async (userId) => {
  try {
    const profile = await database.getUserData(userId, dbconstants.profile);
    return profile;
  } catch (error) {
    console.log(`getProfile: caught exception: ${error}`);
    return null;
  }
}

// store metadata for a particular data entity
const storeProfile = async (userId, profile) => {
  try {
    await database.setUserData(userId, dbconstants.profile, profile);
  } catch (error) {
    console.log(`storeProfile: caught exception: ${error}`);
  }
}