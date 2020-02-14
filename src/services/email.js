// email service based on sendgrid implementation
// exports:
//   emailReviews: send an email with new reviews to the user
//   sendEmail: send a generic email

const dbconstants = require('../data/database-constants');
const environment = require('../modules/environment');
const sendgridConfig = environment.getConfig(environment.sendgrid);

// using Twilio SendGrid's v3 Node.js Library
// https://github.com/sendgrid/sendgrid-nodejs
const sgMail = require('@sendgrid/mail');
sgMail.setApiKey(sendgridConfig.api_key);

exports.emailReviews = async (to, reviews) => {
  try {
    const from = 'hello@saasmaster.co';
    const subject = 'New reviews!';
    const url = `${environment.getUrl()}/reputation/alerts`;
    const githubUrl = "https://github.com/ogazitt/saasmaster/raw/master/public";

    const reviewsText = reviews.map(r => `\t
${r[dbconstants.metadataProviderField]} 
(${r[dbconstants.metadataSentimentField]}): 
${r[dbconstants.metadataTextField]}\n`);

    const reviewsHtml = reviews.map(r => {
      const sentiment = r[dbconstants.metadataSentimentField];
      const provider = r[dbconstants.metadataProviderField].split('-')[0];
      const reviewText = r[dbconstants.metadataTextField];
      return (
`<p>
  <div style="display: flex">
  <img src="${githubUrl}/${provider}-logo.png" alt="${provider}" height="30px" width="30px" style="margin-right: 20px"/>
  <img src="${githubUrl}/${sentiment}-icon.png" alt="${sentiment}" height="25px" width="25px" />
  <span style="margin-left: 20px">${reviewText}</span>
  </div>
</p>`
      )
    });

    const text = `You've received new reviews:\n
${reviewsText}\n
Navigate to ${url} to handle these new reviews!`;

    const html = `
<div>
  <div style="display: flex">
    <a href=${url}>
      <img 
        src=${githubUrl}/SaaSMaster-logo-220.png
        alt="saasmaster" 
        width="50" height="50" />
    </a>
    <span style="font-size: 3em">&nbsp;New Reviews!</span>
  </div>
  <div>
    <h3>You've received some new reviews:</h3>
    ${reviewsHtml.join('\n')}
    <h3>
      <a href=${url}>Handle</a> these new reviews!
    </h3>
  </div>
</div>`;

    await exports.sendEmail(to, from, subject, text, html);
  } catch (error) {
    console.log(`emailReviews: caught exception: ${error}`);    
  }
}

exports.sendEmail = async (to, from, subject, text, html) => {
  try {
    // provide a default html value
    if (!html) {
      html = `<strong>${text}</strong>`;
    }

    const msg = {
      to,
      from,
      subject,
      text,
      html
    };

    await sgMail.send(msg);
  } catch (error) {
    console.log(`sendEmail: caught exception: ${error}`);    
  }
}
