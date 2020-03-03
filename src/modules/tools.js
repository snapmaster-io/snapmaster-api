// tools management layer

// exports:
//   getTools: return available tools

const database = require('../data/database');

exports.getTools = async (userId) => {
  const toolList = {
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
    const tools = Object.keys(toolList).map((key) => {
      // connected can be 'linked' for linked connection, or null
      var connected = user[key] ? 'linked' : null;

      const uid = user[key] && user[key].userId;

      return ({ 
        provider: key, 
        connected: connected,
        image: toolList[key].image,
        type: toolList[key].type,
        userId: uid
      })
    });

    return tools;
  } catch (error) {
    console.log(`getTools: caught exception: ${error}`);
    return {}
  }
}
