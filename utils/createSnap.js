// utility to add snaps to the snapmaster user

// get the environment as an env variable
const env = process.env.ENV || 'prod';
console.log('environment:', env);

// set the environment in the environment service
const environment = require('../src/modules/environment');
environment.setEnv(env);

const database = require('../src/data/database');
database.setEnv(env);

const dbconstants = require('../src/data/database-constants');
const snapdal = require('../src/snap/snap-dal');
const fs = require('fs');

const userId = 'snapmaster';

// check command line
if (process.argv.length !== 3) {
  console.error('Usage: createSnap <definitionFile.yaml>');
  process.exit(1);
}

const file = process.argv[2];
if (!file) {
  console.error('Usage: createSnap <definitionFile.yaml>');
  process.exit(1);
}

const definition = fs.readFileSync(`./${file}`, 'utf8');
if (!definition) {
  console.error(`Could not fine definition file ${file}`);
  process.exit(1);
}

const createSnap = async (userId, definition) => {
  // create the user if it doesn't exist yet
  const user = await database.getUserData(userId);
  if (!user) {
    await database.setUserData(userId, dbconstants.profile, { account: userId } );
  }

  // create the snap in the user's context
  const snap = await snapdal.createSnap(userId, definition);
  if (!snap) {
    console.error('could not create snap');
  } else {
    console.log(`snap ${snap.snapId} created!`);
  }  
}

createSnap(userId, definition);
