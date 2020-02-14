// beta program support code
//
// exports:
//   requestAccess: request beta access for an email address
//   validateEmail: validate that an email is in the beta request collection

const database = require('../data/database');
const dbconstants = require('../data/database-constants');
const sms = require('../services/sms');

exports.requestAccess = async (email, document) => {
  try {
    await database.storeDocument(dbconstants.signups, dbconstants.emailsCollection, email, document);
    await sms.textNotification(sms.toAdmin, `New access request: ${email}`);
  } catch (error) {
    console.log(`requestAccess: caught exception: ${error}`);    
  }
}

exports.validateEmail = async (email) => {
  try {
    return await database.getDocument(dbconstants.signups, dbconstants.emailsCollection, email);
  } catch (error) {
    console.log(`validateEmail: caught exception: ${error}`);    
  }
}