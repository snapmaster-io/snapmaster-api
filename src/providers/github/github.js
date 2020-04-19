// github provider

// exports:
//   apis.
//        createHook(userId, repo): create a webhook
//        deleteHook(userId, repo, hook): get page reviews
//        getActiveRepos(userId): get active repos for this user
//        getAllRepos(userId): get all repos for this user
//
//   createHandlers(app, [middlewaree]): create all route handlers
//   createTrigger(providerName, connectionInfo, userId, activeSnapId, params): create a trigger (webhook)
//   deleteTrigger(providerName, connectionInfo, triggerData): delete a trigger (webhook)
//
//   provider: provider name
//   image: provider image url (local to SPA)
//   type: provider type (simple or link)
//   definition: provider definition

const { Octokit } = require('@octokit/rest');
const verify = require('@octokit/webhooks/verify');
const EventSource = require('eventsource');

const axios = require('axios');
const githubauth = require('../../services/githubauth');
const dbconstants = require('../../data/database-constants');
const dal = require('../../data/dal');
const provider = require('../provider');
const requesthandler = require('../../modules/requesthandler');
const snapengine = require('../../snap/snap-engine');
const environment = require('../../modules/environment');

const providerName = 'github';

// get github configuration
const githubConfig = environment.getConfig(providerName);

exports.provider = providerName;
exports.image = `/${providerName}-logo.png`;
exports.type = provider.linkProvider;
exports.definition = provider.getDefinition(providerName);
exports.getAccessInfo = githubauth.getGithubAccessInfo;

// api's defined by this provider
exports.apis = {
  createHook: {
    name: 'createHook',
    provider: providerName,
    entity: 'github:hooks',
    arrayKey: 'data',
    itemKey: 'id'
  },
  deleteHook: {
    name: 'deleteHook',
    provider: providerName,
  },
  getActiveRepos: {
    name: 'getActiveRepos',
    provider: providerName,
    itemKey: 'name'
  },
  getAllRepos: {
    name: 'getAllRepos',
    provider: providerName,
    entity: 'github:repos',
    itemKey: 'name'
  },
};

exports.createHandlers = (app) => {
  // Get github endpoint - returns list of all repos
  app.get('/github', requesthandler.checkJwt, requesthandler.processUser, function(req, res){
    const refresh = req.query.refresh || false;
    requesthandler.getData(
      res, 
      req.userId, 
      exports.apis.getAllRepos, 
      null,     // default entity name
      [req.userId], // parameter array
      refresh);
  });

  // Post github api data endpoint
  app.post('/github', requesthandler.checkJwt, requesthandler.processUser, function(req, res){
    requesthandler.storeMetadata(
      res,
      req.userId,
      exports.apis.getAllRepos,
      `github:repos`,
      req.body);
  });

  // Get github activerepos endpoint - returns list of active repos
  app.get('/github/activerepos', requesthandler.checkJwt, requesthandler.processUser, function(req, res){
    requesthandler.queryProvider(
      res, 
      req.userId, 
      exports.apis.getActiveRepos, 
      [req.userId]); // parameter array
  });

  // set up Webhook listener for dev mode
  createWebhookListener();

  // Github webhooks endpoint - called by github
  app.post('/github/webhooks/:userId/:activeSnapId', function(req, res){
    try {
      const userId = decodeURI(req.params.userId);
      const activeSnapId = req.params.activeSnapId;
      console.log(`POST /github/webhooks: userId ${userId}, activeSnapId ${activeSnapId}`);

      // verify the signature against the body and the secret
      const secret = githubConfig.github_client_id;      
      if (!verify(secret, req.body, req.headers['x-hub-signature'])) {
        console.error('githubWebhook: signature does not match event payload & secret');
        res.status(500).send();
        return;
      }

      // don't propagate a 'ping' event
      if (req.headers["x-github-event"] !== 'ping') {
        // dispatch the webhook payload to the handler
        handleWebhook(userId, activeSnapId, req.headers["x-github-event"], req.body);
      }

      // return immediately to the caller
      res.status(200).send();
    } catch (error) {
      console.error(`githubWebhook caught exception: ${error}`);
      res.status(500).send(error);
    }
  });
}

