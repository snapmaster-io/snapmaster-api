// scheduler (cron) system based on google cloud scheduler
// exports:
//   createPubSubJob: creates a pub-sub cron job 

const scheduler = require('@google-cloud/scheduler');
const environment = require('../modules/environment');
const cloudConfigFile = environment.getCloudPlatformConfigFile();
const projectId = environment.getProjectId();

const client = new scheduler.CloudSchedulerClient({
  projectId: projectId,
  keyFilename: cloudConfigFile,
});

// create a pubsub job with the fully-qualified topicname and a default schedule
// default cron schedule: every hour on the hour
exports.createPubSubJob = async (jobName, topicName, action, schedule = '0 */1 * * *') => {
  const parent = client.locationPath(projectId, environment.getLocation());
  const name = `${parent}/jobs/${jobName}`;
  const topic = `projects/${projectId}/topics/${topicName}`;

  try {
    const jobObject = {
      name: name,
      pubsubTarget: {
        topicName: topic,
        data: Buffer.from(`{ "action": "${action}" }`)
      },
      schedule: schedule,
      timeZone: 'America/Los_Angeles',
    };

    const request = {
      parent: parent,
      job: jobObject,
    };

    // Use the client to send the job creation request.
    const [job] = await client.createJob(request);
    console.log(`created job: ${job.name}`);
    return job;

  } catch (error) {
    // check for an error indicating that a topic already exists
    if (error.code === 6) {
      // return the job
      const [job] = await client.getJob({ name: name });
      console.log(`reusing job: ${job.name}`);
      return job;
    }
    
    console.log(`createPubSubJob: caught exception: ${error}`);
  }
}