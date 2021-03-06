// Pagerduty provider

// exports:
//   createHandlers(app, [middlewaree]): create all route handlers
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
const config = require('../../modules/config');
const oauth = require('../../modules/oauth');
const { successvalue, errorvalue } = require('../../modules/returnvalue');

const providerName = 'pagerduty';
const entityName = `${providerName}:services`;

exports.name = providerName;
exports.definition = provider.getDefinition(providerName);

// entities defined by this provider
exports.entities = {};
exports.entities[entityName] = {
  entity: entityName,
  provider: providerName,
  itemKey: '__id',
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

        console.log(`body: ${req.body}`);

        // dispatch the webhook payload to the handler
        handleWebhook(userId, activeSnapId, req.headers[`x-webhook-id`], req.body);

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
  let service;
  try {
    // validate params
    service = param[entityName];
    if (!service) {
      const message = 'missing required parameter "service"';
      console.error(`createTrigger: ${message}`);
      return message;
    }
    const event = param.event;
    if (!event) {
      const message = 'missing required parameter "event"';
      console.error(`createTrigger: ${message}`);
      return message;
    }
    const serviceID = service.id;
    if (!serviceID) {
      const message = 'could not find service ID';
      console.error(`createTrigger: ${message}`);
      return message;
    }

    // get token for calling API 
    const token = await getToken(service);

    // construct webhook url
    let url = encodeURI(`${environment.getUrl()}/${providerName}/webhooks/${userId}/${activeSnapId}`);

    // if in dev mode, create the hook through smee.io 
    if (environment.getDevMode()) {
      // HACK
      url = "https://smee.io/soJHHjA5rPvWnwlc";
    }

    // define the request body
    const body = {
      extension: {
        endpoint_url: url,
        name: "SnapMaster webhook",
        summary: "SnapMaster webhook",
        type: "extension",
        extension_schema: {
          id: "PJFWPEP",
          type: "extension_schema_reference"
        },
        extension_objects: [
          {
            id: serviceID,
            type: "service_reference"
          }
        ]
      }
    }

    const urlBase = `https://api.pagerduty.com/extensions`;

    const headers = { 
      'content-type': 'application/json',
      'accept': 'application/vnd.pagerduty+json;version=2',
      'authorization': `Bearer ${token}`
     };

    const hook = await axios.post(
      urlBase,
      body,
      {
        headers: headers
      });

    // check for empty response 
    if (!hook || !hook.data || !hook.data.extension || !hook.data.extension.self) {
      const message = 'did not receive proper webhook information';
      console.error(`createTrigger: ${message}`);
      return message;
    }

    // construct trigger data from returned hook info
    const triggerData = {
      id: hook.data.extension.id,
      url: `${hook.data.extension.self}`
    }

    return triggerData;
  } catch (error) {
    console.log(`createTrigger: caught exception: ${error}`);
    if (error.response.status === 404) {
      return `${error.message}: unknown service or insufficient privileges to create webhook on service ${service}`
    }
    return null;
  }
}

exports.deleteTrigger = async (providerName, defaultConnectionInfo, triggerData, param) => {
  try {
    // validate params
    if (!triggerData || !triggerData.url) {
      console.log(`deleteTrigger: invalid trigger data`);
      return null;
    }

    const token = await getToken(defaultConnectionInfo);
    const headers = { 
      'content-type': 'application/json',
      'accept': 'application/vnd.pagerduty+json;version=2',
      'authorization': `Bearer ${token}`
     };

    const response = await axios.delete(
      triggerData.url,
      {
        headers: headers
      });

    return response.data;
  } catch (error) {
    console.log(`deleteTrigger: caught exception: ${error}`);
    return null;
  }
}

