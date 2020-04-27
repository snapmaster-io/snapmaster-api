// oauth2 flow initiation and callback handling
// 
// exports:
//   createHandlers(app): create handlers for initiating OAuth2 flow and callback processing

const simpleOauth = require('simple-oauth2');
const querystring = require('querystring')
const environment = require('./environment');
const config = require('./config');
const database = require('../data/database');

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
        const oauth = getOAuthClient(configData);

        // generate authorization URI 
        const authorizationURI = oauth.authorizationCode.authorizeURL({
          redirect_uri: `${environment.getUrl()}/oauth/callback/${providerName}`,
          scope: 'offline_access',
          state: `url=${redirectUrl}&csrf=${csrfToken}&providerName=${providerName}&userId=${userId}`,
        })
      
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
      // get the grant code and state
      const code = req.query.code;
      const state = querystring.parse(req.query.state);

      try {
        // get the userId out of the state hash
        const userId = state.userId;

        // get provider name and configuration data
        const providerName = req.params.provider;
        if (!providerName) {
          console.error('oauthcallback: could not obtain provider name');
          const url = `${state.url}#message=error`;
          res.redirect(url);
          return;
        }

        const configData = await config.getConfig(providerName);
        if (!configData) {
          console.error('oauthcallback: could not obtain config data');
          const url = `${state.url}#message=error`;
          res.redirect(url);
          return;
        }

        // get a fully configured oauth client
        const oauth = getOAuthClient(configData);

        // exchange the grant code for an access token 
        const authorizationToken = await oauth.authorizationCode.getToken({
          code: code,
          scope: 'offline_access',
          redirect_uri: `${environment.getUrl()}/oauth/callback/${providerName}`,
          client_id: configData.client_id,
          client_secret: configData.client_secret
        });

        const authResult = oauth.accessToken.create(authorizationToken);
        console.log(`oauthcallback: authResult: ${JSON.stringify(authResult.token)}`);

        const token = authResult.token.access_token;

        if (userId) {
          database.setUserData(userId, providerName, authResult.token);
        } else {
          console.error('oauthcallback: could not find userId in state parameter');
          const url = `${state.url}#message=error`;
          res.redirect(url);
          return;          
        }

        // redirect back to SPA with a success message
        //const url = `${state.url}#message=success&csrf=${state.csrf}&token=${Buffer.from(token, 'binary').toString('base64')}`;
        const url = `${state.url}#message=success&csrf=${state.csrf}`;
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
const getOAuthClient = (configData) => {
  const client = simpleOauth.create({
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
