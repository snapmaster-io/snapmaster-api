// sentiment analysis using google cloud API
// 
// exports:
//   analyze(text): returns the sentiment of a block of text 
//   result is an array in the following format: [score, rating]
//     score is in a range of [-0.5, 0.5] 
//     rating is one of [positive,neutral,negative]

const language = require('@google-cloud/language');
const environment = require('../modules/environment');
const cloudConfigFile = environment.getCloudPlatformConfigFile();
const projectId = environment.getProjectId();

const client = new language.LanguageServiceClient({
  projectId: projectId,
  keyFilename: cloudConfigFile,
});

exports.analyze = async (text) => {
  const document = {
    content: text,
//  gcsContentUri: `gs://${bucketName}/${fileName}`,
    type: 'PLAIN_TEXT',
  };

  try {
    // call the analyze sentiment API
    const [result] = await client.analyzeSentiment({document});

    // get score on a scale of [-0.5,0.5]
    const score = result.documentSentiment.score;
    
    // normalize and return the rating as one of [positive, neutral, negative]
    const rating = score >= 0.1 ? 'positive' : score <= -0.1 ? 'negative' : 'neutral';
    return [score, rating];
  } catch (error) {
    console.log(`analyze: caught exception: ${error}`);
    return null;
  }
}
