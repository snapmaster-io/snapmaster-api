// provider base 
//
// exported methods:
//   getDefinition: load and parse the yml definition of a provider
//   invokeAction: invoke an action for an "out of tree" provider (one that is running in a separate service)

const axios = require('axios');
const fs = require('fs');
const YAML = require('yaml');
const auth0 = require('../services/auth0');
const environment = require('../modules/environment');
const { successvalue, errorvalue } = require('../modules/returnvalue');

// create a provider trigger across service boundaries
exports.createTrigger = async (providerName, connectionInfo, userId, activeSnapId, param) => {
  try {
    // get an access token for the provider service
    // currently  provider services all do auth via Auth0, and all share an Auth0 API service clientID / secret
    const token = await auth0.getAPIAccessToken();
    if (!token) {
      console.error('createTrigger: could not retrieve API access token');
      return null;
    }

    const providerUrl = environment.getProviderUrl(providerName);
    const url = `${providerUrl}/createTrigger`;
    const body = {
      connectionInfo,
      userId,
      activeSnapId,
      param
    };

    const headers = { 
      'content-type': 'application/json',
      'authorization': `Bearer ${token}`
    };

    const response = await axios.post(
      url,
      body,
      {
        headers: headers
      });

    // construct return value
    // TODO: formalize snapmaster/provider protocol to return the standard
    // { status, message, data } responses, including internal providers.
    const responseData = response.data;
    if (!responseData || responseData.error) {
      return responseData.message;
    } else {
      return responseData.data;
    }
    // return responseData;
  } catch (error) {
    console.error(`createTrigger: caught exception: ${error}`);
    return null;
  }
}

// delete a provider trigger across service boundaries
exports.deleteTrigger = async (providerName, connectionInfo, triggerData, param) => {
  try {
    // get an access token for the provider service
    // currently  provider services all do auth via Auth0, and all share an Auth0 API service clientID / secret
    const token = await auth0.getAPIAccessToken();
    if (!token) {
      console.error('invokeAction: could not retrieve API access token');
      return null;
    }

    const providerUrl = environment.getProviderUrl(providerName);
    const url = `${providerUrl}/deleteTrigger`;
    const body = {
      connectionInfo,
      triggerData,
      param
    };

    const headers = { 
      'content-type': 'application/json',
      'authorization': `Bearer ${token}`
    };

    const response = await axios.post(
      url,
      body,
      {
        headers: headers
      });

    // construct return value
    // TODO: formalize snapmaster/provider protocol to return the standard
    // { status, message, data } responses, including internal providers.
    const responseData = response.data;
    if (!responseData || responseData.error) {
      return responseData.message;
    } else {
      return responseData.data;
    }
    // return responseData;
  } catch (error) {
    console.error(`deleteTrigger: caught exception: ${error}`);
    return null;
  }
}

exports.getDefinition = (providerName) => {
  try {
    const definition = fs.readFileSync(`./src/providers/${providerName}/${providerName}.yml`, 'utf8');
    const provider = YAML.parse(definition);
    provider.text = definition;
    // TODO: validation
    return provider;
  } catch (error) {
    console.log(`getDefinition: caught exception: ${error}`);
    return null;
  }
}

// invoke a provider action across service boundaries
exports.invokeAction = async (providerName, connectionInfo, activeSnapId, param) => {
  try {
    // get an access token for the provider service
    // currently  provider services all do auth via Auth0, and all share an Auth0 API service clientID / secret
    const token = await auth0.getAPIAccessToken();
    if (!token) {
      const message = `could not retrieve API access token`;
      console.error(`invokeAction: ${message}`);
      return errorvalue(message);
    }

    const providerUrl = environment.getProviderUrl(providerName);
    const url = `${providerUrl}/invokeAction`;
    const body = {
      connectionInfo,
      activeSnapId,
      param
    };

    const headers = { 
      'content-type': 'application/json',
      'authorization': `Bearer ${token}`
    };

    const response = await axios.post(
      url,
      body,
      {
        headers: headers
      });

    // construct output message
    const output = response.data;
    const status = (output && output.status) || "error";
    const message = output && output.message;

    console.log(`invokeAction: ${providerName} executed action ${param.action} and returned status ${status}, message ${message}`);

    return successvalue(output);
  } catch (error) {
    console.error(`invokeAction: caught exception: ${error}`);
    return errorvalue(error.message);
  }
}