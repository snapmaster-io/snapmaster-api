// requesthandler contains helper routines to call providers and return HTTP results
//
// exports:
//   checkJwt: middleware for checking javascript web token
//   processUser: middleware for processing an incoming user
// 
//   getData(res, userId, provider, entity, params, forceRefresh): get data from cache or provider
//   invokeProvider(res, userId, provider, entity, params, returnResult): invoke provider, cache, and return data
//   queryProvider(res, userId, provider, params, returnResult): invoke provider and simply return the result
//   storeMetadata(res, userId, provider, entity, data): store metadata and return new collection

const jwt = require('express-jwt');
const jwksRsa = require('jwks-rsa');
const dal = require('../data/dal');
const environment = require('../modules/environment');
const domain = environment.getOAuth2Domain();
const audience = environment.getOAuth2Audience();

// Create middleware for checking the JWT
exports.checkJwt = jwt({
  // Dynamically provide a signing key based on the kid in the header and the signing keys provided by the JWKS endpoint
  secret: jwksRsa.expressJwtSecret({
    cache: true,
    rateLimit: true,
    jwksRequestsPerMinute: 5,
    jwksUri: `https://${domain}/.well-known/jwks.json`
  }),

  // Validate the audience and the issuer
  audience: audience, 
  issuer: `https://${domain}/`,
  algorithms: [ 'RS256' ]
});
  
// create middleware that will log all requests, including userId, email, and impersonated UserId
// it will also set the userId property on the request object for future pipeline stages
exports.processUser = (req, res, next) => {
  const userId = req.user['sub'];
  const email = req.user[`${audience}/email`];
  const impersonatedUserId = req.headers.impersonateduser;
  const processingAs = impersonatedUserId ? `, processing as ${impersonatedUserId}` : '';
  console.log(`${req.method} ${req.url}: userId: ${userId} email: ${email}${processingAs}`);
  req.userId = impersonatedUserId || userId;
  next();
};


// async function to retrieve provider data (either from storage cache
// or directly from provider), update cache, and return the result
//   
//   res: response object
//   userId: userId for this request
//   provider: data provider to call
//   entity: entity to retrieve
//   params: extra parameters to pass into the data provider function
//   forceRefresh: whether to force re-loading the data from provider 
exports.getData = async (
  res,          // response object
  userId,       // userId for this request
  provider,     // provider object
  entity,       // entity to retrieve (null for default)
  params,       // array of parameters to pass to the function
  forceRefresh  // flag for whether to force refresh
  ) => {
  try {
    // retrieve the data from the data access layer
    const data = await dal.getData(userId, provider, entity, params, forceRefresh, false);
    if (!data) {
      console.log('getData: no data returned');
      res.status(200).send({ message: 'no data returned'});
      return;
    }

    // SUCCESS! send the data back to the client
    res.status(200).send(data);
    return;
  } catch (error) {
    await error.response;
    console.log(`getData: caught exception: ${error}`);
    res.status(200).send({ message: error });
    return;
  }
};

// async function to invoke the provider and return the result 
//   
//   res: response object
//   userId: userId for this request
//   provider: data provider to call
//   entity: entity to retrieve
//   params: extra parameters to pass into the data provider function
//   returnResult: flag for whether to return a HTTP response from this function
exports.invokeProvider = async (
  res,          // response object
  userId,       // userId for this request
  provider,     // provider object
  entity,       // entity to retrieve (null for default)
  params,       // array of parameters to pass to the function
  returnResult = true // flag to indicate whether to return results
  ) => {
  try {
    // invoke the provider and retrieve the data from the data access layer
    const data = await dal.invokeProvider(userId, provider, entity, params);
    if (!data) {
      console.log('invokeProvider: no data returned');
      if (returnResult) {
        res.status(200).send({ message: 'no data returned'});
      }
      return;
    }

    // SUCCESS! send the data back to the client
    if (returnResult) {
      res.status(200).send(data);
    }
    return;
  } catch (error) {
    await error.response;
    console.log(`invokeProvider: caught exception: ${error}`);
    if (returnResult) {
      res.status(200).send({ message: error });
    }
  }
};

// async function to query the provider and return the result 
//   
//   res: response object
//   provider: data provider to call
//   params: extra parameters to pass into the data provider function
//   returnResult: flag for whether to return a HTTP response from this function
exports.queryProvider = async (
  res,          // response object
  provider,     // provider object
  params,       // array of parameters to pass to the function
  returnResult = true // flag to indicate whether to return results
  ) => {
  try {
    // invoke the provider and retrieve the data from the data access layer
    const data = await dal.queryProvider(provider, params);
    if (!data) {
      console.log('queryProvider: no data returned');
      if (returnResult) {
        res.status(200).send({ message: 'no data returned'});
      }
      return;
    }

    // SUCCESS! send the data back to the client
    if (returnResult) {
      res.status(200).send(data);
    }
    return;
  } catch (error) {
    await error.response;
    console.log(`queryProvider: caught exception: ${error}`);
    if (returnResult) {
      res.status(200).send({ message: error });
    }
  }
};

// store metadata associated with a set of data objects
//   data is in the following format:
//     [
//       { id: key1, meta1: value1, meta2: value2, ... },
//       { id: key2, meta1: value1, meta2: value2, ... },
//     ]
exports.storeMetadata = async (
  res,          // response object
  userId,       // userId for this request
  provider,     // provider object
  entity,       // entity to store metadata for
  data          // request data
  ) => {
  try {
    // use the data access layer to store the metadata
    await dal.storeMetadata(userId, provider, entity, data);

    // return the refreshed data
    // BUGBUG: [userId] isn't right for FB pages, should be passed in!
    const newData = await dal.getData(userId, provider, entity, [userId], false, false);

    // SUCCESS! send a success code back to client, with the new data
    res.status(200).send(newData);
    return;
  } catch (error) {
    await error.response;
    console.log(`storeMetadata: caught exception: ${error}`);
    res.status(200).send({ message: error });
    return;
  }
};
