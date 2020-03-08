// connection management layer

// exports:
//   addConnection: add a (simple) connection
//   getConnections: return user connections
//   removeConnection: remove a (simple) connection

const database = require('../data/database');
const providers = require('../providers/providers');

exports.addConnection = async (userId, connection) => {
  await database.setUserData(userId, connection, { connected: true });
}

exports.getConnections = async (userId) => {
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

exports.removeConnection = async (userId, connection) => {
  await database.removeConnection(userId, connection);
}
