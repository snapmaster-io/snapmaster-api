// github provider

// exports:
//   apis.
//        createHook(userId, repo): create a webhook
//        deleteHook(userId, repo, hook): get page reviews
//        getActiveRepos(): get active repos
//        getAllRepos(userId): get all repos for this user

const dbconstants = require('../data/database-constants');
const githubauth = require('../services/githubauth');
const { Octokit } = require("@octokit/rest");

// api's defined by this provider
exports.apis = {
  addActiveRepos: {
    name: 'addActiveRepos',
    provider: 'github',
    entity: 'github:activerepos',
    itemKey: '__id'
  },
  createHook: {
    name: 'createHook',
    provider: 'github',
    entity: 'github:hooks',
    arrayKey: 'data',
    itemKey: 'id'
  },
  deleteHook: {
    name: 'deleteHook',
    provider: 'github',
  },
  getActiveRepos: {
    name: 'getActiveRepos',
    provider: 'github',
    entity: 'github:activerepos',
    itemKey: '__id'
  },
  getAllRepos: {
    name: 'getAllRepos',
    provider: 'github',
    entity: 'github:repos',
    arrayKey: 'data',
    itemKey: 'name'
  },
};

exports.apis.addActiveRepos.func = async ([repos]) => {
  if (repos) {
    // return only the repos that are "handled" and therefore active
    const activeRepos = repos.filter(r => r[dbconstants.metadataHandledFlag]);
    return activeRepos;
  }
  return [];
};

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

/*
    const url = `https://graph.facebook.com/${fb_userid}/accounts?access_token=${accessToken}`;
    const headers = { 
      'content-type': 'application/json'
     };

    const response = await axios.get(
      url,
      {
        headers: headers
      });

      // response received successfully
    return response.data;
    */
  } catch (error) {
    await error.response;
    console.log(`createHook: caught exception: ${error}`);
    return null;
  }
};

exports.apis.getActiveRepos.func = async () => {
  // this is a no-op - invokeProvider does the work to return the github:activerepos entity
  return [];
};

exports.apis.getAllRepos.func = async ([userId]) => {
  try {
    const client = await getClient(userId);
    const repos = await client.repos.list();
    return repos;
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