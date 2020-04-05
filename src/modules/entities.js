// general-purpose module for returning provider-specific entities 
// this is used to fill dropdowns for clients
// 
// this module validates the provider and entity to add a layer of indirection between
// the client and the service, and prevent injection attacks when snap authors supply 
// malformed or malicious entity names

// exports:
//   createHandlers(app): create handlers for GET endpoint

const database = require('../data/database')
const providers = require('../providers/providers');
const requesthandler = require('./requesthandler');

exports.createHandlers = (app) => {
  // entities API endpoint
  app.use('/entities/:entityName', requesthandler.checkJwt, requesthandler.processUser, handler);
}

const handler = (req, res) => {
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
      console.error(`getEntities: ${provider.provider} provider does not support any entities`);
      res.status(200).send([]);
      return;
    }
    const providerEntity = providerEntities[entity];
    if (!providerEntity) {
      console.error(`getEntities: ${provider.provider} provider does not support entity ${entity}`);
      res.status(200).send([]);
      return;
    }
    
    // invoke the GET entity handler
    /*
    if (req.method === 'GET' && providerEntity.get) {
      providerEntity.get(req, res);
      return;
    } 
    */
    if (req.method === 'GET') {
      getHandler(req, res, providerEntity);
      return;
    } 
  
    // invoke the POST entity handler
    if (req.method === 'POST') {
      postHandler(req, res, providerEntity);
      return;
    } 

    // return an empty result
    res.status(200).send([]);
  } catch (error) {
    console.log(`handler: caught exception: ${error}`);
    res.status(200).send([]);
  }
}

const getHandler = (req, res, entity) => {
  // construct the api description that the DAL machinery expects
  const apiDescription = { ...entity };
  apiDescription.func = () => []; // just return an empty array and let the DAL to the real work

  requesthandler.invokeProvider(
    res, 
    req.userId, 
    apiDescription, 
    null,     // use the default entity name
    [req.userId]); // parameter array
}

const postHandler = (req, res, entity) => {  
  const action = req.body && req.body.action;

  // construct the api description that the DAL machinery expects
  const apiDescription = { ...entity, func: entity.entityHandler };
  
  const add = async () => {
    // use the entity's func as the function the DAL will call
    apiDescription.func = entity.func;
    requesthandler.invokeProvider(
      res, 
      req.userId, 
      apiDescription, 
      null,     // use the default entity name
      [req.body.connectionInfo]); // parameter array
  }

  const edit = async () => {
    // use the generic edit handler as the function the DAL will call
    apiDescription.func = editHandler;
    requesthandler.invokeProvider(
      res, 
      req.userId, 
      apiDescription, 
      null,     // use the default entity name
      [req.userId, entity.entity, req.body]); // parameter array
  }

  const remove = async () => {
    // use the generic remove handler as the function the DAL will call
    apiDescription.func = removeHandler; 
    requesthandler.invokeProvider(
      res, 
      req.userId, 
      apiDescription, 
      null,     // use the default entity name
      [req.userId, entity.entity, req.body.id]); // parameter array
  }

  if (action === 'add' && req.body && req.body.connectionInfo) {
    add();
    return;
  }

  if (action === 'edit') {
    edit();
    return;
  }

  if (action === 'remove' && req.body && req.body.id) {
    remove();
    return;
  }

  res.status(200).send({ message: 'Unknown action'}); 
}

// generic edit handler
const editHandler = async ([userId, entityName, payload]) => {
  try {
    // retrieve the entity ID out of the payload
    const id = payload.__id; 
    if (!id) {
      console.error('editHandler: entity ID not found in payload');
      return null;
    }

    // retrieve the document from the entity collection
    const entity = await database.getDocument(userId, entityName, id);

    // remove the action from the payload
    delete payload.action;

    // merge the payload with the existing entity
    const result = { ...entity, ...payload };

    // store the document in the entity collection
    await database.storeDocument(userId, entityName, id, result);      

    // invokeProvider will re-read the entity collection and return it
    return [];
  } catch (error) {
    await error.response;
    console.log(`editHandler: caught exception: ${error}`);
    return null;
  }
}

// generic remove handler
const removeHandler = async ([userId, entityName, id]) => {
  try {
    // remove the document from the entity collection
    await database.removeDocument(userId, entityName, id);

    // invokeProvider will re-read the entity collection and return it
    return [];
  } catch (error) {
    await error.response;
    console.log(`removeHandler: caught exception: ${error}`);
    return null;
  }
}
