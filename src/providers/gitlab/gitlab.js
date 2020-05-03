// GitLab provider

// exports:
//   createHandlers(app, [middlewaree]): create all route handlers
//   createTrigger(providerName, connectionInfo, userId, activeSnapId, params): create a trigger (webhook)
//   deleteTrigger(providerName, connectionInfo, triggerData): delete a trigger (webhook)
//
//   provider: provider name
//   image: provider image url (local to SPA)
//   type: provider type (simple or link)
//   definition: provider definition

const EventSource = require('eventsource');
const axios = require('axios');
const provider = require('../provider');
const snapengine = require('../../snap/snap-engine');
const environment = require('../../modules/environment');
const config = require('../../modules/config');
const oauth = require('../../modules/oauth');
const verify = require('@octokit/webhooks/verify');

const providerName = 'gitlab';

exports.provider = providerName;
exports.image = `/${providerName}-logo.png`;
exports.definition = provider.getDefinition(providerName);
exports.type = exports.definition.connection && exports.definition.connection.type;

exports.createHandlers = (app) => {
  // set up Webhook listener for dev mode
  createWebhookListener();

  // webhooks endpoint - called by provider
  app.post(`/${providerName}/webhooks/:userId/:activeSnapId`, function(req, res){
    // define an async function to await configuration
    const process = async () => {
      try {
        // get provider configuration
        const providerConfig = await config.getConfig(providerName);

        const userId = decodeURI(req.params.userId);
        const activeSnapId = req.params.activeSnapId;
        console.log(`POST /${providerName}/webhooks: userId ${userId}, activeSnapId ${activeSnapId}`);

        // verify the signature against the body and the secret
        const secret = providerConfig.client_id;

        if (!verify(secret, req.body, req.headers['x-gitlab-secret'])) {
          console.error(`${providerName}/webhooks: signature does not match event payload & secret`);
          res.status(500).send();
          return;
        }

        // dispatch the webhook payload to the handler
        handleWebhook(userId, activeSnapId, req.headers[`x-${providerName}-event`], req.body);

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
    // get provider configuration
    const providerConfig = await config.getConfig(providerName);

    // validate params
    const project = param.project;
    if (!project) {
      console.error(`createTrigger: missing required parameter "workspace"`);
      return null;
    }
    const event = param.event;
    if (!event) {
      console.error(`createTrigger: missing required parameter "event"`);
      return null;
    }

    const token = await getToken(defaultConnectionInfo);

    let url = encodeURI(`${environment.getUrl()}/${providerName}/webhooks/${userId}/${activeSnapId}`);

    // if in dev mode, create the hook through smee.io 
    if (environment.getDevMode()) {
      // HACK
      url = "https://smee.io/soJHHjA5rPvWnwlc";
    }

    // create the hook, using the client ID as the secret
    const body = {
      url: url,
      token: providerConfig.client_id
    };
    const eventKey = `${event}_events`;
    body[eventKey] = true;

    const encodedProject = project.replace('/', '%2F');
    const urlBase = `https://gitlab.com/api/v4/projects/${encodedProject}/hooks`;

    const headers = { 
      'content-type': 'application/json',
      'authorization': `Bearer ${token}`
     };

    const hook = await axios.post(
      urlBase,
      body,
      {
        headers: headers
      });

    // check for empty response 
    if (!hook || !hook.data || !hook.data.id) {
      return null;
    }

    // construct trigger data from returned hook info
    const triggerData = {
      id: hook.data.id,
      url: `${urlBase}/${hook.data.id}`
    }

    return triggerData;
  } catch (error) {
    console.log(`createTrigger: caught exception: ${error}`);
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
    return null;
  } catch (error) {
    console.log(`invokeAction: caught exception: ${error}`);
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
        handleWebhook(null, null, webhookEvent[`x-gitlab-event`], webhookEvent.body);
      } catch (error) {
        console.error(`eventSource/${providerName}Webhook: caught exception ${error}`);
      }
    };  
  }
}
