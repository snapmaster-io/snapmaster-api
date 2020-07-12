// connection management layer

// exports:
//   createHandlers(app): create handlers for GET and POST endpoints
//   getConnectionInfo(userId, connection): retrieves secrets associated with this connection

const database = require('../data/database');
const providers = require('../providers/providers');
const requesthandler = require('./requesthandler');
const entities = require('./entities');
const credentials = require('./credentials');
const auth0 = require('../services/auth0');
const dbconstants = require('../data/database-constants');
const { successvalue, errorvalue } = require('./returnvalue');

exports.createHandlers = (app) => {
  // Get connections API endpoint
  app.get('/connections', requesthandler.checkJwt, requesthandler.processUser, function(req, res){
    (async () => res.status(200).send(await getConnections(req.userId)))();
  });
  
  // Post connections API endpoint adds or removes a simple connection
  app.post('/connections', requesthandler.checkJwt, requesthandler.processUser, function(req, res){
    const action = req.body && req.body.action;
    const provider = req.body && req.body.provider;
    if (!action) {
      res.status(200).send(errorvalue('action not found in request body'));
    } 
    if (!provider) {
      res.status(200).send(errorvalue('provider not found in request body'));
    } 
    
    if (action === 'add') {
      // note: addConnection will return the HTTP status and response on the res object
      (async () => await addConnection(req, res))();
      return;
    }
  
    if (action === 'remove') {
      (async () => res.status(200).send(await removeConnection(req.userId, provider, req.body.entityName)))();
      return;
    }
  
    if (action === 'removeoauth') {
      (async () => res.status(200).send(await removeOauth(req.userId, provider)))();
      return;
    }

    res.status(200).send(errorvalue('Unknown action'));
  });

  // Link API endpoint
  // body: 
  //  { 
  //    action: 'link' | 'unlink',
  //    primaryUserId <could be empty, in which case use req.user[sub]>
  //    secondaryUserId <in the format 'provider|userid'>
  //  }
  app.post('/link', requesthandler.checkJwt, function(req, res){
    const userId = req.body && req.body.primaryUserId || req.user['sub'];
    const action = req.body && req.body.action;
    const secondaryUserId = req.body && req.body.secondaryUserId;
    console.log(`POST /link: ${action} ${userId}, ${secondaryUserId}`);

    const link = async () => {
      // link accounts
      const data = await auth0.linkAccounts(userId, secondaryUserId);

      // set refresh history flag
      if (data) {
        await database.setUserData(userId, dbconstants.refreshHistory, { refresh: true });
        res.status(200).send(successvalue(data));
      } else {
        res.status(200).send(errorvalue('link failed'));
      }
    }

    const unlink = async () => {
      const data = await auth0.unlinkAccounts(userId, secondaryUserId);
      if (data) {
        res.status(200).send(successvalue(data));
      } else {
        res.status(200).send(errorvalue('unlink failed'));
      }
    }

    if (action === 'link' && userId && secondaryUserId) {
      link();
      return;
    }

    if (action === 'unlink' && userId && secondaryUserId) {
      unlink();
      return;
    }

    res.status(200).send(errorvalue('Unknown action'));
  });
}

exports.getConnectionInfo = async (userId, connection) => {
  const userData = await database.getUserData(userId, connection);
  if (!userData) {
    console.error(`getConnectionInfo: error getting connection ${connection} for user ${userId}`);
    return null;
  }

  // if there is a key field, then connection information was stored in a secret store
  if (userData[dbconstants.keyField]) {
    const value = await credentials.get(userId, userData[dbconstants.keyField]);
    const parsedValue = JSON.parse(value);
    return parsedValue;
  }

  // return the connection information stored directly in the userInfo structure
  return userData.connectionInfo || userData;
}