exports.createTrigger = async (providerName, defaultConnectionInfo, userId, activeSnapId, param) => {
  try {
    // validate params
    const repoName = param.repo;
    if (!repoName) {
      console.error(`createTrigger: missing required parameter "repo"`);
      return null;
    }

    const event = param.event;
    if (!event) {
      console.error(`createTrigger: missing required parameter "event"`);
      return null;
    }

    const token = await getToken(defaultConnectionInfo);
    // const [client] = await getClient(userId);

    const [owner, repo] = repoName.split('/');
    if (!owner || !repo) {
      console.error(`createTrigger: repo must be in owner/name format; received ${repoName}`);
      return null;
    }

    let url = encodeURI(`${environment.getUrl()}/github/webhooks/${userId}/${activeSnapId}`);

    // if in dev mode, create the hook through smee.io 
    if (environment.getDevMode()) {
      url = githubConfig.github_smee_url;
    }

    // create the hook, using the client ID as the secret
    const body = {
      events: [event],
      config: {
        url: url,
        secret: githubConfig.github_client_id,
        content_type: 'json',
      }
    };

    const headers = { 
      'content-type': 'application/json',
      'authorization': `token ${token}`
     };

    const hook = await axios.post(
      `https://api.github.com/repos/${repoName}/hooks`,
      body,
      {
        headers: headers
      });

    /*
    const hook = await client.repos.createHook({
      owner,
      repo,
      config,
      events: [event]
    });
    */

    // construct trigger data from returned hook info
    const triggerData = {
      id: hook.data.id,
      url: hook.data.url
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
      'authorization': `token ${token}`
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



exports.apis.createHook.func = async ([userId, repo]) => {
  try {
    const [client, owner] = await getClient(userId);
    const config = {
      url: 'https://www.snapmaster.io/githubhook',
      content_type: 'json',
    };

    const hook = await client.repos.createHook({
      owner,
      repo,
      config
    });

    return [hook];
  } catch (error) {
    await error.response;
    console.log(`createHook: caught exception: ${error}`);
    return null;
  }
};

exports.apis.getActiveRepos.func = async ([userId]) => {
  try {
    const repos = await dal.getData(userId, exports.apis.getAllRepos, [userId], false, false);
    const data = repos.filter(r => r[dbconstants.metadataActiveFlag]);
    return data;
  } catch (error) {
    await error.response;
    console.log(`getActiveRepos: caught exception: ${error}`);
    return null;
  }
};

exports.apis.getAllRepos.func = async ([userId]) => {
  try {
    const [client] = await getClient(userId);
    const repos = await client.repos.list();

    // store / return only a subset of the fields in the repo payload
    const data = repos.data.map(r => {
      return {
        id: r.id,
        name: r.name,
        full_name: r.full_name,
        fork: r.fork,
        private: r.private,
        url: r.url,
        html_url: r.html_url
      }
    });
    return data;
  } catch (error) {
    await error.response;
    console.log(`getAllRepos: caught exception: ${error}`);
    return null;
  }
};

// get the github client
const getClient = async (userId) => {
  try {
    const user = await githubauth.getGithubAccessInfo(userId);
    const owner = user && user.userId;
    const accessToken = user && user.accessToken;

    if (!accessToken || !owner) {
      console.log('getClient: getGithubAccessToken failed');
      return null;
    }

    const octokit = new Octokit({
      auth: accessToken
    });

    return [octokit, owner];
  } catch (error) {
    await error.response;
    console.log(`getClient: caught exception: ${error}`);
    return null;
  }
}

const getToken = async (connectionInfo) => {
  try {
    const accessToken = connectionInfo && connectionInfo.accessToken;

    if (!accessToken) {
      console.log('getToken: could not find access token in connection info');
      return null;
    }
    return accessToken;
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
const createWebhookListener = () => {
  // if in dev mode, install the eventsource proxy for the dev environment, to receive webhooks via smee.io
  if (environment.getDevMode()) {
    const webhookProxyUrl = "https://smee.io/aRW11TsA1USoXCWb"; 
    const source = new EventSource(webhookProxyUrl);
    source.onmessage = event => {
      try {
        const webhookEvent = JSON.parse(event.data);

        // verify the signature against the body and the secret
        const secret = githubConfig.github_client_id;          
        if (!verify(secret, webhookEvent.body, webhookEvent['x-hub-signature'])) {
          console.error('githubWebhook: signature does not match event payload & secret');
          return;
        }
        
        // dispatch the webhook payload to the handler
        handleWebhook(null, null, webhookEvent["x-github-event"], webhookEvent.body);
      } catch (error) {
        console.error(`eventSource/githubWebhook: caught exception ${error}`);
      }
    };  
  }
}