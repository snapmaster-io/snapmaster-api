// an in-memory implementation of the database API

// initialize the users hash (current storage method)
const users = {};

// get all users
exports.getAllUsers = async () => {
  // return all the user names as an array
  return users.keys;
}

// get user data by userid 
exports.getUserData = async (userId, connection) => {
  const user = users[userId];
  // if a connection name was passed, return that data, otherwise the entire user struct
  return connection ? 
         user && user[connection] : 
         user;
};

// store user data by userid
exports.setUserData = async (
  userId,            // userid to store data for
  connection,        // connection key
  data) => {         // data to store
  try {
    // store the access token in the users hash
    const user = users[userId] || {};
    const connectionData = user[connection] || {};
    const mergedData = {...connectionData, ...data };

    // store the new connection data for this user
    user[connection] = mergedData;
    users[userId] = user;

    // return the refreshed connection data
    return mergedData;
  } catch (error) {
    console.log(`setUserData: caught exception: ${error}`);
    return null;
  }
}

// remove a connection from a userid
exports.removeConnection = async (
  userId,            // userid to store data for
  connection) => {   // connection key
  try {
    // get the current user record 
    const user = users[userId];
    if (!user) {
      // nothing to do for an empty user record
      return null;
    }

    // remove this connection data for this user
    user[connection] = undefined;

    // return the refreshed user hash
    return user;
  } catch (error) {
    console.log(`removeConnection: caught exception: ${error}`);
    return null;
  }
}

// calculate whether an token has expired based on this provider
exports.tokenExpired = (user) => {
  try {
    const timestamp = user.expiresAt;
    const now = Date.now();
    if (timestamp > now) {
      return false;
    }
    return true;
  } catch (error) {
    console.log(`tokenExpired: caught exception: ${error}`);
    return true;
  }
}

