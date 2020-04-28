// netlify authentication utilities
// 
// exports:
//   getNetlifyAccessInfo(userId): abstracts all logic to retrieve a netlify access token / userid

const database = require('../data/database');

exports.getNetlifyAccessInfo = async (userId) => {
  const user = await database.getUserData(userId, 'netlify');
  return user;
};
