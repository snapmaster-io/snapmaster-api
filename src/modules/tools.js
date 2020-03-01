// tools management layer

// exports:
//   getTools: return available tools

const database = require('../data/database');

exports.getTools = async (userId) => {
  const toolList = {
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
