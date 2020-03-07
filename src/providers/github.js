// github provider

// exports:
//   apis.
//        createHook(userId, repo): create a webhook
//        deleteHook(userId, repo, hook): get page reviews
//        getAllRepos(userId): get all repos for this user

const githubauth = require('../services/githubauth');
const { Octokit } = require("@octokit/rest");

// api's defined by this provider
exports.apis = {
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
  getAllRepos: {
    name: 'getAllRepos',
    provider: 'github',
    entity: 'github:repos',
    arrayKey: 'data',
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

exports.apis.getAllRepos.func = async ([userId]) => {
  try {
    const client = await getClient(userId);
    const repos = await client.repos.list();

    // store / return only a subset of the fields in the repo payload
    const data = repos.map(r => {
      return {
        id,
        name,
        full_name,
        fork,
        private,
        url,
        html_url
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