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

exports.createHandlers = (app) => {
  // Get connections API endpoint
  //app.get('/connections', checkJwt, jwtAuthz(['read:timesheets']), function(req, res){
  app.get('/connections', requesthandler.checkJwt, requesthandler.processUser, function(req, res){
    const returnConnections = async () => {
      const conns = await getConnections(req.userId) || {};
      res.status(200).send(conns);
    }
    returnConnections();
  });
  
  // Post connections API endpoint adds or removes a simple connection
  app.post('/connections', requesthandler.checkJwt, requesthandler.processUser, function(req, res){
    const action = req.body && req.body.action;
    const provider = req.body && req.body.provider;
  
    const add = async () => {
      await addConnection(req.userId, provider, req.body.connectionInfo);
      entities.entityHandler(req, res);

      //res.status(200).send({ message: 'success'});
    }
  
    const remove = async () => {
      await removeConnection(req.userId, provider, req.body.entityName);
      res.status(200).send({ message: 'success'});
    }
  
    if (action === 'add' && provider) {
      add();
      return;
    }
  
    if (action === 'remove' && provider) {
      remove();
      return;
    }
  
    res.status(200).send({ message: 'Unknown action'});  
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
        res.status(200).send(data);  
      } else {
        res.status(200).send({ message: 'link failed' });
      }
    }

    const unlink = async () => {
      const data = await auth0.unlinkAccounts(userId, secondaryUserId);
      res.status(200).send(data || { message: 'unlink failed' });
    }

    if (action === 'link' && userId && secondaryUserId) {
      link();
      return;
    }

    if (action === 'unlink' && userId && secondaryUserId) {
      unlink();
      return;
    }

    res.status(200).send({ message: 'Unknown action'});
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
  return userData.connectionInfo;
}

const addConnection = async (userId, connection, connectionInfo) => {
  const jsonValue = JSON.stringify(connectionInfo);
  const name = await credentials.set(userId, `${userId}:${connection}`, jsonValue);
  const userData = { connected: true };
  userData[dbconstants.keyField] = name;
  await database.setUserData(userId, connection, userData);
}

const getConnections = async (userId) => {
  try {
    const user = await database.getUserData(userId) || {};
    const [baseConnection] = userId.split('|');    

    // retrieve the provider definitions for all the registered providers
    const providerDefinitions = providers.providerDefinitions();

    // generate an array of connections which includes conneted state
    const connections = providerDefinitions.map(p => {
      const name = p.provider;
      let connected = user[name] && user[name].connected !== false ? 'linked' : null;
      // if the connection is the same as the provider of the base userId, note it that way
      if (name === baseConnection) {
        connected = 'base';
      }

      const uid = user[name] && user[name].userId;

      return ({ 
        provider: p.provider, 
        connected: connected,
        image: p.image,
        type: p.type,
        definition: p.definition,
        userId: uid
      })
    });

    return connections;
  } catch (error) {
    console.log(`connections: caught exception: ${error}`);
    return {}
  }
}

const removeConnection = async (userId, connection, entity) => {
  const userData = await database.getUserData(userId, connection);
  if (!userData) {
    console.error(`removeConnection: error getting connection ${connection} for user ${userId}`);
    return null;
  }

  // if a key for a secret was stored, remove the secret
  if (userData[dbconstants.keyField]) {
    await credentials.remove(userId, userData[dbconstants.keyField]);
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

  // remove the connection and any entity information associated with it
  await database.removeConnection(userId, connection);
  await database.removeCollection(userId, entity);
}
