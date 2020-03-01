// utility to add snaps to the snapmaster user

// get the environment as an env variable
const env = process.env.ENV || 'prod';
console.log('environment:', env);

// set the environment in the environment service
const environment = require('../src/modules/environment');
environment.setEnv(env);

const database = require('../src/data/database');
database.setEnv(env);

const snap = require('../src/snap/snap-dal');
const fs = require('fs');

// check command line
if (process.argv.length !== 4) {
  console.error('Usage: createSnap <snapName> <definitionFile.yaml>');
  process.exit(1);
}

const name = process.argv[2];
if (!name) {
  console.error('Usage: createSnap <snapName> <definitionFile.yaml>');
  process.exit(1);
}
console.log('name:', name);

const file = process.argv[3];
if (!file) {
  console.error('Usage: createSnap <snapName> <definitionFile.yaml>');
  process.exit(1);
}

const definition = fs.readFileSync(`./${file}`, 'utf8');
if (!definition) {
  console.error(`Could not fine definition file ${file}`);
  process.exit(1);
}

const snapId = `snapmaster/${name}`;

const defObj = { 
  snapId: snapId,
  private: false,
  text: definition
};

console.log('definition:', defObj);

snap.createSnap('snapmaster', name, defObj);
