// utility to invoke a provider action

// get the environment as an env variable
const env = process.env.ENV || 'prod';
console.log('environment:', env);

// set the environment in the environment service
const environment = require('../src/modules/environment');
environment.setEnv(env);

const database = require('../src/data/database');
database.setEnv(env);

const connections = require('../src/modules/connections');
const providers = require('../src/providers/providers');
const { linkProvider } = require('../src/providers/provider');

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
  const connectionInfo = await getConnectionInfo(userId, providerName);

  const status = await provider.invokeAction(providerName, connectionInfo, "123456", params);
  if (!status) {
    console.error('could not invoke action');
  } else {
    console.log(`provider ${providerName} action invoked!`);
  }  
}

const getConnectionInfo = async (userId, providerName) => {
  // retrieve the provider
  const provider = providers.getProvider(providerName);

  // if this is an OAuth link provider, call the provider's getAccessInfo method to retrieve token info
  if (provider.type === linkProvider) {
    const info = provider.getAccessInfo(userId);
    return info;
  }

  // retrieve connection info from the user's connection info in the profile
  //const connection = await database.getUserData(userId, providerName);
  //const connectionInfo = connection && connection.connectionInfo;
  const connectionInfo = connections.getConnectionInfo(userId, providerName);
  return connectionInfo;
}

// invoke the provider
invokeAction(userId, providerName, parameters);
