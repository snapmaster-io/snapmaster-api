// Docker provider

// exports:
//   createHandlers(app): create all route handlers
//   createTrigger(providerName, connectionInfo, userId, activeSnapId, params): create a trigger (webhook)
//   deleteTrigger(providerName, connectionInfo, triggerData): delete a trigger (webhook)
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
const snapengine = require('../../snap/snapengine');
const environment = require('../../modules/environment');

const providerName = 'docker';
const entityName = `${providerName}:accounts`;
const defaultEntityName = `${entityName}:default`;

exports.provider = providerName;
exports.image = `/${providerName}-logo.png`;
exports.definition = provider.getDefinition(providerName);
exports.type = exports.definition.connection && exports.definition.connection.type;

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

exports.createTrigger = async (providerName, defaultConnectionInfo, userId, activeSnapId, param) => {
  let repoName;
  try {
    // validate params
    const account = param.account;
    if (!account) {
      const message = 'missing required parameter "account"';
      console.error(`createTrigger: ${message}`);
      return message;
    }
    repoName = param.repo;
    if (!repoName) {
      const message = 'missing required parameter "repo"';
      console.error(`createTrigger: ${message}`);
      return message;
    }

    const [owner, repo] = repoName.split('/');
    if (!owner || !repo) {
      const message = `repo must be in owner/name format; received ${repoName}`;
      console.error(`createTrigger: ${message}`);
      return message;
    }

    const hookUrl = encodeURI(`${environment.getUrl()}/docker/webhooks/${userId}/${activeSnapId}`);
    const body = {
      name: `SnapMaster-${activeSnapId}`,
      expect_final_callback: false,
      webhooks: [{
        name: `SnapMaster-${activeSnapId}`,
        hook_url: hookUrl,  
      }],
      registry: "registry-1.docker.io"
    };
  
    // get token for calling API (either from the default account in connection info, or the account passed in)
    const token = await getToken(
      account === defaultEntityName ? 
        defaultConnectionInfo :
        param[entityName]
    );
    if (!token) {
      console.error('createTrigger: could not obtain token');
      return null;
    }

    const headers = { 
      'content-type': 'application/json',
      'authorization': `JWT ${token}`
    };

    const url = `https://hub.docker.com/v2/repositories/${owner}/${repo}/webhook_pipeline/`;
    const hook = await axios.post(
      url,
      body,
      {
        headers: headers
      });

    // check for empty response
    if (!hook || !hook.data || !hook.data.slug) {
      const message = 'did not receive proper webhook information';
      console.error(`createTrigger: ${message}`);
      return message;
    }

    // construct trigger data from returned hook info
    const triggerData = {
      id: hook.data.slug,
      name: hook.data.name,
      url: `${url}${hook.data.slug}/`,
    }

    return triggerData;
  } catch (error) {
    console.log(`createTrigger: caught exception: ${error}`);
    if (error.response.status === 404) {
      return `${error.message}: unknown repo or insufficient privileges to create webhook on repo ${repoName}`
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
    
    // validate trigger data
    if (!triggerData || !triggerData.url) {
      console.log(`deleteTrigger: invalid trigger data`);
      return null;
    }

    // get token for calling API (either from the default account in connection info, or the account passed in)
    const token = await getToken(
      account === defaultEntityName ? 
        defaultConnectionInfo :
        param[entityName]
    );
    if (!token) {
      console.error('deleteTrigger: could not obtain token');
      return null;
    }

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
    if (!entity.username || !entity.password) {
      console.error('entityHandler: did not receive all authorization information');
      return null;
    }

    // get a long-lived access token
    const token = await getToken(entity);
    if (!token) {
      console.error('entityHandler: authorization failure');
      return null;
    }

    // add the entity attributes to the result
    const result = { 
      secret: {
        ...entity, 
        token: token, 
      },
      __id: entity.username,
      __name: entity.username,
      __url: `https://hub.docker.com/u/${entity.username}`,
    };

    return result;
  } catch (error) {
    await error.response;
    console.log(`entityHandler: caught exception: ${error}`);
    return null;
  }
}

const getToken = async (connectionInfo) => {
  try {
    // check whether an unexpired token already exists in the connection info
    if (connectionInfo.token && 
        connectionInfo.expiresAt && 
        !tokenExpired(connectionInfo.expiresAt)) {
      // return the unexpired token
      return token;
    }

    // extract username and password from profile
    const username = connectionInfo.username;
    if (!username) {
      console.error('getToken: username not found');
      return null;
    }

    const password = connectionInfo.password;
    if (!password) {
      console.error('getToken: password not found');
      return null;
    }

    const url = 'https://hub.docker.com/v2/users/login/';
    const response = await axios.post(
      url,
      { "username": username, "password": password },
      { 'content-type': 'application/json' }
    );

    const data = response.data;

    // store the token and expiration info
    if (data && data.token) {
      connectionInfo.token = data.token;
      connectionInfo.expiresAt = Date.now();
    }    

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

// calculate whether an token has expired based on this provider
const tokenExpired = (expiresAt) => {
  try {
    const now = Date.now();
    if (expiresAt > now) {
      return false;
    }
    return true;
  } catch (error) {
    console.log(`tokenExpired: caught exception: ${error}`);
    return true;
  }
}
