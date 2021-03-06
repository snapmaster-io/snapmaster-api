// Datadog provider

// exports:
//   createHandlers(app): create all route handlers
//   createTrigger(providerName, connectionInfo, userId, activeSnapId, params): create a trigger (webhook)
//   deleteTrigger(providerName, connectionInfo, triggerData): delete a trigger (webhook)
//
//   name: provider name
//   definition: provider definition

const EventSource = require('eventsource');
const axios = require('axios');
const provider = require('../provider');
const snapengine = require('../../snap/snapengine');
const environment = require('../../modules/environment');

const providerName = 'datadog';
const entityName = `${providerName}:accounts`;
const defaultEntityName = `${entityName}:default`;

exports.name = providerName;
exports.definition = provider.getDefinition(providerName);

// entities defined by this provider
exports.entities = {};
exports.entities[entityName] = {
  entity: entityName,
  provider: providerName,
  itemKey: '__id',
  keyFields: ['apikey', 'appkey'],
};

exports.createHandlers = (app) => {
  // set up Webhook listener for dev mode
  createWebhookListener();

  // webhooks endpoint - called by provider
  app.post(`/${providerName}/webhooks/:userId/:activeSnapId`, function(req, res){
    // define an async function to await configuration
    const process = async () => {
      try {
        const userId = decodeURI(req.params.userId);
        const activeSnapId = req.params.activeSnapId;
        console.log(`POST /${providerName}/webhooks: userId ${userId}, activeSnapId ${activeSnapId}`);

        // dispatch the webhook payload to the handler
        handleWebhook(userId, activeSnapId, req.headers[`x-request-id`], req.body);

        // return immediately to the caller
        res.status(200).send();
      } catch (error) {
        console.error(`${providerName}/webhooks caught exception: ${error}`);
        res.status(500).send(error);
      }            
    }

    // call the processing function
    process();
  });
}

exports.createTrigger = async (providerName, defaultConnectionInfo, userId, activeSnapId, param) => {
  try {
    // validate params
    const account = param.account;
    if (!account) {
      const message = 'missing required parameter "account"';
      console.error(`createTrigger: ${message}`);
      return message;
    }
    const event = param.event;
    if (!event) {
      const message = 'missing required parameter "event"';
      console.error(`createTrigger: ${message}`);
      return message;
    }

    if (event !== 'webhook') {
      const message = `unknown event "${event}"`;
      console.error(`createTrigger: ${message}`);
      return message;
    }

    // get entity for calling API (either from the default entity in connection info, or the entity passed in)
    const tokenEntity = 
      account === defaultEntityName ? 
        defaultConnectionInfo :
        param[entityName];
    
    // construct webhook URL  
    let url = encodeURI(`${environment.getUrl()}/${providerName}/webhooks/${userId}/${activeSnapId}`);

    // if in dev mode, create the hook through smee.io 
    if (environment.getDevMode()) {
      // HACK
      url = "https://smee.io/soJHHjA5rPvWnwlc";
    }

    // create the hook, using the client ID as the secret
    const body = {
      encode_as: "json",
      name: `SnapMaster-${activeSnapId}`,
      url: url
    };

    const urlBase = 'https://api.datadoghq.com/api/v1/integration/webhooks/configuration/webhooks';

    const headers = { 
      'DD-API-KEY': tokenEntity.apikey,
      'DD-APPLICATION-KEY': tokenEntity.appkey,
    };

    const hook = await axios.post(
      urlBase,
      body,
      {
        headers: headers
      });

    // check for empty response 
    if (!hook || !hook.data || !hook.data.name) {
      const message = 'did not receive proper webhook information';
      console.error(`createTrigger: ${message}`);
      return message;
    }

    // construct trigger data from returned hook info
    const triggerData = {
      name: hook.data.name,
      url: `${urlBase}/${hook.data.name}`
    }

    return triggerData;
  } catch (error) {
    console.log(`createTrigger: caught exception: ${error}`);
    if (error.response.status === 404) {
      return `${error.message}: unknown account or insufficient privileges to create webhook`
    }
    return null;
  }
}

exports.deleteTrigger = async (providerName, defaultConnectionInfo, triggerData, param) => {
  try {
    // validate params
    const account = param.account;
    if (!account) {
      console.error(`deleteTrigger: missing required parameter "account"`);
      return null;
    }
    if (!triggerData || !triggerData.url) {
      console.log(`deleteTrigger: invalid trigger data`);
      return null;
    }

    // get entity for calling API (either from the default entity in connection info, or the entity passed in)
    const tokenEntity = 
      account === defaultEntityName ? 
        defaultConnectionInfo :
        param[entityName];

    const headers = { 
      'DD-API-KEY': tokenEntity.apikey,
      'DD-APPLICATION-KEY': tokenEntity.appkey,
    };

    const response = await axios.delete(
      triggerData.url,
      {
        headers: headers
      });

    return response.data || "";
  } catch (error) {
    console.log(`deleteTrigger: caught exception: ${error}`);
    return null;
  }
}

exports.invokeAction = async (providerName, connectionInfo, activeSnapId, param) => {
  try {
    return null;
  } catch (error) {
    console.log(`invokeAction: caught exception: ${error}`);
    return null;
  }
}

// this function is called when a new entity (e.g. account) is added
// it validates the provider-specific account info, and constructs 
// the entity that will be stored by the caller
exports.entities[entityName].func = async ([connectionInfo]) => {
  try {
    // construct an object with all entity info
    const entity = {};
    for (const param of connectionInfo) {
      entity[param.name] = param.value;
    }

    // verify we have everything we need to authenticate
    if (!entity.name || !entity.apikey || !entity.appkey) {
      console.error('entityHandler: did not receive all authorization information');
      return null;
    }

    // add the entity attributes to the result
    const result = { 
      secret: {
        ...entity, 
      },
      __id: entity.name,
      __name: entity.name,
      __url: `https://app.datadoghq.com`,
    };

    return result;
  } catch (error) {
    await error.response;
    console.log(`entityHandler: caught exception: ${error}`);
    return null;
  }
}

// handle an incoming webhook request
const handleWebhook = (userId, activeSnapId, name, payload) => {
  snapengine.executeSnap(userId, activeSnapId, [name], payload);
}

// create the webhook listener 
const createWebhookListener = async () => {
  // if in dev mode, install the eventsource proxy for the dev environment, to receive webhooks via smee.io
  if (environment.getDevMode()) {
    const webhookProxyUrl = "https://smee.io/trD1kVl727c1Zguw"; 
    const source = new EventSource(webhookProxyUrl);
    source.onmessage = event => {
      try {
        const webhookEvent = JSON.parse(event.data);

        // dispatch the webhook payload to the handler
        handleWebhook(null, null, webhookEvent[`x-request-id`], webhookEvent.body);
      } catch (error) {
        console.error(`eventSource/${providerName}Webhook: caught exception ${error}`);
      }
    };  
  }
}
