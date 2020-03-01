// snap engine 
// 
// exports:
//   parseDefinition: parse a yaml definition into a snap object
//   triggerSnap: trigger a snap

const database = require('../data/database');
const dbconstants = require('../data/database-constants');
const YAML = require('yaml');

exports.parseDefinition = (definition) => {
  try {
    const snap = YAML.parse(definition);
    // TODO: validation
    return snap;
  } catch (error) {
    console.log(`parseDefinition: caught exception: ${error}`);
    return null;
  }
}

// trigger a snap
exports.triggerSnap = async (userId, snapId) => {
  try {
  } catch (error) {
    console.log(`triggerSnap: caught exception: ${error}`);
    return null;
  }
}
