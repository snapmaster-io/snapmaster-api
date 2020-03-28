// provider base 
//
// exported methods:
//   getDefinition: load and parse the yml definition of a provider
//   
// exported constants:
//   simpleProvider: simple provider
//   linkProvider: link provider (OAuth via Auth0)

const axios = require('axios');
const fs = require('fs');
const YAML = require('yaml');
const auth0 = require('../services/auth0');
const environment = require('../modules/environment');

exports.simpleProvider = 'simple';
exports.linkProvider = 'link';

exports.getDefinition = (providerName) => {
  try {
    const definition = fs.readFileSync(`./src/providers/${providerName}/${providerName}.yml`, 'utf8');
    const provider = YAML.parse(definition);
    // TODO: validation
    return provider;
  } catch (error) {
    console.log(`getDefinition: caught exception: ${error}`);
    return null;
  }
}

// invoke a provider action across service boundaries
exports.invokeAction = (providerName, connectionInfo, activeSnapId, params) => {
  try {
    // get an access token for the provider service
    const token = auth0.getAPIAccessToken();
    if (!token) {
      console.error('invokeAction: could not retrieve API access token');
      return null;
    }

    const url = environment.getProviderUrl(providerName);
    const body = {
      connectionInfo,
      activeSnapId,
      params
    };

    const headers = { 
      'content-type': 'application/json',
      'authorization': `Bearker ${token}`
    };

    const response = await axios.post(
      url,
      body,
      {
        headers: headers
      });

    const data = response.data;
    return data;
  } catch (error) {
    console.error(`invokeAction: caught exception: ${error}`);
    return null;
  }
}