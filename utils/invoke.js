// publish a message on the 'invoke-load' topic, to cause the app 
// to initiate an invocation of the data load pipeline

const { PubSub } = require('@google-cloud/pubsub');

// get the environment as an env variable
const env = process.env.ENV || 'prod';
console.log('environment:', env);

// set the environment in the environment service
const environment = require('../src/modules/environment');
environment.setEnv(env);

const cloudConfigFile = environment.getCloudPlatformConfigFile();
const projectId = environment.getProjectId();

const pubsub = new PubSub({
  projectId: projectId,
  keyFilename: cloudConfigFile,
});

// get action as an env variable
const action = process.env.ACTION || 'load';
console.log('action:', action)

const topicName = `invoke-${env}`;

// create an 'load' message
const message = JSON.stringify({ 
  action: action
});

const messageBuffer = Buffer.from(message);

const publish = async () => {
  const messageId = await pubsub.topic(topicName).publish(messageBuffer);
  console.log(`Message ${messageId} published.`);
}

publish();