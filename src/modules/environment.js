// simple environment management
// 
// exports:
//   getEnv(): gets the current environment (dev | prod)
//   setEnv(): sets the current environment (dev | prod)
//   getConfig(type): gets the config of type 'type' for the current env (dev | prod)
//   getCloudPlatformConfigFile(): gets the GCP config for the current env (dev | prod)
//   getProjectId(): gets the GCP project ID for the current env (dev | prod)
//   geteEndpoint(): gets the Google Cloud Run endpoint for the current env (dev | prod)
//   getServiceAccount(): gets the GCP pub-sub service account for the current env (dev | prod)
//   getServiceAccount(): gets the GCP service location for the current env (dev | prod)
//   getProviderUrl(): gets the URL for the provider running in the current env (dev | prod)
//   getUrl(): gets the URL for the app running in the current env (dev | prod)

var environment;
var devMode;

// constants for environment types
exports.dev = 'dev';
exports.prod = 'prod';

// constants for config types
exports.auth0 = 'auth0';
exports.facebook = 'facebook';
exports.github = 'github';
exports.google = 'google';
exports.sendgrid = 'sendgrid';
exports.twilio = 'twilio';
exports.twitter = 'twitter';
exports.yelp = 'yelp';

const configs = {
  auth0: {
    dev: require(`../../config/auth0_config_dev.json`),
    prod: require(`../../config/auth0_config_prod.json`)
  },
  facebook: {
    dev: require(`../../config/facebook_auth_config_dev.json`),
    prod: require(`../../config/facebook_auth_config_prod.json`)
  },
  gcp: {
    dev: require(`../../config/google_auth_config_dev.json`),
    prod: require(`../../config/google_auth_config_prod.json`)
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
  twitter: {
    dev: require(`../../config/twitter_auth_config_dev.json`),
    prod: require(`../../config/twitter_auth_config_prod.json`)
  },
  yelp: {
    dev: require(`../../config/yelp_auth_config_dev.json`),
    prod: require(`../../config/yelp_auth_config_prod.json`)
  }
};

// get the environment (dev or prod)
exports.getEnv = () => environment;

// set the environment (dev or prod)
exports.setEnv = (env) => {
  environment = env;
}

// get devMode state (true or false)
exports.getDevMode = () => devMode;

// set the devMode state
exports.setDevMode = (mode) => {
  devMode = mode;
}

exports.getConfig = (type) => {
  const config = configs[type][environment];
  return config;
}

// note - keyFilename below assumes a path relative to the app root, NOT the current directory
exports.getCloudPlatformConfigFile = () => {
  const cloudConfigFileName = `./config/cloud_platform_config_${environment}.json`;
  return cloudConfigFileName;
}

exports.getProjectId = () => {
  const projectId = environment === 'prod' ? 'snapmaster' : `snapmaster-${environment}`;
  return projectId;
}

exports.getEndpoint = () => {
  const endpoint = environment === 'dev' ? 'https://snapmaster-dev-7hjh6mhjjq-uc.a.run.app' 
                                         : 'https://snapmaster-iwswjzd7qa-uc.a.run.app';
  return endpoint;
}

exports.getServiceAccount = () => {
  const projectId = exports.getProjectId();
  const serviceAccount = `cloud-run-pubsub-invoker@${projectId}.iam.gserviceaccount.com`;
  return serviceAccount;
}

exports.getLocation = () => {
  const location = environment === 'dev' ? 'us-central1' : 'us-central1';
  return location;
}

exports.getProviderUrl = (providerName) => {
  const endpoint = providerName + (environment === 'dev' && '-dev') + '.snapmaster.io';
  return endpoint;
}

exports.getUrl = () => {
  const endpoint = environment === 'dev' ? 'https://dev.snapmaster.io' 
                                         : 'https://www.snapmaster.io';
  return endpoint;
}
