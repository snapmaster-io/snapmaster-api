// GCP provider

// exports:
//   entities.
//        projects - the projects entity
//
//   createHandlers(app): create all route handlers
// 
//   provider: provider name
//   image: provider image url (local to SPA)
//   type: provider type (simple or link)
//   definition: provider definition
//   getAccessInfo: get access info function
//   invokeAction: use the cross-service generic implementation (not in-tree)

const axios = require('axios');
const {auth} = require('google-auth-library');
const {google} = require('googleapis');

const googleauth = require('../../services/googleauth');
const provider = require('../provider');

const providerName = 'gcp';
const entityName = 'gcp:projects';

exports.provider = providerName;
exports.image = `/${providerName}-logo.png`;
exports.definition = provider.getDefinition(providerName);
exports.type = exports.definition.connection && exports.definition.connection.type;
exports.getAccessInfo = googleauth.getGoogleAccessToken;

// invokeAction is implemented by a separate service
exports.invokeAction = provider.invokeAction;  

// entities defined by this provider
exports.entities = {};
exports.entities[entityName] = {
  entity: entityName,
  provider: providerName,
  itemKey: '__id',
  keyFields: ['key'],
};

exports.createHandlers = (app) => {
}

exports.entities[entityName].func = async ([connectionInfo]) => {
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
    const result = { 
      secret: {
      ...project, 
      },
      ...response, 
      __id: project.project,
      __name: project.project,
      __url: `https://console.cloud.google.com/home/dashboard?project=${project.project}`,
      __triggers: exports.definition.triggers,
      __actions: exports.definition.actions,    
    };

    /*
    // get the enabled services on the project
    const services = await getEnabledServices(result);
    if (services && services.data) {
      result.services = services.data;
    }
    */

    return result;
  } catch (error) {
    await error.response;
    console.log(`gcpEntityHandler: caught exception: ${error}`);
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

// legacy code kept here for future reference

const getAuthorizedProjects = async ([userId]) => {
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
