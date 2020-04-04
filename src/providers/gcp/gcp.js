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
const {auth} = require('google-auth-library');
const {google} = require('googleapis');

const googleauth = require('../../services/googleauth');
const provider = require('../provider');
const requesthandler = require('../../modules/requesthandler');
const database = require('../../data/database');

const providerName = 'gcp';

exports.provider = providerName;
exports.image = `/${providerName}-logo.png`;
exports.type = provider.hybridProvider;
exports.definition = provider.getDefinition(providerName);
exports.getAccessInfo = googleauth.getGoogleAccessToken;

// invokeAction is implemented by a separate service
exports.invokeAction = provider.invokeAction;  

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

// entities defined by this provider
exports.entities = {
  'gcp:projects': {
    entity: 'gcp:projects',
    route: '/gcp',
    //get: getProjectsHandler
    //post: postProjectsHandler
  }, 
  'gcp:authorizedProjects': {
    entity: 'gcp:authorizedProjects',
    route: '/gcpprojects',
    //get: getAuthorizedProjectsHandler
  }
};

exports.createHandlers = (app) => {
  if (exports.entities) {
    for (const key of Object.keys(exports.entities)) {
      const entity = exports.entities[key];
      entity.get && app.get(entity.route, requesthandler.checkJwt, requesthandler.processUser, entity.get);
      entity.post && app.post(entity.route, requesthandler.checkJwt, requesthandler.processUser, entity.post);
    }
  }

/*
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
    const refresh = req.query.refresh || false;  

    requesthandler.invokeProvider(
      res, 
      req.userId, 
      exports.apis.getProjects, 
      null,     // use the default entity name
      [req.userId]); // parameter array
  });
  */  

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

  /*
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
  */
}

exports.entities['gcp:projects'].get = (req, res) => {
  requesthandler.invokeProvider(
    res, 
    req.userId, 
    exports.apis.getProjects, 
    null,     // use the default entity name
    [req.userId]); // parameter array
}

exports.entities['gcp:projects'].post = (req, res) => {
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
}

exports.entities['gcp:authorizedProjects'].handler = (req, res) => {
  const refresh = req.query.refresh || false;  

  requesthandler.getData(
    res, 
    req.userId, 
    exports.apis.getAuthorizedProjects, 
    null,     // default entity name
    [req.userId], // parameter array
    refresh);
}

exports.apis.addProject.func = async ([connectionInfo]) => {
  try {
    // construct an object with all project and auth info
    const project = {};
    for (const param of connectionInfo) {
      project[param.name] = param.value;
    }

    // verify we have everything we need to authenticate
    if (!project.project || !project.key) {
      console.error('addProject: did not receive all authorization information');
      return null;
    }

    // retrieve all enabled services
    const response = await getProject(project.key);
    if (!response) {
      console.error('addProject: could not retrieve project information');
      return null;
    }

    // add the project attributes to the result
    const result = { ...project, ...response, __id: project.project };

    /*
    // get the enabled services on the project
    const services = await getEnabledServices(result);
    if (services && services.data) {
      result.services = services.data;
    }
    */

    return [result];
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

const getEnabledServices = async (projectInfo) => {
  try {
    const keys = JSON.parse(projectInfo.key);
    const client = auth.fromJSON(keys);
    client.scopes = ['https://www.googleapis.com/auth/cloud-platform'];
    const url = `https://serviceusage.googleapis.com/v1/projects/${projectInfo.projectNumber}/services`;    
    const res = await client.request({url});
    return res;
  } catch (error) {
    console.log(`getEnabledServices: caught exception: ${error}`);
    return null;
  }
}

const getProject = async (serviceCredentials) => {
  try {
    const client = getClient(serviceCredentials);
    client.scopes = ['https://www.googleapis.com/auth/cloud-platform'];
    const keys = JSON.parse(serviceCredentials);

    const request = {
      auth: client,
      projectId: keys.project_id
    };

    const cloudresourcemanager = google.cloudresourcemanager('v1');
    const project = await cloudresourcemanager.projects.get(request);

    // return the project information
    if (project && project.data) {
      return project.data
    }

    // no data - return null
    return null;
  } catch (error) {
    console.log(`getProject: caught exception: ${error}`);
    return null;
  }
}

const getClient = (serviceCredentials) => {
  try {
    const keys = JSON.parse(serviceCredentials);
    const client = google.auth.fromJSON(keys);
    return client;
  } catch (error) {
    console.log(`getClient: caught exception: ${error}`);
    return null;
  }
}

