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
    aws: {
      type: 'simple',
      image: '/aws-logo.jpg'
    },
    azure: {
      type: 'simple',
      image: '/azure-logo.png'
    },
    circleci: {
      type: 'simple',
      image: '/circleci-logo.png'
    },
    gcp: {
      type: 'simple',
      image: '/gcp-full-logo.png'
    },
    github: {
      type: 'simple',
      image: '/github-dark-logo.png'
    },
    gitlab: {
      type: 'simple',
      image: '/gitlab-logo.png'
    },
    slack: {
      type: 'simple',
      image: '/slack-logo.png'
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
