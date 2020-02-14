// data pipeline layer
// 
// exports:
//   createDataPipeline: create pubsub machinery for data pipeine
//   messageHandler: event handler for dispatching messages coming in through the pubsub system
//   refreshHistory: invoke snapshot pipeline for a specific user

const database = require('../data/database');
const dbconstants = require('../data/database-constants');
const providers = require('../providers/providers');
const dataProviders = providers.providers;
const dal = require('../data/dal');
const pubsub = require('../services/pubsub');
const scheduler = require('../services/scheduler');
const email = require('../services/email');
const sms = require('../services/sms');
const environment = require('./environment');
const profile = require('./profile');

// base name for pubsub machinery
const invoke = 'invoke';

// message handlers are added after they are initialized
const handlers = {};
const actions = {
  load:    'load',
  snapshot:'snapshot'
};

exports.createDataPipeline = async (env) => {
  try {
    // set up the topic name, subscription name based on env
    const topicName = `${invoke}-${env}`;
    const subName = `${invoke}-${env}-sub`;
    const endpoint = `${environment.getEndpoint()}/${invoke}`;
    const serviceAccount = environment.getServiceAccount();

    // get the data pipeline system info object
    const dataPipelineObject = await database.getUserData(dbconstants.systemInfo, dbconstants.dataPipelineSection) || {};

    // handle prod environent
    if (env === 'prod') {
      if (dataPipelineObject.topicName !== topicName ||
          dataPipelineObject.subName !== subName) {

        // create or get a reference to the topic
        topic = await pubsub.createTopic(topicName);
        if (!topic) {
          console.log(`createDataPipeline: could not create or find topic ${topicName}`);
          return null;
        }

        dataPipelineObject.topicName = topicName;
    
        // set up a push subscription for the production environment
        await pubsub.createPushSubscription(topic, subName, endpoint, serviceAccount);
        dataPipelineObject.subName = subName;
      }
    }

    // handle dev environent
    if (env === 'dev') {
      // create or get a reference to the topic
      const topic = await pubsub.createTopic(topicName);
      if (!topic) {
        console.log(`createDataPipeline: could not create or find topic ${topicName}`);
        return null;
      }

      dataPipelineObject.topicName = topicName;

      // set up a pull subscription for the dev environment
      await pubsub.createPullSubscription(topic, subName, exports.messageHandler);
      dataPipelineObject.subName = subName;
    }

    // create the scheduler entries for both load and snapshot topics
    await createScheduler(env, dataPipelineObject, actions.load, '0 */1 * * *');  // every hour
    await createScheduler(env, dataPipelineObject, actions.snapshot, '0 1 * * *');  // every day at 1am

    // store the data pipeline system info object
    await database.setUserData(dbconstants.systemInfo, dbconstants.dataPipelineSection, dataPipelineObject);
  } catch (error) {
    console.log(`createDataPipeline: caught exception: ${error}`);
    return null;
  }
}

const createScheduler = async (env, dataPipelineObject, action, schedule) => {
  try {
    // set up the job name based on env
    const topicName = `${invoke}-${env}`;
    const jobName = `${topicName}-${action}-job`;

    // create the scheduler job if it doesn't exist yet
    const jobs = dataPipelineObject.jobs || [];
    if (!jobs.includes(jobName)) {
      // create scheduler job
      await scheduler.createPubSubJob(jobName, topicName, action, schedule);
      jobs.push(jobName);
      dataPipelineObject.jobs = jobs;
    }

  } catch (error) {
    console.log(`createScheduler: caught exception: ${error}`);
  }
}

// generic message handler that dispatches messages based on the action in their message data
//
// format of message.data:
// {
//   action: 'action name'    // e.g. 'load', 'snapshot'
//   ...                      // message specific fields
// }
exports.messageHandler = async (dataBuffer) => {
  try {
    // convert the message data to a JSON string, and parse into a map
    const data = JSON.parse(dataBuffer.toString());

    // retrieve the action and the handler associated with it
    const action = data.action;
    const handler = action && handlers[action];

    // validate the message action
    if (!action || !handler) {
      console.log(`messageHandler: unknown action ${action}`);
    } else {
      // invoke handler
      await handler(data);
    }
  } catch (error) {
    console.log(`messageHandler: caught exception: ${error}`);
  }
}

// refresh history for a user by invoking the snapshot pipeline for that user
exports.refreshHistory = async (userId) => {
  await snapshotPipeline({ userId: userId });
}

