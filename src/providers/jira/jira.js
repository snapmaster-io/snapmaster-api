// JIRA provider

// exports:
//   createHandlers(app): create all route handlers
//   invokeAction(providerName, connectionInfo, activeSnapId, param): invoke an action
//
//   provider: provider name
//   image: provider image url (local to SPA)
//   type: provider type (simple or link)
//   definition: provider definition

const axios = require('axios');
const provider = require('../provider');
const config = require('../../modules/config');
const oauth = require('../../modules/oauth');

const providerName = 'jira';
const entityName = `${providerName}:accounts`;

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
};

exports.createHandlers = (app) => {
}

exports.invokeAction = async (providerName, connectionInfo, activeSnapId, param) => {
  try {
    // validate params
    const account = param[entityName];
    if (!account) {
      console.error(`invokeAction: missing required parameter "account"`);
      return null;
    }
    const action = param.action;
    if (!action) {
      console.error(`invokeAction: missing required parameter "action"`);
      return null;
    }
    const project = param.project;
    if (!project) {
      console.error(`invokeAction: missing required parameter "project"`);
      return null;
    }
    const summary = param.summary;
    if (!summary) {
      console.error(`invokeAction: missing required parameter "summary"`);
      return null;
    }
    const accountID = account.id;
    if (!accountID) {
      console.error(`createTrigger: could not find account ID`);
      return null;
    }

    console.log(`${providerName}: account ${param.account}, action ${action}, project ${project}, summary ${summary}`);

    // get token for calling API from the default creds
    const token = await getToken(connectionInfo);
    if (!token) {
      console.error('invokeAction: no authorization token');
      return null;
    }

    const url = `https://api.atlassian.com/ex/jira/${accountID}/rest/api/3/issue`;
    const headers = { 
      'content-type': 'application/json',
      'authorization': `Bearer ${token}`
    };

    const body = JSON.stringify({
      fields: {
        summary,
        project: {
          key: project,
        },
        issuetype: {
          id: "10003",
        }
      },
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

// this function is called when a new entity (e.g. account) is added
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
    if (!entity.account) {
      console.error('entityHandler: did not receive account name');
      return null;
    }
    if (!defaultConnectionInfo) {
      console.error('entityHandler: did not receive authorization information');
      return null;
    }

    // get the account ID associated with the service name
    const accountInfo = await getAccountInfo(defaultConnectionInfo, entity.account);
    if (!accountInfo) {
      console.error(`entityHandler: could not find account ${entity.account}`);
      return null;
    }

    // add the entity attributes to the result
    const result = { 
      secret: {
        ...entity, 
        ...accountInfo,
        ...defaultConnectionInfo, 
      },
      __id: entity.account,
      __name: entity.account,
      __url: `${accountInfo.url}`,
      __triggers: exports.definition.triggers,
      __actions: exports.definition.actions,
    };

    return result;
  } catch (error) {
    await error.response;
    console.log(`entityHandler: caught exception: ${error}`);
    return null;
  }
}

const getAccountInfo = async (connectionInfo, account) => {
  try {
    const token = await getToken(connectionInfo);
    if (!token) {
      console.error('getAccountInfo: could not obtain token');
      return null;
    }

    const urlBase = `https://api.atlassian.com/oauth/token/accessible-resources`;

    const headers = { 
      'content-type': 'application/json',
      'authorization': `Bearer ${token}`
     };

    const response = await axios.get(
      urlBase,
      {
        headers: headers
      });

    // check for empty response 
    const accountArray = response.data;
    if (!accountArray || !accountArray.length) {
      return null;
    }

    // return the first object in the response array
    const accountInfo = accountArray.find(a => a.name === account);
    if (accountInfo) {
      return accountInfo;
    } else {
      return accountArray[0];
    }
  } catch (error) {
    console.error(`getAccountInfo: caught exception: ${error}`);
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

/*
const getToken = async (connectionInfo) => {
  try {
    const token = connectionInfo.token || connectionInfo.access_token;
    if (!token) {
      console.error('getToken: token not found');
      return null;
    }    
    return token;
  } catch (error) {
    console.log(`getToken: caught exception: ${error}`);
    return null;
  }
}
*/