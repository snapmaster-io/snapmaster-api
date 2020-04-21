// HTTP POST provider

// exports:
//   createHandlers(app): create all route handlers
//   createTrigger: use the cross-service generic implementation (not in-tree)
//   deleteTrigger: use the cross-service generic implementation (not in-tree)
// 
//   entities.
//        names - the names entity
// 
//   provider: provider name
//   image: provider image url (local to SPA)
//   type: provider type (simple or link)
//   definition: provider definition

const provider = require('../provider');

// createTrigger and deleteTrigger are implemented by a separate service
exports.createTrigger = provider.createTrigger;
exports.deleteTrigger = provider.deleteTrigger;

const providerName = 'httppost';
const entityName = `${providerName}:webhooks`;
const defaultEntityName = `${entityName}:default`;

exports.provider = providerName;
exports.image = `/${providerName}-logo.png`;
exports.type = provider.simpleProvider;
exports.definition = provider.getDefinition(providerName);

// entities defined by this provider
exports.entities = {};
exports.entities[entityName] = {
  entity: entityName,
  provider: providerName,
  itemKey: '__id',
  keyFields: ['secret'],
};

exports.createHandlers = (app) => {
}

// this function is called when a new entity (e.g. account) is added
// it validates the provider-specific account info, and constructs 
// the entity that will be stored by the caller
exports.entities[entityName].func = async ([connectionInfo]) => {
  try {
    // construct an object with all entity info
    const entity = {};
    for (const param of connectionInfo) {
      entity[param.name] = param.value;
    }

    // verify we have everything we need to authenticate
    if (!entity.webhook || !entity.secret) {
      console.error('entityHandler: did not receive all authorization information');
      return null;
    }

    // add the entity attributes to the result
    const result = { 
      secret: {
        ...entity, 
      },
      __id: entity.webhook,
      __name: entity.webhook,
      __triggers: exports.definition.triggers,
      __actions: exports.definition.actions,
    };

    return result;
  } catch (error) {
    await error.response;
    console.log(`entityHandler: caught exception: ${error}`);
    return null;
  }
}
