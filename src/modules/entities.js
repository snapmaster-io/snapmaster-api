// general-purpose module for returning provider-specific entities 
// this is used to fill dropdowns for clients
// 
// this module validates the provider and entity to add a layer of indirection between
// the client and the service, and prevent injection attacks when snap authors supply 
// malformed or malicious entity names

// exports:
//   createHandlers(app): create handlers for GET endpoint
//   entityHandler(req, res): handle entity operations (get, add, edit, remove)

const database = require('../data/database')
const dbconstants = require('../data/database-constants')
const providers = require('../providers/providers');
const requesthandler = require('./requesthandler');
const credentials = require('./credentials');
const connections = require('./connections');

exports.createHandlers = (app) => {
  // entities API endpoint
  app.use('/entities/:entityName', requesthandler.checkJwt, requesthandler.processUser, exports.entityHandler);
}

exports.entityHandler = (req, res) => {
  try {
    // get the entity name from the parameters
    let entity = req.params.entityName || req.body.entityName;

    // get the provider for the entity
    let [providerName, entityName] = entity.split(':');
    if (!providerName) {
      console.error(`getEntities: could not retrieve provider from entity ${entity}`);
      res.status(200).send([]);
      return;
    }

    // get the provider 
    const provider = providers.getProvider(providerName);
    if (!provider) {
      console.error(`getEntities: could not retrieve provider ${providerName}`);
      res.status(200).send([]);
      return;
    }

    // if an entity name wasn't specified, get the connection entity
    if (!entityName) {
      const name = provider.definition.connection && provider.definition.connection.entity;
      if (!name) {
        console.error(`getEntities: could not retrieve default entity for provider ${providerName}`);
        res.status(200).send([]);  
        return;
      }

      // since the entity name wasn't specificed, replace it with the connection entity name
      entity = name;      
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
    
    if (req.method === 'GET') {
      getHandler(req, res, providerEntity);
      return;
    } 
  
    // invoke the POST entity handler
    if (req.method === 'POST') {
      postHandler(req, res, provider, providerEntity);
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

const postHandler = (req, res, provider, entity) => {  
  const action = req.body && req.body.action;

  // construct the api description that the DAL machinery expects
  const apiDescription = { ...entity, func: entity.entityHandler };
  
  const add = async () => {
    // use the generic edit handler as the function the DAL will call
    apiDescription.func = addHandler;
    // use the entity's func as the function the DAL will call
    //apiDescription.func = entity.func;
    requesthandler.invokeProvider(
      res, 
      req.userId, 
      apiDescription, 
      null,     // use the default entity name
      //[req.body.connectionInfo]); // parameter array
      [req.userId, entity, req.body.connectionInfo]);
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

// generic add handler
const addHandler = async ([userId, entity, connectionInfo]) => {
  try {
    // 
    const entityName = entity.entity;
    const connection = entity.provider;
    const func = entity.func;

    const defaultConnInfo = await connections.getConnectionInfo(userId, connection);

    const response = await func([connectionInfo, defaultConnInfo]);
    if (!response) {
      return { message: 'could not add the new entity'};
    }

    // store any secrets in the secret store
    if (response.secret) {
      const secretId = response[entity.itemKey];
      const jsonValue = JSON.stringify(response.secret);
      const key = await credentials.set(userId, `${userId}:${entityName}:${secretId}`, jsonValue);

      // substitute the key name for the secret info in the response
      response[dbconstants.keyField] = key;
      delete response.secret;
    }

    return [response];
  } catch (error) {
    console.log(`addHandler: caught exception: ${error}`);
    return null;
  }
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
    console.log(`editHandler: caught exception: ${error}`);
    return null;
  }
}

// generic remove handler
const removeHandler = async ([userId, entityName, id]) => {
  try {
    // get the key if it exists
    const connectionInfo = await database.getDocument(userId, entityName, id);
    if (connectionInfo && connectionInfo[dbconstants.keyField]) {
      // remove the secret associated with the key
      credentials.remove(userId, connectionInfo[dbconstants.keyField]);
    }

    // remove the document from the entity collection
    await database.removeDocument(userId, entityName, id);

    // invokeProvider will re-read the entity collection and return it
    return [];
  } catch (error) {
    console.log(`removeHandler: caught exception: ${error}`);
    return null;
  }
}
