// github provider

// exports:
//   apis.
//        createHook(userId, repo): create a webhook
//        deleteHook(userId, repo, hook): get page reviews

const axios = require('axios');
const githubauth = require('../services/githubauth.js');
const { Octokit } = require("@octokit/rest");

// api's defined by this provider
exports.apis = {
  createHook: {
    name: 'createHook',
    provider: 'github',
    entity: 'github:hooks',
    itemKey: 'id'
  },
  deleteHook: {
    name: 'deleteHook',
    provider: 'github',
  },
  getRepositories: {
    name: 'getRepositories',
    provider: 'github',
    entity: 'github:repos',
    itemKey: 'id'
  },
};

exports.apis.createHook.func = async ([userId, repo]) => {
  try {
    const user = await githubauth.getGithubAccessInfo(userId);
    const owner = user && user.userId;
    const accessToken = user && user.accessToken;

    if (!accessToken || !owner) {
      console.log('createHook: getGithubAccessToken failed');
      return null;
    }

    const octokit = new Octokit({
      auth: accessToken
    });

    const config = {
      url: 'https://www.snapmaster.io/githubhook',
      content_type: 'json',
    };

    const hook = await octokit.repos.createHook({
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

exports.apis.getRepositories.func = async ([userId]) => {
  try {
    const user = await githubauth.getGithubAccessInfo(userId);
    const owner = user && user.userId;
    const accessToken = user && user.accessToken;

    if (!accessToken || !owner) {
      console.log('getRepositories: getGithubAccessToken failed');
      return null;
    }

    const octokit = new Octokit({
      auth: accessToken
    });

    const repos = await octokit.repos.list();
    return repos;
  } catch (error) {
    await error.response;
    console.log(`createHook: caught exception: ${error}`);
    return null;
  }
};

