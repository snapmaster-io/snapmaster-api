// utility to invoke a provider action

// get the environment as an env variable
const env = process.env.ENV || 'prod';
console.log('environment:', env);

// set the environment in the environment service
const environment = require('../src/modules/environment');
environment.setEnv(env);

const database = require('../src/data/database');
database.setEnv(env);

const providers = require('../src/providers/providers');

// check command line
if (process.argv.length < 5) {
  console.error('Usage: invokeAction <providerName> <userId> <parameterFile.json>');
  process.exit(1);
}

const providerName = process.argv[2];
const userId = process.argv[3];
const parameters = require(process.argv[4]);

const invokeAction = async (userId, providerName, params) => {
  const provider = providers.getProvider(providerName);
  const status = await provider.invokeAction(userId, null, params);
  if (!status) {
    console.error('could not invoke action');
  } else {
    console.log(`provider ${providerName} action invoked!`);
  }  
}

// invoke the provider
invokeAction(userId, providerName, parameters);
