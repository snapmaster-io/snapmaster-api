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

const configs = {};

exports.getConfig = (type) => {
  const env = environment.getEnv();
  //const config = configs[type][env];
  const config = configs[type];
  return config;
}

// load all the configs using the keys of all the config secrets
const loadConfigs = async (env) => {
  const projectId = environment.getProjectId();
  for (const key of Object.keys(configSecrets)) {
    const secretName = `projects/${projectId}/secrets/aes-${configSecrets[key][env]}`;
    configs[key] = await credentials.get(dbconstants.snapMasterUserId, secretName);
  }
}

// invoke the operation to load all configs
loadConfigs(environment.getEnv());