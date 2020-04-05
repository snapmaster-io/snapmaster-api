// Docker provider

// exports:
//   createHandlers(app): create all route handlers
//   createTrigger(connectionInfo, userId, activeSnapId, params): create a trigger (webhook)
//   deleteTrigger(connectionInfo, triggerData): delete a trigger (webhook)
// 
//   entities.
//        accounts - the accounts entity
// 
//   provider: provider name
//   image: provider image url (local to SPA)
//   type: provider type (simple or link)
//   definition: provider definition

const axios = require('axios');
const provider = require('../provider');
const snapengine = require('../../snap/snap-engine');
const environment = require('../../modules/environment');

const providerName = 'docker';
const entityName = 'docker:accounts';

exports.provider = providerName;
exports.image = `/${providerName}-logo.png`;
exports.type = provider.simpleProvider;
exports.definition = provider.getDefinition(providerName);

// entities defined by this provider
exports.entities = {};
exports.entities[entityName] = {
  entity: entityName,
  provider: providerName,
  itemKey: '__id',
  keyFields: ['password', 'token'],
};

exports.createHandlers = (app) => {  
  // Docker webhooks endpoint - called by dockerhub
  app.post('/docker/webhooks/:userId/:activeSnapId', function(req, res){
    try {
      const userId = decodeURI(req.params.userId);
      const activeSnapId = req.params.activeSnapId;
      console.log(`POST /docker/webhooks: userId ${userId}, activeSnapId ${activeSnapId}`);

      // dispatch the webhook payload to the handler
      handleWebhook(userId, activeSnapId, "push", req.body);
      res.status(200).send();
    } catch (error) {
      console.error(`dockerWebhook caught exception: ${error}`);
      res.status(500).send(error);
    }
  });
}

exports.createTrigger = async (connectionInfo, userId, activeSnapId, param) => {
  try {
    // validate params
    const repoName = param.repo;
    if (!repoName) {
      console.error(`createTrigger: missing required parameter "repo"`);
      return null;
    }

    const [owner, repo] = repoName.split('/');
    if (!owner || !repo) {
      console.error(`createTrigger: repo must be in owner/name format; received ${repoName}`);
      return null;
    }

    const hook = encodeURI(`${environment.getUrl()}/docker/webhooks/${userId}/${activeSnapId}`);
    const body = {
      name: `SnapMaster-${activeSnapId}`,
      expect_final_callback: false,
      webhooks: [{
        name: `SnapMaster-${activeSnapId}`,
        hook_url: hook,  
      }],
      registry: "registry-1.docker.io"
    };
  
    const token = await getToken(connectionInfo);
    if (!token) {
      console.error('createTrigger: could not obtain token');
      return null;
    }

    const headers = { 
      'content-type': 'application/json',
      'authorization': `JWT ${token}`
    };

    const url = `https://hub.docker.com/v2/repositories/${owner}/${repo}/webhook_pipeline/`;
    const response = await axios.post(
      url,
      body,
      {
        headers: headers
      });

    const data = response.data;

    // construct trigger data from returned hook info
    const triggerData = {
      id: data.slug,
      name: data.name,
      url: `${url}${data.slug}/`
    }

    return triggerData;
  } catch (error) {
    console.log(`createTrigger: caught exception: ${error}`);
    return null;
  }
}

exports.deleteTrigger = async (connectionInfo, triggerData) => {
  try {
    // validate params
    if (!triggerData || !triggerData.url) {
      console.log(`deleteTrigger: invalid trigger data`);
      return null;
    }

    const token = await getToken(connectionInfo);
    const headers = { 
      'content-type': 'application/json',
      'authorization': `JWT ${token}`
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

exports.entities[entityName].func = async ([connectionInfo]) => {
  try {
    // construct an object with all entity info
    const entity = {};
    for (const param of connectionInfo) {
      entity[param.name] = param.value;
    }

    // verify we have everything we need to authenticate
    if (!entity.username || !entity.password) {
      console.error('entityHandler: did not receive all authorization information');
      return null;
    }

    // get a long-lived access token
    const token = await getToken(connectionInfo);
    if (!token) {
      console.error('entityHandler: authorization failure');
      return null;
    }

    // add the entity attributes to the result
    const result = { 
      ...entity, 
      token: token, 
      __id: entity.username,
      __name: entity.username,
      __url: `https://hub.docker.com/u/${entity.username}`,
      __triggers: exports.definition.triggers,
      __actions: exports.definition.actions,
    };

    return [result];
  } catch (error) {
    await error.response;
    console.log(`entityHandler: caught exception: ${error}`);
    return null;
  }
}

const getToken = async (connectionInfo) => {
  try {
    // extract username and password from profile
    const username = connectionInfo.find(p => p.name === 'username');
    if (!username || !username.value) {
      console.error('getToken: username not found');
      return null;
    }

    const password = connectionInfo.find(p => p.name === 'password');
    if (!password || !password.value) {
      console.error('getToken: password not found');
      return null;
    }

    const url = 'https://hub.docker.com/v2/users/login/';
    const response = await axios.post(
      url,
      { "username": username.value, "password": password.value },
      { 'content-type': 'application/json' }
    );

    const data = response.data;
    return data && data.token;
  } catch (error) {
    console.log(`getToken: caught exception: ${error}`);
    return null;
  }
}

// handle an incoming webhook request
const handleWebhook = (userId, activeSnapId, name, payload) => {
  snapengine.executeSnap(userId, activeSnapId, [name], payload);
}

