// data access layer for abstracting the retrieval of entities
// 
// exports:
//   getData: retrieve an entity and its metadata - from cache or from the provider
//   getHistory: retrieve metadata snapshot history for a userId
//   getMetadata: retrieve all metadata for a userId
//   invokeProvider: invoke a provider method directly
//   storeMetadata: store metadata for a particular entity

const database = require('./database');
const dbconstants = require('./database-constants');
const datapipeline = require('../modules/datapipeline');
const sentiment = require('../services/sentiment');

// retrieve an entity and its metadata - from cache or from the provider
exports.getData = async (userId, provider, entity, params, forceRefresh = false, newFlag = false) => {
  try {
    const providerName = provider && provider.provider;
    const entityName = entity || provider.entity;
    // basic error checking
    if (!providerName || !entityName) {
      console.log(`getData: failed to validate provider ${providerName} / entity ${entityName}`);
      return null;
    }

    // get the __invoke_info document
    const invokeInfo = await database.getDocument(userId, entityName, dbconstants.invokeInfo) || {};
    const lastRetrieved = invokeInfo && invokeInfo.lastRetrieved;
    const now = new Date().getTime();
    const anHourAgo = now - 3600000;

    // declare data
    let data; 

    // retrieve existing metadata
    let metadata = await queryMetadata(userId, entityName);

    // if a refresh isn't forced, and the collection is fresh, return it from cache
    if (!forceRefresh && lastRetrieved > anHourAgo) {
      console.log(`getData: serving ${userId}:${entityName} from cache`);

      // retrieve data from cache
      data = await database.query(userId, entityName);
      if (!data) {
        return null;
      }
    } else {
      console.log(`getData: retrieving ${userId}:${entityName} from provider`);

      // retrieve data from provider
      data = await callProvider(provider, params);
      if (!data) {
        return null;
      }

      // store the data (including invokeInfo document), but do NOT await the operation
      storeData(userId, provider, entityName, params, data, invokeInfo);

      // perform sentiment analysis for new data records, merging with existing metadata
      const sentimentMetadata = await retrieveSentimentMetadata(userId, provider, entityName, data, metadata, newFlag);
      if (sentimentMetadata && sentimentMetadata.length > 0) {

        // store the metadata if it was indeed refreshed, do NOT await the operation
        storeMetadata(userId, entityName, sentimentMetadata);
        metadata = sentimentMetadata;
      }        
    }

    // merge the metadata with the data, and return both together
    const combinedData = mergeMetadataWithData(provider, data, metadata);
    return combinedData;
  } catch (error) {
    console.log(`getData: caught exception: ${error}`);
    return null;
  }
}

// retrieve metadata history for a userId in a timerange
// if passed in, range should be [start, end] where both are integer milliseconds after epoch
exports.getHistory = async (userId, range) => {
  try {
    // check if refreshHistory flag is set, and if so, refresh history and remove flag
    const refreshHistory = await database.getUserData(userId, dbconstants.refreshHistory);
    if (refreshHistory) {
      await datapipeline.refreshHistory(userId);
      await database.removeConnection(userId, dbconstants.refreshHistory);
    }

    // retrieve history and filter for range
    const history = await database.query(userId, dbconstants.history);
    let result = history;
    if (range) {
      const [start, end] = range;
      result = history.filter(e => e.timestamp > start && e.timestamp < end);
    }
    return result;
  } catch (error) {
    console.log(`getHistory: caught exception: ${error}`);
    return null;
  }
}

// retrieve all metadata for all data entities 
exports.getMetadata = async (userId, newFlag) => {
  try {
    if (newFlag) {
      return await database.queryGroup(userId, database.metadata, dbconstants.metadataNewFlag, true);
    } else {
    return await database.queryGroup(userId, database.metadata);
    }
  } catch (error) {
    console.log(`getMetadata: caught exception: ${error}`);
    return null;
  }
}

exports.invokeProvider = async (userId, provider, entity, params) => {
  try {
    const providerName = provider && provider.provider;
    const entityName = entity || provider.entity;
    // basic error checking
    if (!providerName || !entityName) {
      console.log(`getData: failed to validate provider ${providerName} / entity ${entityName}`);
      return null;
    }

    // retrieve data from provider
    let data = await callProvider(provider, params);
    if (!data) {
      return null;
    }

    // if some data was returned, shred the data returned into a batch of documents in the collection
    if (data.length) {
      await database.storeBatch(userId, entityName, data, provider.itemKey);
    }

    // re-retrieve the entity's collection from cache and return it (there may be more than what just got returned)
    data = await database.query(userId, entityName);
    if (!data) {
      return null;
    }

    return data;
  } catch (error) {
    console.log(`invokeProvider: caught exception: ${error}`);
    return null;
  }
}

