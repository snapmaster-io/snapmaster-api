// github provider

// exports:
//   apis.
//        createHook(userId, repo): create a webhook
//        deleteHook(userId, repo, hook): get page reviews
//        getActiveRepos(userId): get active repos for this user
//        getAllRepos(userId): get all repos for this user
//
//   createHandlers(app, [middlewaree]): create all route handlers
//   createTrigger(userId, activeSnapId, params): create a trigger (webhook)
//
//   provider: provider name
//   image: provider image url (local to SPA)
//   type: provider type (simple or link)
//   definition: provider definition

const axios = require('axios');
const githubauth = require('../services/githubauth');
const dbconstants = require('../data/database-constants');
const dal = require('../data/dal');
const provider = require('./provider');
const requesthandler = require('../modules/requesthandler');
const environment = require('../modules/environment');
const snapengine = require('../snap/snap-engine');

const { Octokit } = require('@octokit/rest');
const WebhooksApi = require('@octokit/webhooks');
const EventSource = require('eventsource');
const webhooks = new WebhooksApi({
  secret: 'mysecret'
});

const providerName = 'github';

exports.provider = providerName;
exports.image = `/${providerName}-logo.png`;
exports.type = provider.linkProvider;
exports.definition = provider.getDefinition(providerName);

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

// install the eventsource proxy for the dev environment, to receive webhooks via smee.io
if (environment.getDevMode()) {
  const webhookProxyUrl = "https://smee.io/aRW11TsA1USoXCWb"; // replace with your own Webhook Proxy URL
  const source = new EventSource(webhookProxyUrl);
  source.onmessage = event => {
    webhooks.on("*", ({ id, name, payload }) => {
      handleWebhook(null, null, id, name, payload);
    });    
  
    const webhookEvent = JSON.parse(event.data);
    webhooks
      .verifyAndReceive({
        id: webhookEvent["x-request-id"],
        name: webhookEvent["x-github-event"],
        signature: webhookEvent["x-hub-signature"],
        payload: webhookEvent.body
      })
      .catch(console.error);
  };  
}

/*
// create some github stuff
var createApp = require('github-app');

var githubApp = createApp({
  id: process.env.APP_ID,
  cert: require('fs').readFileSync('private-key.pem')
});

handler.on('issues', function (event) {
  if (event.payload.action === 'opened') {
    var installation = event.payload.installation.id;

    githubApp.asInstallation(installation).then(function (github) {
      github.issues.createComment({
        owner: event.payload.repository.owner.login,
        repo: event.payload.repository.name,
        number: event.payload.issue.number,
        body: 'Welcome to the robot uprising.'
      });
    });
  }
});
*/

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

  // Github webhooks endpoint - called by github
  app.use('/github/webhooks/:userId/:activeSnapId', webhooks.middleware, function(req, res){
    const userId = decodeURI(req.params.userId);
    const activeSnapId = req.params.activeSnapId;

    webhooks.on("*", ({ id, name, payload }) => {
      handleWebhook(userId, activeSnapId, id, name, payload);
    });    
  });  
}

exports.createTrigger = async (userId, activeSnapId, params) => {
  try {
    const [repoParam, eventParam] = params;

    // validate params
    if (repoParam.name !== 'repo') {
      console.error(`createTrigger: parameter mismatch - expected ${parameterNameRepo}, received ${repoParam.name}`);
      return null;
    }

    const [client] = await getClient(userId);

    const [owner, repo] = repoParam.value.split('/');
    if (!owner || !repo) {
      console.error(`createTrigger: repo must be in owner/name format; received ${repoParam.value}`);
      return null;
    }

    let url = encodeURI(`${environment.getUrl()}/github/webhooks/${userId}/${activeSnapId}`);

    // if in dev mode, create the hook through smee.io 
    if (environment.getDevMode()) {
      url = 'https://smee.io/aRW11TsA1USoXCWb';
    }

    // create the hook
    const config = {
      url: url,
      secret: 'mysecret', // BUGBUG
      content_type: 'json',
    };

    const hook = await client.repos.createHook({
      owner,
      repo,
      config
    });

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

exports.deleteTrigger = async (userId, triggerData) => {
  try {
    // validate params
    if (!triggerData || !triggerData.url) {
      console.log(`deleteTrigger: invalid trigger data`);
      return null;
    }

    const token = await getToken(userId);
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

    const [client] = await getClient(userId);
    const hook = await client.repos.deleteHook({
      owner,
      repo,
      hook_id: id
    });

    const data = {
      id: hook.id,
      url: hook.url
    }

    return data;
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

const getToken = async (userId) => {
  try {
    const user = await githubauth.getGithubAccessInfo(userId);
    const accessToken = user && user.accessToken;

    if (!accessToken) {
      console.log('getToken: getGithubAccessToken failed');
      return null;
    }
    return accessToken;
  } catch (error) {
    console.log(`getClient: caught exception: ${error}`);
    return null;
  }
}

// handle an incoming webhook request
const handleWebhook = (userId, activeSnapId, id, name, payload) => {
  console.log(`userId: ${userId}; activeSnapId: ${activeSnapId}; name: ${name}; id: ${id} event received`);
  snapengine.executeSnap(userId, activeSnapId, [name, payload]);
}
