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
const { mkdir, cd, rm, echo, exec, tempdir } = require('shelljs');
const googleauth = require('../../services/googleauth');
const provider = require('../provider');
const database = require('../../data/database');
const requesthandler = require('../../modules/requesthandler');
const environment = require('../../modules/environment');

const providerName = 'gcp';

const actions = {
  build: 'build',
  deploy: 'deploy'
}

// get GCP configuration
const gcpConfig = environment.getConfig(providerName);

exports.provider = providerName;
exports.image = `/${providerName}-logo.png`;
exports.type = provider.simpleProvider;
exports.definition = provider.getDefinition(providerName);

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

exports.invokeAction = async (userId, activeSnapId, param) => {
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

    console.log(`gcp: action ${action} project ${project}`);

    // IMPLEMENTATION NOTE:
    //   current implementation shell-execs gcloud SDK commands, because the REST API for 
    //   google cloud build and google cloud run is pretty gnarly, and the node.js packages 
    //   are either difficult to use or nonexistent.

    // set up the environment
    const serviceCredentials = await getServiceCredentials(userId);
    if (!serviceCredentials) {
      console.error(`invokeAction: service credentials not found`);
      return null;
    }

    // set up the environment
    await setupEnvironment(serviceCredentials, activeSnapId, param);

    // get the command to execute
    const command = getCommand(action, param);
    if (!command) {
      return null;
    }

    // execute the action and obtain the output
    const output = await executeCommand(command);

    // tear down the environment
    await teardownEnvironment(activeSnapId);

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
    console.log(`executing command: ${command}`);
    const returnVal = exec(command, { silent: true });
    return returnVal;  
  } catch (error) {
    console.error(`executeCommand: caught exception: ${error}`);
    return null;
  }
}

const getCommand = (action, param) => {
  try {
    const project = param.project;
    if (!project) {
      console.error(`getCommand: action ${action} requires project name`);
      return null;
    }
    const image = param.image;
    if (!image) {
      console.error(`getCommand: action ${action} requires image name`);
      return null;
    }

    // return the right shell command to exec for the appropriate action
    switch (action) {
      case actions.build:
        return `gcloud builds submit --tag gcr.io/${project}/${image}`;
      case actions.deploy: 
        const service = param.service;
        if (!service) {
          console.error(`getCommand: action ${action} requires service name`);
          return null;
        }
        return `gcloud run deploy ${service} --image gcr.io/${project}/${image} --platform managed`;
      default:
        console.error(`getCommand: unknown command ${action}`);
        return null;
    }
  } catch (error) {
    console.error(`getCommand: caught exception: ${error}`);
    return null;
  }
}

const getServiceCredentials = async (userId) => {
  const user = await database.getUserData(userId, providerName);
  if (!user) {
    console.error('getServiceCredentials: could not find provider section');
    return null;
  }

  const key = user.connectionInfo && user.connectionInfo.find(c => c.name === 'key');
  if (!key) {
    console.error('getServiceCredentials: could not find key in connection info');
    return null;
  }

  return key.value;
}

const setupEnvironment = async (serviceCredentials, activeSnapId, param) => {
  // get project ID
  const project = param.project;
  if (!project) {
    console.error(`setupEnvironment: requires project name`);
    return null;
  }
  
  // create temporary directory
  const tmp = tempdir();
  const dirName = `${tmp}/${activeSnapId}`;
  mkdir(dirName);
  cd(dirName)

  // create creds.json file
  echo(serviceCredentials).to('creds.json');

  // execute the gcloud auth call
  const output = exec(`gcloud auth activate-service-account snapmaster@${project}.iam.gserviceaccount.com --key-file=creds.json --project=${project}`);  
  return output;
}

const teardownEnvironment = async (activeSnapId) => {
  // remove temporary directory and everything in it
  const tmp = tempdir();
  const dirName = `${tmp}/${activeSnapId}`;
  rm('-rf', dirName);
}