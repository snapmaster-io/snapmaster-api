// github provider

// exports:
//   apis.
//        createHook(userId, repo): create a webhook
//        deleteHook(userId, repo, hook): get page reviews
//        getActiveRepos(userId): get active repos for this user
//        getAllRepos(userId): get all repos for this user
//   provider: provider name
//   image: provider image url (local to SPA)
//   type: provider type (simple or link)
//   definition: provider definition

const githubauth = require('../services/githubauth');
const dbconstants = require('../data/database-constants');
const dal = require('../data/dal');
const provider = require('./provider');
const { Octokit } = require("@octokit/rest");

const providerName = 'github';

exports.provider = providerName;
exports.image = `/${providerName}-logo.png`;
exports.type = provider.linkProvider;
exports.definition = provider.getDefinition(providerName);

// api's defined by this provider
exports.apis = {
  createHook: {
    name: 'createHook',
    provider: providerName,
    entity: 'github:hooks',
    arrayKey: 'data',
    itemKey: 'id'
  },
  deleteHook: {
    name: 'deleteHook',
    provider: providerName,
  },
  getActiveRepos: {
    name: 'getActiveRepos',
    provider: providerName,
    itemKey: 'name'
  },
  getAllRepos: {
    name: 'getAllRepos',
    provider: providerName,
    entity: 'github:repos',
    itemKey: 'name'
  },
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
  } catch (error) {
    await error.response;
    console.log(`createHook: caught exception: ${error}`);
    return null;
  }
};

exports.apis.getActiveRepos.func = async ([userId]) => {
  try {
    const repos = await dal.getData(userId, exports.apis.getAllRepos, [userId], false, false);
    const data = repos.filter(r => r[dbconstants.metadataActiveFlag]);
    return data;
  } catch (error) {
    await error.response;
    console.log(`getActiveRepos: caught exception: ${error}`);
    return null;
  }
};

exports.apis.getAllRepos.func = async ([userId]) => {
  try {
    const client = await getClient(userId);
    const repos = await client.repos.list();

    // store / return only a subset of the fields in the repo payload
    const data = repos.data.map(r => {
      return {
        id: r.id,
        name: r.name,
        full_name: r.full_name,
        fork: r.fork,
        private: r.private,
        url: r.url,
        html_url: r.html_url
      }
    });
    return data;
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