const addConnection = async (req, res) => {
  try {
    // get all parameter values
    const userId = req.userId;
    const connection = req.body.provider; 
    const connectionInfo = req.body.connectionInfo;
    let entity = req.body.entityName;

    // normalize connection info into a single object
    const connectionInfoObject = {};
    for (const param of connectionInfo) {
      connectionInfoObject[param.name] = param.value;
    }

    // get the provider definition and the entity name
    const provider = providers.getProvider(connection);
    if (!provider) {
      const message = `could not find provider ${connection}`;
      console.error(`addConnection: ${message}`);
      res.status(200).send(errorvalue(message));
      return;
    }

    // store the default credentials for the connection
    const jsonValue = JSON.stringify(connectionInfoObject);
    const name = await credentials.set(userId, `${userId}:${connection}`, jsonValue);

    // store the connection in the user data document
    const userData = { connected: true };
    userData[dbconstants.keyField] = name;
    await database.setUserData(userId, connection, userData);

    if (!entity) {
      entity = provider.definition.connection && provider.definition.connection.entity;
    }

    // check for no entity
    if (!entity) {
      res.status(200).send(successvalue(null));
      return;
    }

    // add the entity and allow the handler to return the HTTP response
    req.body.entityName = entity;
    entities.entityHandler(req, res);
  } catch (error) {
    console.error(`addConnection: caught exception: ${error}`);
    res.status(200).send(errorvalue(error.message, error));
  }
}

const getConnections = async (userId) => {
  try {
    const user = await database.getUserData(userId) || {};
    const [baseConnection] = userId.split('|');    

    // retrieve the provider definitions for all the registered providers
    const providerDefinitions = providers.providerDefinitions();

    // generate an array of connections which includes conneted state
    const connections = providerDefinitions.map(p => {
      const name = p.name;
      let connected = user[name] && user[name].connected !== false ? 'linked' : null;
      // if the connection is the same as the provider of the base userId, note it that way
      if (name === baseConnection) {
        connected = 'base';
      }
      // set title to first element of name in the format like google-oauth2
      const [title] = name.split('-');

      const uid = user[name] && user[name].userId;
      const image = p.definition && p.definition.imageUrl;
      const type = p.definition.connection && p.definition.connection.type;

      return ({ 
        provider: name, 
        connected: connected,
        title: title,
        image: image || `/${name}-logo.png`,
        icon: `cloudfont-${title}`,
        type: type,
        definition: p.definition,
        userId: uid
      })
    });

    return successvalue(connections);
  } catch (error) {
    console.error(`connections: caught exception: ${error}`);
    return errorvalue(error.message, error);
  }
}

const removeConnection = async (userId, connection, entity) => {
  try {
    const userData = await database.getUserData(userId, connection);
    if (!userData) {
      const message = `could not find connection ${connection} for user ${userId}`;
      console.error(`removeConnection: ${message}`);
      return errorvalue(message);
    }

    // if a key for a secret was stored, remove the secret
    if (userData[dbconstants.keyField]) {
      await credentials.remove(userId, userData[dbconstants.keyField]);
    }

    // remove the connection 
    await database.removeConnection(userId, connection);

    // get the provider definition and the entity name
    const provider = providers.getProvider(connection);
    if (!provider) {
      const message = `could not find provider ${connection}`;
      console.error(`removeConnection: ${message}`);
      return errorvalue(message);
    }

    if (!entity) {
      entity = provider.definition.connection && provider.definition.connection.entity;
    }

    // check for no entity
    if (!entity) {
      return successvalue(null);
    }

    // get all entities in the entity collection for this connection
    const entities = await database.query(userId, entity);
    if (entities && entities.length) {
      for (const entity of entities) {
        // if a key for a secret was stored, remove the secret
        if (entity[dbconstants.keyField]) {
          await credentials.remove(userId, entity[dbconstants.keyField]);
        }
      }
    }

    // remove all connection entities
    await database.removeCollection(userId, entity);

    return successvalue(null);
  } catch (error) {
    console.error(`removeConnection: caught exception: ${error}`);
    return errorvalue(error.message, error);
  }
}

const removeOauth = async (userId, provider) => {
  try {
    await database.removeConnection(userId, provider);
    return successvalue(null);
  } catch (error) {
    console.error(`removeOauth: caught exception: ${error}`);
    return errorvalue(error.message, error);
  }
}
