// utility to simulate a trigger of an active snap

// get the environment as an env variable
const env = process.env.ENV || 'prod';
console.log('environment:', env);

// set the environment in the environment service
const environment = require('../src/modules/environment');
environment.setEnv(env);

const database = require('../src/data/database');
database.setEnv(env);

const snapengine = require('../src/snap/snap-engine');

// check command line
if (process.argv.length < 4) {
  console.error('Usage: executeSnap <userId> <activeSnapId>');
  process.exit(1);
}

const userId = process.argv[2];
const activeSnapId = process.argv[3];
const params = null;
const payload = null;

// trigger the active snap
snapengine.executeSnap(userId, activeSnapId, params, payload);