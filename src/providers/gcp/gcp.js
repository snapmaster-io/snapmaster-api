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
// const { mkdir, cd, rm, exec, echo, tempdir } = require('shelljs');
// const { execAsync } = require('../../modules/execasync');
const googleauth = require('../../services/googleauth');
const provider = require('../provider');
const requesthandler = require('../../modules/requesthandler');
const database = require('../../data/database');
//const environment = require('../../modules/environment');

const providerName = 'gcp';

// get GCP configuration
//const gcpConfig = environment.getConfig(providerName);

exports.provider = providerName;
exports.image = `/${providerName}-logo.png`;
exports.type = provider.hybridProvider;
exports.definition = provider.getDefinition(providerName);
exports.getAccessInfo = googleauth.getGoogleAccessToken;

// invokeAction is implemented by a separate service
exports.invokeAction = provider.invokeAction;  

/*
const actions = {
  build: 'build',
  deploy: 'deploy'
}
*/

// api's defined by this provider
exports.apis = {
  addProject: {
    name: 'addProject',
    provider: 'gcp',
    entity: 'gcp:projects',
    itemKey: 'project'
  },
  getProjects: {
    name: 'getProjects',
    provider: 'gcp',
    entity: 'gcp:projects',
    itemKey: 'project'
  },
  getProject: {
    name: 'getProject',
    provider: 'gcp',
    itemKey: 'project',
  },
  removeProject: {
    name: 'removeProject',
    provider: 'gcp',
    entity: 'gcp:projects',
    itemKey: 'project'
  },
  getAuthorizedProjects: {
    name: 'getAuthorizedProjects',
    provider: 'google-oauth2',
    entity: 'google-oauth2:projects',
    arrayKey: 'projects',
    itemKey: 'projectId'
  },
};

exports.createHandlers = (app) => {
  // Get GCP projects endpoint
  app.get('/gcpprojects', requesthandler.checkJwt, requesthandler.processUser, function(req, res){
    const refresh = req.query.refresh || false;  

    requesthandler.getData(
      res, 
      req.userId, 
      exports.apis.getAuthorizedProjects, 
      null,     // default entity name
      [req.userId], // parameter array
      refresh);
  });    

  // Get gcp api data endpoint - returns list of projects
  app.get('/gcp', requesthandler.checkJwt, requesthandler.processUser, function(req, res){
    requesthandler.invokeProvider(
      res, 
      req.userId, 
      exports.apis.getProjects, 
      null,     // use the default entity name
      [req.userId]); // parameter array
  });

  // Get gcp api data endpoint
  app.get('/gcp/projects/:projectId', requesthandler.checkJwt, requesthandler.processUser, function(req, res){
    const projectId = req.params.projectId;
    const refresh = req.query.refresh || false;
    requesthandler.getData(
      res, 
      req.userId, 
      exports.apis.getProject, 
      `gcp:${projectId}`,  // entity name must be constructed dynamically
      [projectId], // parameter array
      refresh);
  });

  // Post gcp project API - adds or removes a project
  app.post('/gcp', requesthandler.checkJwt, requesthandler.processUser, function (req, res){
    const action = req.body && req.body.action;

    const add = async () => {
      requesthandler.invokeProvider(
        res, 
        req.userId, 
        exports.apis.addProject, 
        null,     // use the default entity name
        [req.body.connectionInfo]); // parameter array
    }

    const remove = async () => {
      requesthandler.invokeProvider(
        res, 
        req.userId, 
        exports.apis.removeProject, 
        null,     // use the default entity name
        [req.userId, req.body.project]); // parameter array
    }

    if (action === 'add' && req.body && req.body.connectionInfo) {
      add();
      return;
    }

    if (action === 'remove' && req.body && req.body.project) {
      remove();
      return;
    }

    res.status(200).send({ message: 'Unknown action'}); 
  });
}

exports.apis.addProject.func = async ([connectionInfo]) => {
  try {
    /* replace with testing the key info */
    /*
    const normalizedPhoneNumber = normalize(phone);
    const url = `https://api.yelp.com/v3/businesses/search/phone?phone=${normalizedPhoneNumber}`;
    const headers = { 
      'content-type': 'application/json',
      'authorization': `Bearer ${yelpConfig.api_key}`
     };

    const response = await axios.get(
      url,
      {
        headers: headers
      });
    
    // if the API found a business with this phone number return it
    if (response.data && response.data.businesses && response.data.businesses.length) {
      return response.data;
    }
    
    // return null if the business was not found
    return null;
    */
    // construct project information from connection info passed in
    const project = {};
    for (const param of connectionInfo) {
      project[param.name] = param.value;
    }
    return [project];
  } catch (error) {
    await error.response;
    console.log(`addProject: caught exception: ${error}`);
    return null;
  }
};

exports.apis.getProjects.func = async () => {
  // this is a no-op - invokeProvider does the work to return the gcp:projects entity
  return [];
};

exports.apis.getProject.func = async ([projectId]) => {
  try {
    /*
    const url = `https://api.yelp.com/v3/businesses/${projectId}/reviews`;
    const headers = { 
      'content-type': 'application/json',
      'authorization': `Bearer ${yelpConfig.api_key}`
     };

    const response = await axios.get(
      url,
      {
        headers: headers
      });
    
    // response received successfully
    return response.data;
    */
    return {
      projectId: projectId,
      name: projectId,
    }
  } catch (error) {
    await error.response;
    console.log(`getProject: caught exception: ${error}`);
    return null;
  }
};

