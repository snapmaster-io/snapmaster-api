// oauth2 flow initiation and callback handling
// 
// exports:
//   createHandlers(app): create handlers for initiating OAuth2 flow and callback processing
//   getOAuthClient(configData): return a configured OAuth2 client for this config data

const simpleoauth = require('simple-oauth2');
const querystring = require('querystring')
const environment = require('./environment');
const config = require('./config');
const database = require('../data/database');
const dbconstants = require('../data/database-constants');
const credentials = require('./credentials');

exports.createHandlers = (app) => {
  // Post oauthstart API will initiate an OAuth2 authorization flow
  app.use('/oauth/start/:provider', function(req, res){
    // define an async function to handle the call (since we use await in this codepath)
    const call = async () => {
      try {
        // get the required query parameters and bail if they aren't found
        const csrfToken = req.query.csrf;
        const redirectUrl = req.query.url;
        const userId = req.query.userId;
        if (!csrfToken || !redirectUrl || !userId) {
          const url = `${redirectUrl}#message=error`;
          res.redirect(url);
          return;
        }

        // get provider name and configuration data
        const providerName = req.params.provider;
        const configData = await config.getConfig(providerName);
        if (!configData) {
          const url = `${redirectUrl}#message=error`;
          res.redirect(url);
          return;
        }

        // get a fully configured oauth client
        const oauth = exports.getOAuthClient(configData);

        // construct the authorize URL options
        const authorizeURIOptions = {
          redirect_uri: `${environment.getUrl()}/oauth/callback/${providerName}`,
          scope: configData.scopes,
          state: encodeState(redirectUrl, csrfToken, providerName, userId),
        };
        if (configData.audience) {
          authorizeURIOptions.audience = configData.audience;
        }

        // generate authorization URI 
        const authorizationURI = oauth.authorizationCode.authorizeURL(authorizeURIOptions);
      
        // redirect user to authorization URI 
        res.redirect(authorizationURI);
      } catch (error) {
        console.error(`oauthstart: caught exception: ${error}`);
        res.status(401).send({ error: 'Authorization failed' });
      }
    }

    // invoke the async function
    call();
  });

  // Post oauthstart API is the callback handler in the OAuth2 authorization flow
  app.use('/oauth/callback/:provider', function(req, res){
    // define an async function to handle the call (since we use await in this codepath)
    const call = async () => {
      // get provider name 
      const providerName = req.params.provider;
      if (!providerName) {
        console.error('oauthcallback: could not obtain provider name');
        const url = `${state.url}#message=error`;
        res.redirect(url);
        return;
      }

      // get the grant code and state
      const code = req.query.code;
      const state = parseState(providerName, req.query.state);
      if (!state) {
        console.error('oauthcallback: could not parse state');
        const url = `${state.url}#message=error`;
        res.redirect(url);
        return;
      }

      try {
        // get the userId out of the state hash
        const userId = state.userId;

        // get configuration data
        const configData = await config.getConfig(providerName);
        if (!configData) {
          console.error('oauthcallback: could not obtain config data');
          const url = `${state.url}#message=error`;
          res.redirect(url);
          return;
        }

        // get a fully configured oauth client
        const oauth = exports.getOAuthClient(configData);

        // exchange the grant code for an access token 
        const authorizationToken = await oauth.authorizationCode.getToken({
          code: code,
          scope: configData.scopes,
          redirect_uri: `${environment.getUrl()}/oauth/callback/${providerName}`,
          client_id: configData.client_id,
          client_secret: configData.client_secret
        });

        // trade the authorization token for an access token
        const authResult = oauth.accessToken.create(authorizationToken);

        if (userId) {
          // store the default credentials for the connection
          const jsonValue = JSON.stringify(authResult.token);
          const name = await credentials.set(userId, `${userId}:${providerName}`, jsonValue);

          // store the connection information in the user data document
          const userData = { connected: true };
          userData[dbconstants.keyField] = name;
          await database.setUserData(userId, providerName, userData);
        } else {
          console.error('oauthcallback: could not find userId in state parameter');
          const url = `${state.url}#message=error`;
          res.redirect(url);
          return;          
        }

        // redirect back to SPA with a success message
        const url = `${state.url}#message=success&csrf=${state.csrf}&providerName=${providerName}`;
        res.redirect(url);
      } catch (error) {
        console.error(`oauthcallback: caught exception: ${error}`);
        const url = `${state.url}#message=error`;
        res.redirect(url);
      }
    }
    
    // invoke the async function
    call();
  });
}

// create a fully configured OAuth client based on the config data
exports.getOAuthClient = (configData) => {
  const client = simpleoauth.create({
    client: {
      id: configData.client_id,
      secret: configData.client_secret
    },
    auth: {
      tokenHost: configData.token_host,
      tokenPath: configData.token_url,
      authorizePath: configData.authorization_url
    }
  });
  return client;
}

// encode the "state" querystring parameter
const encodeState = (redirectUrl, csrfToken, providerName, userId) => {
  // slack does not allow the "state" to contain url-encoded parameters 
  // delimited by "&", so we need to delimit using a space and parse accordingly
  if (providerName === 'slack') {
    return `url=${redirectUrl} csrf=${csrfToken} providerName=${providerName} userId=${userId}`;
  } else {
    return `url=${redirectUrl}&csrf=${csrfToken}&providerName=${providerName}&userId=${userId}`;
  }
}

// parse the "state" querystring parameter
const parseState = (provider, state) => {
  // slack does not allow the "state" to contain url-encoded parameters 
  // delimited by "&", so we need to delimit using a space and parse accordingly
  if (provider === 'slack') {
    const parsedState = {};
    for (const param of state.split('%20')) {
      const kv = param.split('%3D');
      if (kv && kv.length && kv.length > 1) {
        parsedState[kv[0]] = kv[1];
      }
    }
    return parsedState;
  } else {
    return querystring.parse(state);
  }
}