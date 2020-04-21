// secret management using google cloud API
// 
// exports:
//   get(name): returns the secret associated with "name"
//   set(name, value): stores the secret value under "name"

const secrets = require('@google-cloud/secret-manager');
const environment = require('../modules/environment');
const cloudConfigFile = environment.getCloudPlatformConfigFile();
const projectId = environment.getProjectId();

// Import the Secret Manager client and instantiate it:
//const client = new SecretManagerServiceClient();
const client = new secrets.SecretManagerServiceClient({
  projectId: projectId,
  keyFilename: cloudConfigFile,
});

exports.get = async (key) => {
  try {
    const encodedKey = key.replace(/[\:\|]/g, '-');
    const [version] = await client.accessSecretVersion({
      //name: `projects/${projectId}/secrets/${encodedKey}`,
      name: `${encodedKey}/versions/latest`
    });

    const payload = version.payload.data.toString('utf8');
    return payload;
  } catch (error) {
    console.error(`set: caught exception: ${error}`);
    return null;
  }
}

exports.remove = async (key) => {
  try {
    const encodedKey = key.replace(/[\:\|]/g, '-');
    // create the secret with automation replication
    await client.deleteSecret({
      name: encodedKey,
    });
  } catch (error) {
    console.error(`remove: caught exception: ${error}`);
    return null;
  }
}

exports.set = async (key, value) => {
  try {
    const encodedKey = key.replace(/[\:\|]/g, '-');
    const secretName = `projects/${projectId}/secrets/${encodedKey}`;
    try {
      // create the secret with automation replication
      const [secret] = await client.createSecret({
        parent: `projects/${projectId}`,
        secret: {
          name: encodedKey,
          replication: {
            automatic: {},
          },
        },
        secretId: encodedKey,
      });

      if (!secret) {
        console.error(`set: could not create secret`);
        return null;
      }
    } catch (error) {
      // Error: 6 ALREADY_EXISTS is an expected path for secrets that are already created
      if (error.code !== 6) {
        console.error(`set: caught exception: ${error}`);
        return null;
      }
    }

    // update the secret by adding a new version
    const [version] = await client.addSecretVersion({
      parent: `projects/${projectId}/secrets/${encodedKey}`,
      payload: {
        data: Buffer.from(value, 'utf8'),
      },
    });

    return secretName;
  } catch (error) {
    console.error(`set: caught exception: ${error}`);
    return null;
  }
}

