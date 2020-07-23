// post events to a topic
// 
// exports:
//   post(): post an event to a pubsub topic

const pubsub = require('../services/pubsub');
const environment = require('./environment');

exports.post = async (message) => {
  try {
    const topicName = environment.getEventTopic();
    if (!topicName) {
      console.error(`post: cannot obtain topic name`);
      return null;
    }

    const response = await pubsub.publish(topicName, message);
    return response;
  } catch (error) {
    console.error(`post: caught exception: ${error}`);
  }
}