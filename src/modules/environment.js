// simple environment management
// 
// exports:
//   getEnv(): gets the current environment (dev | prod)
//   setEnv(): sets the current environment (dev | prod)
//   getCloudPlatformConfigFile(): gets the GCP config for the current env (dev | prod)
//   getProjectId(): gets the GCP project ID for the current env (dev | prod)
//   getEndpoint(): gets the Google Cloud Run endpoint for the current env (dev | prod)
//   getOAuth2Audience(): gets the OAuth2 audience value for API
//   getOAuth2Domain(): gets the OAuth2 server's domain
//   getServiceAccount(): gets the GCP pub-sub service account for the current env (dev | prod)
//   getServiceAccount(): gets the GCP service location for the current env (dev | prod)
//   getProviderUrl(): gets the URL for the provider running in the current env (dev | prod)
//   getUrl(): gets the URL for the app running in the current env (dev | prod)

var environment;
var devMode;

// constants for environment types
exports.dev = 'dev';
exports.prod = 'prod';

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

// note - keyFilename below assumes a path relative to the app root, NOT the current directory
// this function is no longer used by the SnapMaster API main project.  It is only used by 
// utils/invoke.js to send a pubsub message on the right subscription
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

exports.getOAuth2Audience = () => {
  return 'https://api.snapmaster.io';
}

exports.getOAuth2Domain = () => {
  const domain = environment === 'dev' ? 'snapmaster-dev' : 'snapmaster';
  return `${domain}.auth0.com`;
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
  if (exports.getDevMode()) {
    return 'http://localhost:8081';
  } else {
    const endpoint = `https://provider-${providerName}${environment === 'dev' && '-dev'}.snapmaster.io`;
    return endpoint;  
  }
}

exports.getUrl = () => {
  const endpoint = environment === 'dev' ? 'https://dev.snapmaster.io' 
                                         : 'https://www.snapmaster.io';
  return endpoint;
}
