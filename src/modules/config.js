// simple config service implemented over credential management
//
// exports:
//   getConfig(type): gets the config of type 'type' for the current env (dev | prod)

const environment = require('./environment');
const credentials = require('./credentials');
const dbconstants = require('../data/database-constants');

// constants for config types
exports.auth0 = 'auth0';
exports.facebook = 'facebook';
exports.github = 'github';
exports.google = 'google';
exports.sendgrid = 'sendgrid';
exports.twilio = 'twilio';
exports.twitter = 'twitter';
exports.yelp = 'yelp';

/* 
 * pre-secret configs relied on json files in the config/ directory on 
 * the container image
 */
/*
 const configs = {
  auth0: {
    dev: require(`../../config/auth0_config_dev.json`),
    prod: require(`../../config/auth0_config_prod.json`)
  },
  github: {
    dev: require(`../../config/github_auth_config_dev.json`),
    prod: require(`../../config/github_auth_config_prod.json`)
  },
  google: {
    dev: require(`../../config/google_auth_config_dev.json`),
    prod: require(`../../config/google_auth_config_prod.json`)
  },
  sendgrid: {
    dev: require(`../../config/sendgrid_auth_config_dev.json`),
    prod: require(`../../config/sendgrid_auth_config_prod.json`)
  },
  twilio: {
    dev: require(`../../config/twilio_auth_config_dev.json`),
    prod: require(`../../config/twilio_auth_config_prod.json`)
  },
};
*/

const configSecrets = {
  auth0: {
    dev:  'auth0_config_dev',
    prod: 'auth0_config_prod'
  },
  github: {
    dev:  'github_auth_config_dev',
    prod: 'github_auth_config_prod'
  },
  google: {
    dev:  'google_auth_config_dev',
    prod: 'google_auth_config_prod'
  },
  sendgrid: {
    dev:  'sendgrid_auth_config_dev',
    prod: 'sendgrid_auth_config_prod'
  },
  twilio: {
    dev:  'twilio_auth_config_dev',
    prod: 'twilio_auth_config_prod'
  },
}

// an object to cache the configs for each type 
const configs = {};

exports.getConfig = async (type) => {
  // if config for this type has not been loaded yet, do so now
  const env = environment.getEnv();
  configs[type] = configs[type] || await loadConfig(env, type);
  return configs[type];
}

const loadConfig = async (env, type) => {
  try {
    const projectId = environment.getProjectId();
    const secretName = `projects/${projectId}/secrets/aes-${configSecrets[type][env]}`;
    const json = await credentials.get(dbconstants.snapMasterUserId, secretName);
    const config = JSON.parse(json);  
    return config;
  } catch (error) {
    console.error(`loadConfig: caught exception: ${error}`);
    return null;
  }
}

// pre-load all the configs using the keys of all the config secrets
const loadConfigs = async (env) => {
  for (const key of Object.keys(configSecrets)) {
    configs[key] = await loadConfig(env, key);
  }
}

// invoke the operation to load all configs
loadConfigs(environment.getEnv());