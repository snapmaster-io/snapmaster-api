// beta program support code
//
// exports:
//   createHandlers(app): create handlers for GET and POST endpoints

const database = require('../data/database');
const dbconstants = require('../data/database-constants');
const sms = require('../services/sms');
const events = require('./events');

exports.createHandlers = (app) => {
  // request access endpoint: this is an unauthenticated request that stores 
  // an email address that requests access to the beta
  app.post('/requestaccess', function(req, res){
    console.log('POST /requestaccess');
    const email = req.body.email;
    console.log(`\Email: ${email}`);

    // validate simple auth token
    const auth = req.headers.authorization;
    const [, token] = auth.match(/Bearer (.*)/);
    const phrase = Buffer.from(token, 'base64').toString();
    const regex = new RegExp(`${email}SnapMaster`);
    const isValid = phrase.match(regex);

    const request = async () => {
      await requestAccess(email, req.body);
      res.status(200).send();
    }

    if (isValid) {
      request();
    }
  });

  // validate code: this is an unauthenticated request that validates an email
  // has been authorized to join the beta
  app.post('/validatecode', function(req, res){
    console.log('POST /validatecode');
    const email = req.body.email;
    const code = req.body.code;
    console.log(`\Email: ${email}, code: ${code}`);

    // validate simple auth token
    const auth = req.headers.authorization;
    const [, token] = auth.match(/Bearer (.*)/);
    const phrase = Buffer.from(token, 'base64').toString();
    const regex = new RegExp(`${email}SnapMaster`);
    const isValid = phrase.match(regex);
    
    const validate = async () => {
      const data = await validateBetaCode(email, code);
      res.status(200).send(data);
    }

    if (isValid) {
      validate();
    } else {
      res.status(200).send();
    }
  });
}

const requestAccess = async (email, document) => {
  try {
    await database.storeDocument(dbconstants.signups, dbconstants.emailsCollection, email, document);

    // send a text to the admin to signal a new access request
    await sms.textNotification(sms.toAdmin, `New access request: ${email}`);

    // post an event to signal a new access request
    await events.post(`New access request: ${email}`);
  } catch (error) {
    console.log(`requestAccess: caught exception: ${error}`);    
  }
}

const validateBetaCode = async (email, code) => {
  try {
    const signup = await database.getDocument(dbconstants.signups, dbconstants.emailsCollection, email);
    if (signup && signup.code === code) {
      return signup;
    }
    return null;
  } catch (error) {
    console.log(`validateEmail: caught exception: ${error}`);
    return null;
  }
}