// wrapper handler for invoking specific actions (passed in as 'handler')
const baseHandler = async (sectionName, interval, handler, data) => {
  try {
    // compute the current timestamp and an hour ago
    const now = new Date().getTime();

    // retrieve last data pipeline run timestamp, and whether we are already in progress
    const sectionObject = await database.getUserData(dbconstants.systemInfo, sectionName) || {};
    const timestamp = sectionObject[dbconstants.lastUpdatedTimestamp] || 
          now - interval;  // if the timestamp doesn't exist, set it to 1 hour ago
    const inProgress = sectionObject[dbconstants.inProgress] || false;
    
    // if the timestamp is older than 59 minutes, invoke the data load pipeline
    if (isStale(timestamp, interval) && !inProgress) {
      console.log(`invoking ${sectionName} pipeline`);

      // set a flag indicating data pipeline is "inProgress"
      sectionObject[dbconstants.inProgress] = true;
      await database.setUserData(dbconstants.systemInfo, sectionName, sectionObject);

      // invoke data pipeline
      await handler(data);
    }
  } catch (error) {
    console.log(`baseHandler: caught exception: ${error}`);
  }
}

// pubsub handler for invoking the load pipeline
const loadHandler = async (data) => {
  const hr1 = 60 * 60000;
  await baseHandler(dbconstants.loadSection, hr1, loadPipeline, data);
}
handlers[actions.load] = loadHandler;

// pubsub handler for invoking the snapshot pipeline
const snapshotHandler = async (data) => {
  const day1 = 24 * 60 * 60000;
  await baseHandler(dbconstants.snapshotSection, day1, snapshotPipeline, data);
}
handlers[actions.snapshot] = snapshotHandler;

// invokes the load pipeline, which will crawl through every single entity 
// and re-load the cache with its new value
const loadPipeline = async () => {
  try {
    // get all the users in the database
    const users = await database.getAllUsers();

    // loop over the users in parallel
    await Promise.all(users.map(async userId => {
      try {
        // retrieve all the collections associated with the user
        let collections = await database.getUserCollections(userId);
        if (collections) {
          // filter out 'history' collection
          collections = collections.filter(c => c !== dbconstants.history);
        }
        console.log(`user: ${userId} collections: ${collections}`);

        // if no results, nothing to do
        if (!collections || !collections.length) {
          return;
        }

        // retrieve each of the collections in parallel
        await Promise.all(collections.map(async collection => {
          // retrieve the __invoke_info document for the collection
          const invokeInfo = await database.getDocument(userId, collection, dbconstants.invokeInfo);

          // validate invocation info
          if (invokeInfo && invokeInfo.provider && invokeInfo.name) {
            const providerName = invokeInfo.provider,
            funcName = invokeInfo.name,
            providerObject = dataProviders[providerName],
            provider = providerObject && providerObject[funcName],
            params = invokeInfo.params;

            // utilize the data access layer's getData mechanism to re-retrieve object
            // force the refresh using the forceRefresh = true flag
            // flag new items using the newFlag = true flag
            await dal.getData(userId, provider, collection, params, true, true);
          }
        }));

        // get the user's profile
        const userProfile = await profile.getProfile(userId);

        // retrieve any new metadata entries that were just created
        const newMetadata = await dal.getMetadata(userId, true);

        // process any new metadata records
        if (newMetadata && newMetadata.length > 0) {
          // if the user requested email notifications, send them the requested feedback (negative or all)
          if (userProfile[profile.notifyEmail] && userProfile[profile.notifyEmail] !== profile.noFeedback) {
            let reviews = newMetadata;
            if (userProfile[profile.notifyEmail] === profile.negativeFeedback) {
              reviews = newMetadata.filter(r => r[dbconstants.metadataSentimentField] === 'negative');
            } 
            await email.emailReviews(userProfile.email, reviews);
          }

          // if the user requested SMS notifications, send them the requested feedback (negative or all)
          if (userProfile[profile.notifySms] && userProfile[profile.notifySms] !== profile.noFeedback) {
            let reviews = newMetadata;
            if (userProfile[profile.notifySms] === profile.negativeFeedback) {
              reviews = newMetadata.filter(r => r[dbconstants.metadataSentimentField] === 'negative');
            } 
            await sms.textReviews(userProfile.phone, reviews);
          }

          // remove the "new" flag from the metadata that was just handled
          await Promise.all(newMetadata.map(async entry => {
            const documentName = entry[dbconstants.metadataIdField];

            // construct the metadata collection name from the entity name
            const metadataCollection = `${entry[dbconstants.metadataEntityField]}/${dbconstants.invokeInfo}/${database.metadata}`;

            // retrieve the metadata document
            const metadataDocument = await database.getDocument(userId, metadataCollection, documentName);

            // flip the "new" flag to false
            delete metadataDocument[dbconstants.metadataNewFlag];

            // save the document
            await database.storeDocument(userId, metadataCollection, documentName, metadataDocument);
          }));
        }
      } catch (error) {
        console.log(`loadPipeline: user ${userId} caught exception: ${error}`);        
      }
    }));

    // update the system information file load section 
    updateSystemInfoSection(dbconstants.loadSection);

    const currentTime = new Date();
    console.log(`loadPipeline: completed at ${currentTime.toLocaleTimeString()}`);

  } catch (error) {
    console.log(`loadPipeline: caught exception: ${error}`);
  }
}