exports.invokeAction = async (providerName, connectionInfo, activeSnapId, param) => {
  try {
    // validate params
    const service = param[entityName];
    if (!service) {
      const message = `missing required parameter "service"`;
      console.error(`invokeAction: ${message}`);
      return errorvalue(message);
    }
    const action = param.action;
    if (!action) {
      const message = `missing required parameter "action"`;
      console.error(`invokeAction: ${message}`);
      return errorvalue(message);
    }
    const title = param.title;
    if (!title) {
      const message = `missing required parameter "title"`;
      console.error(`invokeAction: ${message}`);
      return errorvalue(message);
    }
    const serviceID = service.id;
    if (!serviceID) {
      const message = `could not find service ID`;
      console.error(`invokeAction: ${message}`);
      return errorvalue(message);
    }

    if (action !== 'create') {
      const message = `unknown action "${action}"`;
      console.error(`invokeAction: ${message}`);
      return errorvalue(message);
    }

    // get token for calling API 
    const token = await getToken(service);

    console.log(`${providerName}: service ${param.service}, action ${action}, title ${title}`);

    // define the request body
    const body = {
      incident: {
        type: "incident",
        title: title,
        service: {
          id: serviceID,
          type: "service_reference",
        },
      }
    }
    if (param.urgency) {
      body.urgency = param.urgency;
    }
    if (param.details) {
      body.body = {
        type: "incident_body",
        details: param.details
      }
    }

    const urlBase = `https://api.pagerduty.com/incidents`;

    const headers = { 
      'content-type': 'application/json',
      'accept': 'application/vnd.pagerduty+json;version=2',
      'authorization': `Bearer ${token}`
      };
    
    const response = await axios.post(
      urlBase,
      body,
      {
        headers: headers
      });

    // return response
    return successvalue(response.data);
  } catch (error) {
    console.error(`invokeAction: caught exception: ${error}`);
    return errorvalue(error.message);
  }
}

// this function is called when a new entity (e.g. service) is added
// it validates the provider-specific account info, and constructs 
// the entity that will be stored by the caller
exports.entities[entityName].func = async ([connectionInfo, defaultConnectionInfo]) => {
  try {
    // construct an object with all entity info
    const entity = {};
    for (const param of connectionInfo) {
      entity[param.name] = param.value;
    }

    // verify we have everything we need to authenticate
    if (!entity.service) {
      console.error('entityHandler: did not receive service name');
      return null;
    }
    if (!defaultConnectionInfo) {
      console.error('entityHandler: did not receive authorization information');
      return null;
    }

    // get the service ID associated with the service name
    const serviceInfo = await getServiceInfo(defaultConnectionInfo, entity.service);
    if (!serviceInfo) {
      console.error(`entityHandler: could not find service ${entity.service}`);
      return null;
    }

    // add the entity attributes to the result
    const result = { 
      secret: {
        ...entity, 
        ...serviceInfo,
        ...defaultConnectionInfo, 
      },
      __id: entity.service,
      __name: entity.service,
      __url: `${serviceInfo.html_url}`,
    };

    return result;
  } catch (error) {
    await error.response;
    console.log(`entityHandler: caught exception: ${error}`);
    return null;
  }
}

const getServiceInfo = async (connectionInfo, service) => {
  try {
    const token = await getToken(connectionInfo);
    if (!token) {
      console.error('getServiceInfo: could not obtain token');
      return null;
    }

    const urlBase = `https://api.pagerduty.com/services?query=${service}`;

    const headers = { 
      'content-type': 'application/json',
      'accept': 'application/vnd.pagerduty+json;version=2',
      'authorization': `Bearer ${token}`
     };

    const response = await axios.get(
      urlBase,
      {
        headers: headers
      });

    // check for empty response 
    const serviceInfo = response.data;
    if (!serviceInfo || !serviceInfo.services || !serviceInfo.services.length) {
      return null;
    }

    // return the first object in the response array
    return serviceInfo.services[0];
  } catch (error) {
    console.error(`getServiceInfo: caught exception: ${error}`);
    return null;
  }
}

const getToken = async (connectionInfo) => {
  try {
    if (!connectionInfo) {
      console.log('getToken: no connection info passed in');
      return null;
    }

    // get configuration data
    const configData = await config.getConfig(providerName);
    const oauthClient = oauth.getOAuthClient(configData);

    // create an access token object
    let accessToken = oauthClient.accessToken.create(connectionInfo);

    // refresh the token if it's 300 seconds or less from expiration
    if (accessToken.expired(300)) {
      if (configData.scopes) {
        const params = {
          scope: configData.scopes
        }
        accessToken = await accessToken.refresh(params);  
      } else {
        accessToken = await accessToken.refresh(); 
      }
    }

    // return the access token
    return accessToken.token.access_token;
  } catch (error) {
    console.log(`getToken: caught exception: ${error}`);
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
    const webhookProxyUrl = "https://smee.io/soJHHjA5rPvWnwlc"; 
    const source = new EventSource(webhookProxyUrl);
    source.onmessage = event => {
      try {
        const webhookEvent = JSON.parse(event.data);

        // dispatch the webhook payload to the handler
        handleWebhook(null, null, webhookEvent[`x-webhook-id`], webhookEvent.body);
      } catch (error) {
        console.error(`eventSource/${providerName}Webhook: caught exception ${error}`);
      }
    };  
  }
}
