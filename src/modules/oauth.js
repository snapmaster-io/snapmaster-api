// oauth2 flow initiation and callback handling
// 
// exports:
//   createHandlers(app): create handlers for initiating OAuth2 flow and callback processing

const simpleOauth = require('simple-oauth2');
const querystring = require('querystring')
const environment = require('./environment');
const config = require('./config');

exports.createHandlers = (app) => {
  // Post oauthstart API will initiate an OAuth2 authorization flow
  app.use('/oauth/start/:provider', function(req, res){
    // define an async function to handle the call (since we use await in this codepath)
    const call = async () => {
      try {
        // get provider name and configuration data
        const providerName = req.params.provider;
        const configData = await config.getConfig(providerName);
        if (!configData) {
          res.status(401).send({ error: 'Bad request' });
          return;
        }

        // get the required query parameters and bail if they aren't found
        const csrfToken = req.query.csrf;
        const redirectUrl = req.query.url;
        if (!csrfToken || !redirectUrl) {
          res.status(401).send({ error: 'Bad request' });
          return;
        }

        // get a fully configured oauth client
        const oauth = getOAuthClient(configData);

        // generate authorizationURI 
        const authorizationURI = oauth.authorizationCode.authorizeURL({
          redirect_uri: `${environment.getUrl()}/oauth/callback/${providerName}`,
          /* Specify how your app needs to access the user’s account. */
          scope: '',
          /* State helps mitigate CSRF attacks & Restore the previous state of your app */
          state: `url=${redirectUrl}&csrf=${csrfToken}&providerName=${providerName}`,
        })
      
        // redirect user to authorizationURI 
        res.redirect(authorizationURI);
        /*
        return {
          statusCode: 302,
          headers: {
            Location: authorizationURI,
            'Cache-Control': 'no-cache' // Disable caching of this response
          },
          body: '' // return body for local dev
        }
        */
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
      try {
        // get the grant code and state
        const code = req.query.code;
        const state = querystring.parse(req.query.state);

        // get provider name and configuration data
        const providerName = req.params.provider;
        const configData = await config.getConfig(providerName);
        if (!configData) {
          const url = `${state.url}#message=error`;
          res.redirect(url);
          return;
        }

        // get a fully configured oauth client
        const oauth = getOAuthClient(configData);

        // exchange the grant code for an access token 
        const authorizationToken = await oauth.authorizationCode.getToken({
          code: code,
          redirect_uri: `${environment.getUrl()}/oauth/callback`,
          client_id: configData.client_id,
          client_secret: configData.client_secret
        });

        const authResult = oauth.accessToken.create(authorizationToken);

        const token = authResult.token.access_token;
        console.log(authResult);


        // return {
        //   statusCode: 200,
        //   body: JSON.stringify({
        //     user: user,
        //     authResult: authResult,
        //     state: state,
        //     encode: Buffer.from(token, 'binary').toString('base64')
        //   })
        // }

        const encodedUserData = querystring.stringify({
          email: user.email || "NA",
          full_name: user.full_name || "NA",
          avatar: user.avatar_url || "NA"
        })

        /* Redirect user to authorizationURI */
        const url = `${state.url}#${encodedUserData}&csrf=${state.csrf}&token=${Buffer.from(token, 'binary').toString('base64')}`;
        res.redirect(url);

        /*
        return {
          statusCode: 302,
          headers: {
            Location: `${state.url}#${encodedUserData}&csrf=${state.csrf}&token=${Buffer.from(token, 'binary').toString('base64')}`,
            'Cache-Control': 'no-cache' // Disable caching of this response
          },
          body: '' // return body for local dev
        }
        */
      } catch (error) {
        console.error(`oauthcallback: caught exception: ${error}`);
        // TODO: construct a different URL to indicate error!
        const url = `${state.url}#${encodedUserData}&csrf=${state.csrf}&token=${Buffer.from(token, 'binary').toString('base64')}`;
        res.redirect(url);
        /*
        return {
          statusCode: e.statusCode || 500,
          body: JSON.stringify({
            error: e.message,
          })
        }
        */
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
      tokenPath: configData.token_path,
      authorizePath: configData.authorize_path
    }
  });
  return client;
}
