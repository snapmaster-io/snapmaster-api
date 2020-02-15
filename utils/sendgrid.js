// utility to test sendgrid integration using a sample email

// get the environment as an env variable
const env = process.env.ENV || 'prod';
console.log('environment:', env);

// set the environment in the environment service
const environment = require('../src/modules/environment');
environment.setEnv(env);

const email = require('../src/services/email');

email.sendEmail(
  "ogazitt@gmail.com",
  "omri@snapmaster.io",
  "testing sendgrid",
  "this is only a test"
);