exports.apis.removeProject.func = async ([userId, projectId]) => {
  try {
    // remove the document from the projects collection
    await database.removeDocument(userId, 'gcp:projects', projectId);

    // invokeProvider will re-read the gcp:projects collection and return it
    return [];
  } catch (error) {
    await error.response;
    console.log(`removeProject: caught exception: ${error}`);
    return null;
  }
}
/* 
exports.OLDinvokeAction = async (connectionInfo, activeSnapId, param) => {
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

    // run registered functions on the worker via exec
    console.log(`gcp: executing action ${action}`);

    const output = await pool.exec('invokeAction', [action, serviceCredentials, activeSnapId, param]);

    console.log(`gcp: finished executing action ${action} with output ${output}`);

    *** /*
    // construct script name, environment, and full command
    //const script = `./src/providers/${providerName}/${action}.sh`;
    //const env = getEnvironment(param);
    //const env = { ...process.env, ...getEnvironment(param), ACTIVESNAPID: activeSnapId, SERVICECREDS: serviceCredentials };
    const command = getCommand(action, project, param);
    //const command = `ACTIVESNAPID=${activeSnapId} SERVICECREDS='${serviceCredentials}' ${env} ${cmd}`;

    // log a message before executing command
    console.log(`executing command: ${command}`);

    // setup environment
    setupEnvironment(serviceCredentials, activeSnapId, project);

    // execute the action and obtain the output
    //const output = await executeCommand(script, env);
    exec(command, function(code, stdout, stderr) {
      // setup environment
      teardownEnvironment(activeSnapId, project);

      // log a message after executing command
      console.log(`finished executing command: ${command}, return code ${code}`);
      
      // return to caller
      return { code, stdout, stderr };
    });

    return `gcp: executed ${command}`;
    * /
    return output;
  } catch (error) {
    console.log(`invokeAction: caught exception: ${error}`);
    return null;
  }
}
*/

exports.apis.getAuthorizedProjects.func = async ([userId]) => {
  try {
    const accessInfo = await googleauth.getGoogleAccessInfo(userId);
    if (!accessInfo) {
      console.log('getProjects: getGoogleAccessToken failed');
      return null;
    }

    // get access token and apiKey
    const accessToken = accessInfo.accessToken;
    if (!accessToken) {
      console.log('getProjects: could not obtain access token');
      return null;
    }
    const apiKey = accessInfo.apiKey;
    if (!apiKey) {
      console.log('getProjects: could not obtain api key');
      return null;
    }

    const url = `https://cloudresourcemanager.googleapis.com/v1/projects?key=${apiKey}`;
    const headers = { 
      'content-type': 'application/json',
      'authorization': `Bearer ${accessToken}`
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
    console.log(`getProjects: caught exception: ${error}`);
    return null;
  }
}
/*

const executeCommand = async (command, env) => {
  try {
    // execute asynchronously so as to not block the web thread
    const returnVal = await execAsync(command, [], { env: env });
    return returnVal;
  } catch (error) {
    console.error(`executeCommand: caught exception: ${error}`);
    return error;
  }
}

const getCommand = (action, project, param) => {
  try {
    const image = param.image;
    if (!image) {
      console.error(`getCommand: action ${action} requires image name`);
      return null;
    }

    // set up the base command with the account and project information
    const baseCommand = `gcloud --account snapmaster@${project}.iam.gserviceaccount.com --project ${project} `;

    // return the right shell command to exec for the appropriate action
    switch (action) {
      case actions.build:
        return `${baseCommand} builds submit --tag gcr.io/${project}/${image}`;
      case actions.deploy: 
        const service = param.service;
        if (!service) {
          console.error(`getCommand: action ${action} requires service name`);
          return null;
        }
        const region = param.region;
        if (!region) {
          console.error(`getCommand: action ${action} requires region name`);
          return null;
        }
        return `${baseCommand} run deploy ${service} --image gcr.io/${project}/${image} --platform managed --allow-unauthenticated --region ${region}`;
      default:
        console.error(`getCommand: unknown command ${action}`);
        return null;
    }
  } catch (error) {
    console.error(`getCommand: caught exception: ${error}`);
    return null;
  }
}

const getEnvironment = (param) => {
  let env = '';
  //const env = {};
  for (const key in param) {
    env += `${key.toUpperCase()}=${param[key]} `;
    //const upperKey = key.toUpperCase();
    //env[upperKey] = param[key];
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

const setupEnvironment = (serviceCredentials, activeSnapId, project) => {
  try {
    // create temporary directory
    const tmp = tempdir();
    const dirName = `${tmp}/${activeSnapId}`;
    mkdir(dirName);
    cd(dirName);

    // create creds.json file
    // BUGBUG: make sure this doesn't log to the console
    echo(serviceCredentials).to('creds.json');

    // execute the gcloud auth call
    const output = exec(`gcloud auth activate-service-account snapmaster@${project}.iam.gserviceaccount.com --key-file=creds.json --project=${project}`);  
    return output;
  } catch (error) {
    console.error(`setupEnvironment: caught exception: ${error}`);
    return null;
  }
}

const teardownEnvironment = (activeSnapId, project) => {
  try {
    // remove the cached gcloud credential
    const output = exec(`gcloud auth revoke snapmaster@${project}.iam.gserviceaccount.com`);  

    // remove temporary directory and everything in it
    const tmp = tempdir();
    const dirName = `${tmp}/${activeSnapId}`;
    rm('-rf', dirName);

    return output;
  } catch (error) {
    console.error(`teardownEnvironment: caught exception: ${error}`);
    return null;
  }
} 
*/