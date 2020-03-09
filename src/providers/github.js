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

const githubauth = require('../services/githubauth');
const dbconstants = require('../data/database-constants');
const dal = require('../data/dal');
const provider = require('./provider');
const requesthandler = require('../modules/requesthandler');
const environment = require('../modules/environment');
const { Octokit } = require("@octokit/rest");

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

/*
const githubHandler = require('github-webhook-handler');

// set up github webhook middleware
const handler = githubHandler({
  path: '/event_handler',
  secret: 'abc123..'
});

handler.on('issues', function (event) {
  console.log('Received an issue event for %s action=%s: #%d %s',
    event.payload.repository.name,
    event.payload.action,
    event.payload.issue.number,
    event.payload.issue.title)
});

// enable the github webhook middleware
app.use(handler);
*/

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
}

exports.createTrigger = async (userId, activeSnapId, params) => {
  try {
    const [repo, event] = params;
    const client = await getClient(userId);
    const config = {
      url: `${environment.getUrl()}/githubhook/${userId}/${activeSnapId}`,
      content_type: 'json',
    };

    const hook = await client.repos.createHook({
      owner,
      repo,
      event: [event],
      config
    });

    return hook;
  } catch (error) {
    console.log(`createTrigger: caught exception: ${error}`);
    return null;
  }
}

exports.apis.createHook.func = async ([userId, repo]) => {
  try {
    const client = await getClient(userId);
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
    const client = await getClient(userId);
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

const getClient = async (userId) => {
  try {
    const user = await githubauth.getGithubAccessInfo(userId);
    const owner = user && user.userId;
    const accessToken = user && user.accessToken;

    if (!accessToken || !owner) {
      console.log('getAllRepos: getGithubAccessToken failed');
      return null;
    }

    const octokit = new Octokit({
      auth: accessToken
    });

    return octokit;
  } catch (error) {
    await error.response;
    console.log(`getClient: caught exception: ${error}`);
    return null;
  }
}