// post events to a topic
// 
// exports:
//   post(): post an event to a pubsub topic

const pubsub = require('../services/pubsub');

// topic name
const topicName = 'snapmaster-events';

exports.post = async (message) => {
  try {
    const response = pubsub.publish(topicName, message);
    return response;
  } catch (error) {
    console.error(`post: caught exception: ${error}`);
  }
}