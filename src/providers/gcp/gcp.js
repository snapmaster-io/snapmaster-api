// GCP provider

// exports:
//   apis.
//
//   createHandlers(app, [middlewaree]): create all route handlers
// 
//   provider: provider name
//   image: provider image url (local to SPA)
//   type: provider type (simple or link)
//   definition: provider definition

const axios = require('axios');
const { execAsync } = require('../../modules/execasync');
const googleauth = require('../../services/googleauth');
const provider = require('../provider');
const requesthandler = require('../../modules/requesthandler');
const environment = require('../../modules/environment');

const providerName = 'gcp';

// get GCP configuration
const gcpConfig = environment.getConfig(providerName);

exports.provider = providerName;
exports.image = `/${providerName}-logo.png`;
exports.type = provider.simpleProvider;
exports.definition = provider.getDefinition(providerName);
exports.getAccessInfo = googleauth.getGoogleAccessToken;

// api's defined by this provider
exports.apis = {
  getProjects: {
    name: 'getProjects',
    provider: 'google-oauth2',
    entity: 'google-oauth2:projects',
    arrayKey: 'projects',
    itemKey: 'projectId'
  },
};

exports.createHandlers = (app) => {
  // Get GCP projects endpoint
  app.get('/gcp', requesthandler.checkJwt, requesthandler.processUser, function(req, res){
    const refresh = req.query.refresh || false;  

    requesthandler.getData(
      res, 
      req.userId, 
      exports.apis.getProjects, 
      null,     // default entity name
      [req.userId], // parameter array
      refresh);
  });    
}

exports.invokeAction = async (connectionInfo, activeSnapId, param) => {
  try {
    // get required parameters
    const action = param.action;
    if (!action) {
      console.error('invokeAction: missing required parameter "action"');
      return null;
    }

    const project = param.project;
    if (!project) {
      console.error('invokeAction: missing required parameter "project"');
      return null;
    }

    // IMPLEMENTATION NOTE:
    //   current implementation shell-execs gcloud SDK commands, because the REST API for 
    //   google cloud build and google cloud run is pretty gnarly, and the node.js packages 
    //   are either difficult to use or nonexistent.

    // set up the environment
    const serviceCredentials = await getServiceCredentials(connectionInfo);
    if (!serviceCredentials) {
      console.error(`invokeAction: service credentials not found`);
      return null;
    }

    // construct script name, environment, and full command
    const script = `./src/providers/${providerName}/${action}.sh`;
    const env = getEnvironment(param);
    const command = `ACTIVESNAPID=${activeSnapId} SERVICECREDS='${serviceCredentials}' ${env} ${script}`;

    // log a message before executing command
    console.log(`executing command: ${script}`);

    // execute the action and obtain the output
    const output = await executeCommand(command);

    // log a message after executing command
    console.log(`finished executing command: ${script}: return value ${output && output.code}`);
        
    return output;
  } catch (error) {
    console.log(`invokeAction: caught exception: ${error}`);
    return null;
  }
}

exports.apis.getProjects.func = async ([userId]) => {
  try {
    const accessToken = await googleauth.getGoogleAccessToken(userId);
    if (!accessToken) {
      console.log('getProjects: getGoogleAccessToken failed');
      return null;
    }

    //const apiKey = gcpConfig.google_client_id;
    const apiKey = 'AIzaSyB3vyXRLTezNsrGMTskFTTXUY3FVXpLOyE'; //AIzaSyAa8yy0GdcGPHdtD083HiGGx_S0vMPScDM';
    const url = `https://cloudresourcemanager.googleapis.com/v1/projects?key=${apiKey}`;
    const headers = { 
      'content-type': 'application/json',
      'authorization': `Bearer ${accessToken}`
      //'authorization': 'Bearer ya29.a0Adw1xeWFLiUaL2fUo98E45Mz8mAZThgw0bSjQp_vIcKhLtSXhx5OQtrfe8u3eIheEk2sso_S570b_UeGq3WfMxPS0rFPtpYpoBDUxYF5asLlTeOQBw_S_3fiLj8FMaD9CUa0Z5ffqStZQyzZMCT3v7cAsSdr1ozrZT2Ox-7h0S8'
     };

    const response = await axios.get(
      url,
      {
        headers: headers
      });

      // response received successfully
    return response.data;
  } catch (error) {
    await error.response;
    console.log(`getCalendarData: caught exception: ${error}`);
    return null;
  }
}

const executeCommand = async (command) => {
  try {
    // execute asynchronously so as to not block the web thread
    const returnVal = await execAsync(command);
    return returnVal;
  } catch (error) {
    console.error(`executeCommand: caught exception: ${error}`);
    return error;
  }
}

const getEnvironment = (param) => {
  let env = '';
  for (const key in param) {
    env += `${key.toUpperCase()}=${param[key]} `;
  }
  return env;
}

const getServiceCredentials = async (connectionInfo) => {
  try {
    const key = connectionInfo && connectionInfo.find(c => c.name === 'key');
    if (!key) {
      console.error('getServiceCredentials: could not find key in connection info');
      return null;
    }

    return key.value;
  } catch (error) {
    console.error(`getServiceCredentials: caught exception: ${error}`);
    return null;
  }
}
