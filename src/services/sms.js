// sms service based on twilio implementation
// exports:
//   toAdmin: constant indicating to send the SMS to the application admin
//   textNotification: text a notification message
//   textReviews: text message a notification about new reviews
//   sendSms: send a generic SMS

const environment = require('../modules/environment');
const config = require('../modules/config');
const twilio = require('twilio');

// constant indicating to send the SMS to the application admin
exports.toAdmin = 'toAdmin';

exports.textNotification = async (to, message) => {
  try {
    const twilioConfig = await config.getConfig(config.twilio);
    const from = twilioConfig.from;
    const mediaUrl = 'https://github.com/snapmaster-io/snapmaster/raw/master/public/SnapMaster-logo-220.png'

    await exports.sendSms(to, from, mediaUrl, message);
  } catch (error) {
    console.log(`textNotification: caught exception: ${error}`);    
  }
}

exports.textReviews = async (to, reviews) => {
  try {
    const twilioConfig = await config.getConfig(config.twilio);
    const from = twilioConfig.from;
    const url = `${environment.getUrl()}/reputation/alerts`;
    const mediaUrl = 'https://github.com/snapmaster-io/snapmaster/raw/master/public/SnapMaster-logo-220.png'

    //const reviewsText = reviews.map(r => `${r[dbconstants.metadataProviderField]}: ${r[dbconstants.metadataSentimentField]}`;
    const body = `You've received ${reviews.length} new review${reviews.length > 1 ? 's' : ''}!\nHandle these new reviews here: ${url}`;

    await exports.sendSms(to, from, mediaUrl, body);
  } catch (error) {
    console.log(`textReviews: caught exception: ${error}`);    
  }
}

exports.sendSms = async (to, from, mediaUrl, body) => {
  try {
    // get twilio API key from config
    const twilioConfig = await config.getConfig(config.twilio);
    const client = new twilio(twilioConfig.account_sid, twilioConfig.auth_token);

    // replace a "toAdmin" SMS number with the admin number in the twilio config
    if (to === exports.toAdmin) {
      to = twilioConfig.to;
    }

    const msg = {
      body, 
      from,
      mediaUrl,     
      to
    };
    
    // send message
    await client.messages.create(msg);
  } catch (error) {
    console.log(`sendSms: caught exception: ${error}`);    
  }
}