// store metadata for a particular data entity
exports.storeMetadata = async (userId, provider, entity, metadata) => {
  try {
    const providerName = provider && provider.provider;
    const entityName = entity || provider.entity;
    // basic error checking
    if (!providerName || !entityName) {
      console.log(`storeMetadata: failed to validate provider ${providerName} / entity ${entityName}`);
      return null;
    }

    // merge the new metadata with any existing metadata, and update the database
    await updateMetadata(userId, entityName, provider, metadata);
  } catch (error) {
    console.log(`storeMetadata: caught exception: ${error}`);
    return null;
  }
}

// call the provider to retrieve the entity
const callProvider = async (provider, params) => {
  try {
    const func = provider && provider.func;
    // basic error checking
    if (!func) {
      console.log('callProvider: failed to validate provider function');
      return null;
    }
  
    // retrieve data from provider
    const data = await func(params);
    if (!data) {
      console.log(`callProvider: no data returned from ${provider.provider}:${provider.name}`);
      return null;
    }

    // get array of returned data
    const array = provider.arrayKey ? data[provider.arrayKey] : data;

    // return the data
    return array;
  } catch (error) {
    console.log(`callProvider: caught exception: ${error}`);
    return null;
  }
}

// splice metadata array and data array together, entry by entry
const mergeMetadataWithData = (provider, data, metadata) => {
  try {
    // check to see if there's any metadata, and if not, return the data
    if (!metadata || !metadata.length) {
      return data;
    }

    // get the item key field from the provider info
    const itemKeyField = provider.itemKey;

    // create an array with combined data/metadata for each entry
    const array = data.map(dataElement => {
      const id = dataElement[itemKeyField];

      // find the metadata element corresponding to the data element, using id
      const metadataArray = metadata.filter(m => m[dbconstants.metadataIdField] === id);
      const metadataElement = metadataArray.length > 0 ? metadataArray[0] : {};

      // combine metadata and data into a single object (metadata first)
      // for duplicate fields, give data precedence over metadata
      return { ...metadataElement, ...dataElement };
    });

    // return the array containing the merged data and metadata
    return array;
  } catch (error) {
    console.log(`mergeMetadataWithData: caught exception: ${error}`);
    return null;
  }
}

// retrieve existing metadata for an entity
const queryMetadata = async (userId, entity) => {
  try {
    // construct the path to the invokeInfo document 
    const path = `${userId}/${entity}/${dbconstants.invokeInfo}`;

    // query existing metadata from metadata collection under invokeInfo doc
    const metadata = await database.query(path, database.metadata);

    return metadata;
  } catch (error) {
    console.log(`queryMetadata: caught exception: ${error}`);
    return null;
  }
}

