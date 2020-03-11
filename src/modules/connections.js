// connection management layer

// exports:
//   createHandlers(app): create handlers for GET and POST endpoints
//   getConnectionInfo(userId, provider): return connection information for the userId and provider

const database = require('../data/database');
const providers = require('../providers/providers');
const requesthandler = require('./requesthandler');

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
      res.status(200).send({ message: 'success'});
    }
  
    const remove = async () => {
      await removeConnection(req.userId, provider);
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
}

exports.getConnectionInfo = async (userId, provider) => {
  const connection = await database.getUserData(userId, provider);
  const connectionInfo = connection && connection.connectionInfo;
  return connectionInfo;
}

const addConnection = async (userId, connection, connectionInfo) => {
  await database.setUserData(userId, connection, { connected: true, connectionInfo: connectionInfo });
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
      const connected = user[name] && user[name].connected !== false ? 'linked' : null;
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

const removeConnection = async (userId, connection) => {
  await database.removeConnection(userId, connection);
}