// invokes the snapshot pipeline, which will take a snapshot of each user's 
// metadata and store it as the daily snapshot 
const snapshotPipeline = async (data) => {
  try {

    // if userId was passed, use it, otherwise get all the users in the database
    const users = data && data.userId ? [data.userId] : await database.getAllUsers();

    // loop over the users in parallel
    await Promise.all(users.map(async userId => {
      try {
        // retrieve all the metadata associated with the user
        const metadata = await dal.getMetadata(userId);
        const providers = metadata && metadata.map(m => m[dbconstants.metadataProviderField]);
        const providerSet = [...new Set(providers)];
        
        // if no results, nothing to do
        if (!providerSet || !providerSet.length || !metadata || !metadata.length) {
          return;
        }

        // set up ratings over which to calculate counts
        const ratings = ['positive', 'neutral', 'negative'];

        // start building history object
        const history = {};

        // for each of the unique providers, calculate aggregates
        for (const provider of providerSet) {
          // create an array that contains the rating counts for each rating (positive, neutral, negative)
          // it will look something like [ 5, 3, 2 ]
          const ratingCounts = ratings.map(rating => 
            metadata.filter(m => m.__provider === provider && m.__sentiment === rating).length);

          const historySection = {};
          for (const index in ratings) {
            const key = ratings[index];
            const value = ratingCounts[index];
            historySection[key] = value;
          }

          // calculate the aggregate score from all the sentiment scores for this provider
          const providerScore = metadata.reduce((acc, curr) => acc + 
            (curr.__provider === provider ? curr.__sentimentScore : 0), 0);
          const averageScore = providerScore / metadata.filter(m => m.__provider === provider).length;
          historySection.averageScore = averageScore;

          history[provider] = historySection;
        }
        
        // compute and store the timestamp
        const timestamp = new Date().getTime();

        // compute and store the aggregate ratings across providers
        history.timestamp = timestamp;
        const ratingCounts = ratings.map(rating => 
          metadata.filter(m => m.__sentiment === rating).length);
        for (const index in ratings) {
          const key = ratings[index];
          const value = ratingCounts[index];
          history[key] = value;
        }

        // compute and store the average score across all providers
        const totalScore = metadata.reduce((acc, curr) => acc + curr.__sentimentScore, 0);
        const averageScore = totalScore / metadata.length;
        history.averageScore = averageScore;

        console.log(`user: ${userId} snapsnot: ${JSON.stringify(history)}`);

        // store the snapshot document with the timestamp as the document name
        await database.storeDocument(userId, dbconstants.history, timestamp.toString(), history);

      } catch (error) {
        console.log(`snapshotPipeline: user ${userId} caught exception: ${error}`);        
      }
    }));

    // update the system information file snapshot section 
    updateSystemInfoSection(dbconstants.snapshotSection);

    const currentTime = new Date();
    console.log(`snapshotPipeline: completed at ${currentTime.toLocaleTimeString()}`);

  } catch (error) {
    console.log(`snapshotPipeline: caught exception: ${error}`);
  }
}

const updateSystemInfoSection = async (sectionName) => {
  try {
    // update last updated timestamp with current timestamp
    const sectionObject = {};
    const currentTime = new Date();
    sectionObject[dbconstants.lastUpdatedTimestamp] = currentTime.getTime();
    sectionObject[dbconstants.inProgress] = false;
    await database.setUserData(dbconstants.systemInfo, sectionName, sectionObject);
  } catch (error) {
    console.log(`updateSystemInfoSection: caught exception: ${error}`);
  }
}

// return true if the timestamp is older than the interval passed in
const isStale = (timestamp, interval) => {
  // compute the current timestamp 
  const now = new Date().getTime();

  // buffer (reduce) the interval passed in by a minute 
  const bufferedInterval = interval - 60000;  
  return (now - timestamp > bufferedInterval);
}
