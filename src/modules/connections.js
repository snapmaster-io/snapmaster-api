// connection management layer

// exports:
//   addConnection: add a (simple) connection
//   getConnections: return user connections
//   removeConnection: remove a (simple) connection

const database = require('../data/database');

exports.addConnection = async (userId, connection) => {
  await database.setUserData(userId, connection, { connected: true });
}

exports.getConnections = async (userId) => {
  const connectionList = {
    twitter: {
      type: 'link',
      image: '/twitter-logo.png'
    },
    facebook: {
      type: 'link',
      image: '/facebook-logo.png'
    },
    yelp: {
      type: 'simple',
      image: '/yelp-logo.png'
    },
    'google-oauth2': {
      type: 'link',
      image: '/google-logo.png'
    },
    instagram: {
      type: 'link',
      image: '/instagram-logo.png'
    },
  };

  try {
    const user = await database.getUserData(userId) || {};
    const [provider] = userId.split('|');
    const connections = Object.keys(connectionList).map((key) => {
      // connected can be 'base' for base connection, 'linked' for linked connection, or null
      var connected = user[key] ? 'linked' : null;

      // if the connection is the same as the provider of the base userId, note it that way
      if (key === provider) {
        connected = 'base';
      }

      const uid = user[key] && user[key].userId;

      return ({ 
        provider: key, 
        connected: connected,
        image: connectionList[key].image,
        type: connectionList[key].type,
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