// retrieve the sentiment score associated with the data
const retrieveSentimentMetadata = async (userId, provider, entityName, data, metadata, newFlag) => {
  try {
    // determine whether there is a sentiment field, sentiment text field, or a rating field
    const textField = provider.textField;
    const sentimentTextField = provider.sentimentTextField;
    const sentimentField = provider.sentimentField;
    const ratingField = provider.ratingField;
    const itemKeyField = provider.itemKey;
    if (!sentimentTextField && !sentimentField && !ratingField) {
      return null;
    }

    // flag to indicate whether any new metadata was actually retrieved
    let retrievedSentiment = false;

    // start building up the metadata array
    const result = [];

    // iterate over every result in the dataset
    for (const element of data) {
      // use the key to retrieve the sentiment score, if one is stored
      const id = element[itemKeyField];
      const text = element[textField];

      // get current metadata element, or initialze with a default if it doesn't exist
      const metadataArray = metadata.filter(m => m[dbconstants.metadataIdField] === id);
      const metadataElement = metadataArray && metadataArray.length > 0 && metadataArray[0] || {};

      // initiailize current sentiment
      const currentSentiment = metadataElement[dbconstants.metadataSentimentField];

      // check to see whether the current sentiment has not yet been retrieved
      if (currentSentiment === undefined) {
        // initialize rating and score
        let rating = 'neutral';
        let score = 0;
  
        if (sentimentField) {
          // use the sentiment value returned by the provider
          rating = element[sentimentField];
          // synthesize a score based on the rating text
          score = rating === 'positive' ? 0.4 : rating === 'negative' ? -0.4 : 0;
        } else if (ratingField) {
          rating = element[ratingField] > 3 ? 'positive' : element[ratingField] < 3 ? 'negative' : 'neutral';
          // assume a rating in the range of 1:5, and normalize to { -0.5, -0.25, 0, 0.25, 0.5 }
          score = element[ratingField] / 4.0 - 0.75;
        } else {
          // call the sentiment analysis API
          const result = await sentiment.analyze(element[sentimentTextField]);
          if (result) {
            [score, rating] = result;
            console.log(`retrieved sentiment score ${score}, rating ${rating} for item ${id}`);
          }
        }

        // define the new metadata element
        const newMetadataElement = {};
        newMetadataElement[dbconstants.metadataIdField] = id;
        newMetadataElement[dbconstants.metadataEntityField] = entityName;
        newMetadataElement[dbconstants.metadataUserIdField] = userId;
        newMetadataElement[dbconstants.metadataProviderField] = provider.provider;
        newMetadataElement[dbconstants.metadataSentimentField] = rating;
        newMetadataElement[dbconstants.metadataSentimentScoreField] = score;
        newMetadataElement[dbconstants.metadataTextField] = text;

        // if new items are to be flagged as such, set the new flag
        if (newFlag) {
          newMetadataElement[dbconstants.metadataNewFlag] = true;
        }
        
        // create a combined metadata entry
        const metadataEntry = { 
          ...metadataElement, 
          ...newMetadataElement
        };
        result.push(metadataEntry);
        retrievedSentiment = true;
      } else { 
        // sentiment field has previously been retrieved
        // just use the current metadata element
        result.push(metadataElement);
      }
    }

    // only return the result if a new sentiment was retrieved
    if (retrievedSentiment) {
      return result;
    } else {
      return null;
    }
  } catch (error) {
    console.log(`retrieveSentimentData: caught exception: ${error}`);
    return null;
  }
}

// store the retrieved data along with invocation information in the database
const storeData = async (userId, provider, entity, params, data, invokeInfo) => {
  try {
    // add invocation information to invokeInfo document
    invokeInfo.provider = provider.provider;
    invokeInfo.name = provider.name;
    invokeInfo.params = params;
    invokeInfo.lastRetrieved = new Date().getTime();

    // store the invocation information as a well-known document (__invoke_info) in the collection
    await database.storeDocument(userId, entity, dbconstants.invokeInfo, invokeInfo);

    // shred the data returned into a batch of documents in the collection
    await database.storeBatch(userId, entity, data, provider.itemKey);
  } catch (error) {
    console.log(`storeData: caught exception: ${error}`);
    return null;
  }
}

// store metadata in the database
const storeMetadata = async (userId, entity, metadata) => {
  try {
    // construct the path to the invokeInfo document 
    const path = `${userId}/${entity}/${dbconstants.invokeInfo}`;

    // store the metadata as a batch of documents
    await database.storeBatch(path, database.metadata, metadata, dbconstants.metadataIdField, true);
  } catch (error) {
    console.log(`updateMetadata: caught exception: ${error}`);
    return null;
  }
}

// retrieve existing metadata, merge with new metadata, store the result
const updateMetadata = async (userId, entity, provider, metadata) => {
  try {
    // get existing metadata
    const existingMetadata = await queryMetadata(userId, entity);
    
    // create a combined, de-duped list of keys
    const existingKeys = existingMetadata && existingMetadata.map(m => m[dbconstants.metadataIdField]);
    const newKeys = metadata && metadata.map(m => m[dbconstants.metadataIdField]);
    const combinedKeys = [...new Set([...existingKeys, ...newKeys])];

    // construct a new array with the combined objects
    const result = combinedKeys.map(key => {
      const existingResult = existingMetadata.filter(m => m[dbconstants.metadataIdField] === key);
      const existingEntry = existingResult && existingResult.length > 0 ? existingResult[0] : {};
      const newResult = metadata.filter(m => m[dbconstants.metadataIdField] === key);
      const newEntry = newResult && newResult.length > 0 ? newResult[0] : {};

      // define the core metadata element
      const coreEntry = {};
      coreEntry[dbconstants.metadataIdField] = key;
      coreEntry[dbconstants.metadataEntityField] = entity;
      coreEntry[dbconstants.metadataUserIdField] = userId;
      coreEntry[dbconstants.metadataProviderField] = provider.provider;
      
      // merge existing and new entry, and always include core fields
      return { ...existingEntry, ...newEntry, ...coreEntry };
    });

    // store updated metadata
    await storeMetadata(userId, entity, result);

    return result;
  } catch (error) {
    console.log(`updateMetadata: caught exception: ${error}`);
    return null;
  }
}
