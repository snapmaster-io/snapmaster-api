// general-purpose module for returning provider-specific entities 
// this is used to fill dropdowns for clients
// 
// this module validates the provider and entity to add a layer of indirection between
// the client and the service, and prevent injection attacks when snap authors supply 
// malformed or malicious entity names

// exports:
//   createHandlers(app): create handlers for GET endpoint

const providers = require('../providers/providers');
const requesthandler = require('./requesthandler');

exports.createHandlers = (app) => {
  // entities API endpoint
  app.use('/entities/:entityName', requesthandler.checkJwt, requesthandler.processUser, getEntities);
}

const getEntities = (req, res) => {
  try {
    // get the entity name from the parameters
    const entity = req.params.entityName;

    // get the provider for the entity
    const [providerName] = entity.split(':');

    // get the provider 
    const provider = providers.getProvider(providerName);
    if (!provider) {
      console.error(`getEntities: could not retrieve provider ${provider}`);
      res.status(200).send([]);
      return;
    }
    
    // validate entity
    const providerEntities = provider.entities;
    if (!providerEntities) {
      console.error(`getEntities: provider ${provider} does not support any entities`);
      res.status(200).send([]);
      return;
    }
    const providerEntity = providerEntities[entity];
    if (!providerEntity) {
      console.error(`getEntities: provider ${provider} does not support entity ${entity}`);
      res.status(200).send([]);
      return;
    }
    
    // invoke the GET entity handler
    if (req.method === 'GET' && providerEntity.get) {
      providerEntity.get(req, res);
      return;
    } 
    
    // invoke the POST entity handler
    if (req.method === 'POST' && providerEntity.post) {
      providerEntity.post(req, res);
      return;
    } 

    // return an empty result
    res.status(200).send([]);
  } catch (error) {
    console.log(`getEntities: caught exception: ${error}`);
    res.status(200).send([]);
  }
}
