// Pagerduty provider

// exports:
//   apis.
//
//   createHandlers(app): create all route handlers
//   invokeAction(providerName, connectionInfo, activeSnapId, param): invoke an action
// 
//   provider: provider name
//   image: provider image url (local to SPA)
//   type: provider type (simple or link)
//   definition: provider definition

const axios = require('axios');
const provider = require('../provider');
const requesthandler = require('../../modules/requesthandler');
const connections = require('../../modules/connections');

const providerName = 'pagerduty';

exports.provider = providerName;
exports.image = `/${providerName}-logo.png`;
exports.type = provider.simpleProvider;
exports.definition = provider.getDefinition(providerName);

// api's defined by this provider
exports.apis = {
};

exports.createHandlers = (app) => {
}

exports.invokeAction = async (providerName, connectionInfo, activeSnapId, param) => {
  try {
    const action = param.action;
    const channel = param.channel;
    const message = param.message;

    console.log(`${providerName}: action ${action}, channel ${channel}, message ${message}`);

    if (!action || !channel || !message) {
      console.error('invokeAction: missing required parameter');
      return null;
    }

    // get token for calling API
    const token = await getToken(connectionInfo);

    const url = 'https://slack.com/api/chat.postMessage';
    const headers = { 
      'content-type': 'application/json',
      'authorization': `Bearer ${token}`
    };

    const body = JSON.stringify({
      channel,
      text: message
    });

    const response = await axios.post(
      url,
      body,
      {
        headers: headers
      });

    return response.data;
  } catch (error) {
    console.log(`invokeAction: caught exception: ${error}`);
    return null;
  }
}

const getToken = async (connectionInfo) => {
  try {
    const token = connectionInfo.find(p => p.name === 'token');
    return token && token.value;
  } catch (error) {
    console.log(`getToken: caught exception: ${error}`);
    return null;
  }
}