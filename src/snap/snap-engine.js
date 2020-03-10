// snap engine 
// 
// exports:
//   parseDefinition: parse a yaml definition into a snap object
//   triggerSnap: trigger a snap

const database = require('../data/database');
const dbconstants = require('../data/database-constants');
const snapdal = require('./snap-dal');
const YAML = require('yaml');

// execute a snap that has been triggered
exports.executeSnap = async (userId, activeSnapId, params) => {
  try {
    // validate incoming userId and activeSnapId
    if (!userId || !activeSnapId) {
      return null;
    }

    // get activeSnap object
    const activeSnap = await database.getDocument(userId, dbconstants.activeSnapsCollection, activeSnapId);
    if (!activeSnap) {
      return { message: `could not find active snap ID ${activeSnapId}`};
    }

    // load snap definition via snapId
    const snap = await snapdal.getSnap(userId, activeSnap.snapId);
    if (!snap) {
      console.error(`executeSnap: cannot find snapId ${activeSnap.snapId}`);
      return null;
    }

    console.log(`executing snap ${snap.snapId}`);

    // execute actions
    for (const action of snap.actions) {
      console.log(`executeSnap action: ${action}, params: ${params && params.map && params[0]}`);
    }

  } catch (error) {
    console.log(`executeSnap: caught exception: ${error}`);
    return null;
  }
}

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

