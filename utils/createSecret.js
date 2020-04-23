// utility to store secrets in the GCP account

const path = require('path');

// get the environment as an env variable
const env = process.env.ENV || 'prod';
console.log('environment:', env);

// set the environment in the environment service
const environment = require('../src/modules/environment');
environment.setEnv(env);

const database = require('../src/data/database');
database.setEnv(env);

const dbconstants = require('../src/data/database-constants');
const credentials = require('../src/modules/credentials');
const fs = require('fs');

const userId = 'snapmaster';

// check command line
if (process.argv.length !== 3) {
  console.error('Usage: createSecret <secretfile>');
  process.exit(1);
}

const file = process.argv[2];
if (!file) {
  console.error('Usage: createSecret <secretfile>');
  process.exit(1);
}

const secret = fs.readFileSync(`./${file}`, 'utf8');
if (!secret) {
  console.error(`Could not fine definition file ${file}`);
  process.exit(1);
}

// construct a secret name from the file name (without directory or extension)
const basename = path.basename(file);
const extlength = path.extname(basename).length;
const name = basename.substring(0, basename.length - extlength);

const createSecret = async (userId, name, secret) => {
  // create the user if it doesn't exist yet
  const user = await database.getUserData(userId);
  if (!user) {
    await database.setUserData(userId, dbconstants.profile, { account: userId } );
  }

  // create the key in the user's context
  const key = await credentials.set(userId, name, secret);
  if (!key) {
    console.error('could not create secret');
  } else {
    console.log(`secret ${key} created!`);
  }  
}

createSecret(userId, name, secret);
