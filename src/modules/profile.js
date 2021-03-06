// user profile management

// exports:
//   createHandlers(app): create handlers for GET and POST endpoints
//   getProfile(userId): gets the profile for the userId
//   storeProfile(userId, profile): stores the profile for the userId

const database = require('../data/database');
const dbconstants = require('../data/database-constants');
const auth0 = require('../services/auth0');
const requesthandler = require('./requesthandler');
const events = require('./events');
const environment = require('../modules/environment');
const audience = environment.getOAuth2Audience();

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
      const appProfile = await exports.getProfile(req.userId) || {};
      const auth0profile = await auth0.getAuth0Profile(req.userId);

      // create a consolidated profile with app data overwriting auth0 data
      const fullProfile = {...auth0profile, ...appProfile};

      // ensure the [identities] come fresh from auth0 
      if (auth0profile && auth0profile.identities) {
        fullProfile.identities = auth0profile.identities;
      }
      res.status(200).send(fullProfile);
    }

    // if this request is part of the login process, post an event
    if (!environment.getDevMode() && req.query.login) {
      const email = req.user[`${audience}/email`];
      events.post(`user ${email} logged in`);
    }

    returnProfile();
  });

  // Post profile API endpoint
  app.post('/profile', requesthandler.checkJwt, requesthandler.processUser, function(req, res){
    const store = async () => {
      await exports.storeProfile(req.userId, req.body);      
      res.status(200).send({ status: 'success' });
    }
    store();
  });

  app.get('/validateaccount', requesthandler.checkJwt, requesthandler.processUser, function(req, res){
    const accountName = req.query.account;
    const validate = async () => {
      const account = await database.getUserData(accountName);
      if (account) {
        res.status(200).send({ valid: false });
      } else {
        res.status(200).send({ valid: true });
      }
    }

    if (!accountName || accountName === "" || !validateAccountName(accountName)) {
      res.status(200).send({ valid: false } );
      return;
    }

    validate();
  });  

  app.post('/validateaccount/:account', requesthandler.checkJwt, requesthandler.processUser, function(req, res){
    const accountName = req.params.account;
    const validate = async () => {
      const account = await database.getUserData(accountName);
      if (account) {
        res.status(200).send({ status: 'error' });
      } else {
        // create a new user with the name ${accountName}, noting the userId in the profile
        await database.setUserData(accountName, dbconstants.profile, { userId: req.userId });

        // publish an event indicating a new user just signed up and created an account
        events.post(`new user ${req.userId} created account named ${accountName}`);

        // return success status
        res.status(200).send({ status: 'success' });
      }
    }

    if (!accountName || !validateAccountName(accountName)) {
      res.status(200).send({ status: 'error' } );
      return;
    }

    validate();
  });    
}

// retrieve all metadata for all data entities 
exports.getProfile = async (userId) => {
  try {
    const profile = await database.getUserData(userId, dbconstants.profile);
    return profile;
  } catch (error) {
    console.log(`getProfile: caught exception: ${error}`);
    return null;
  }
}

// store metadata for a particular data entity
exports.storeProfile = async (userId, profile) => {
  try {
    await database.setUserData(userId, dbconstants.profile, profile);
  } catch (error) {
    console.log(`storeProfile: caught exception: ${error}`);
  }
}

// valid accounts are 1-20 characters, start with a-z, and are alphanumeric
const validateAccountName = (value) => {
  const re = /^[a-z]\w{0,19}$/;
  const acct = String(value).toLowerCase();
  return re.test(acct);
}
