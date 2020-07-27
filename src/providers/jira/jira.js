// JIRA provider

// exports:
//   createHandlers(app): create all route handlers
//   invokeAction(providerName, connectionInfo, activeSnapId, param): invoke an action
//
//   name: provider name
//   definition: provider definition

const axios = require('axios');
const provider = require('../provider');
const config = require('../../modules/config');
const oauth = require('../../modules/oauth');
const { successvalue, errorvalue } = require('../../modules/returnvalue');

const providerName = 'jira';
const entityName = `${providerName}:accounts`;

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
}

exports.invokeAction = async (providerName, connectionInfo, activeSnapId, param) => {
  try {
    // validate params
    const account = param[entityName];
    if (!account) {
      const message = `missing required parameter "account"`;
      console.error(`invokeAction: ${message}`);
      return errorvalue(message);
    }
    const action = param.action;
    if (!action) {
      const message = `missing required parameter "action"`;
      console.error(`invokeAction: ${message}`);
      return errorvalue(message);
    }
    const project = param.project;
    if (!project) {
      const message = `missing required parameter "project"`;
      console.error(`invokeAction: ${message}`);
      return errorvalue(message);
    }
    const summary = param.summary;
    if (!summary) {
      const message = `missing required parameter "summary"`;
      console.error(`invokeAction: ${message}`);
      return errorvalue(message);
    }

    if (action !== 'create-issue') {
      const message = `unknown action "${action}"`;
      console.error(`invokeAction: ${message}`);
      return errorvalue(message);
    }

    const accountID = account.id;
    if (!accountID) {
      const message = `could not find account ID`;
      console.error(`invokeAction: ${message}`);
      return errorvalue(message);
    }

    console.log(`${providerName}: account ${param.account}, action ${action}, project ${project}, summary ${summary}`);

    // get token for calling API from the default creds
    const token = await getToken(connectionInfo);
    if (!token) {
      const message = `no authorization token`;
      console.error(`invokeAction: ${message}`);
      return errorvalue(message);
    }

    const url = `https://api.atlassian.com/ex/jira/${accountID}/rest/api/3/issue`;
    const headers = { 
      'content-type': 'application/json',
      'authorization': `Bearer ${token}`
    };

    // find the right issue type from the issue metadata in the account information
    const proj = account.issueMetadata && account.issueMetadata.projects && account.issueMetadata.projects.find(p => p.key === project);
    if (!proj) {
      const message = `count not find project ${project}`;
      console.error(`invokeAction: ${message}`);
      return errorvalue(message);
    }
    const issueType = proj.issuetypes && proj.issuetypes.find(i => i.name === "Bug");
    if (!issueType) {
      const message = `count not find the Bug issue type`;
      console.error(`invokeAction: ${message}`);
      return errorvalue(message);
    }
    const bugIssueType = issueType.id;

    const body = JSON.stringify({
      fields: {
        summary,
        project: {
          key: project,
        },
        issuetype: {
          id: bugIssueType,
        }
      },
    });

    const response = await axios.post(
      url,
      body,
      {
        headers: headers
      });

    return successvalue(response.data);
  } catch (error) {
    console.error(`invokeAction: caught exception: ${error}`);
    const errorData = error.response && error.response.data && error.response.data.errors;
    for (const msg of Object.keys(errorData)) {
      console.error(`jira API error: ${msg}: ${errorData[msg]}`);
    }
    return errorvalue(error.message, errorData);
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

    // get the account info
    const accountInfo = accountArray.find(a => a.name === account) || accountArray[0];
    if (!accountInfo) {
      console.error(`getAccountInfo: could not retrieve account information`);
      return null;
    }

    // get the issue metadata for the account
    const issueMetadata = await getIssueMetadata(connectionInfo, accountInfo);
    if (!issueMetadata) {
      console.error(`getAccountInfo: could not retrieve issue metadata`);
      return null;
    }

    // store the issue metadata
    accountInfo.issueMetadata = issueMetadata;

    // return the account information
    return accountInfo;
  } catch (error) {
    console.error(`getAccountInfo: caught exception: ${error}`);
    return null;
  }
}

const getIssueMetadata = async (connectionInfo, account) => {
  try {
    const accountID = account.id;
    if (!accountID) {
      console.error(`getIssueMetadata: could not find account ID`);
      return null;
    }

    // get token for calling API from the default creds
    const token = await getToken(connectionInfo);
    if (!token) {
      console.error('getIssueMetadata: no authorization token');
      return null;
    }

    const url = `https://api.atlassian.com/ex/jira/${accountID}/rest/api/3/issue/createmeta`;
    const headers = { 
      'content-type': 'application/json',
      'authorization': `Bearer ${token}`
    };

    const response = await axios.get(
      url,
      {
        headers: headers
      });

    return response.data;  
  } catch (error) {
    console.error(`getIssueMetadata: caught exception: ${error}`);
    const msgs = error.response && error.response.data && error.response.data.errorMessages;
    if (msgs) {
      for (const msg of msgs) {
        console.error(`jira API error: ${msg}`);
      }  
    }
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