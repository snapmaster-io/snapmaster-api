// provider base 
//
// exported methods:
//   getDefinition: load and parse the yml definition of a provider
//   
// exported constants:
//   simpleProvider: simple provider
//   linkProvider: link provider (OAuth via Auth0)

const fs = require('fs');
const YAML = require('yaml');

exports.simpleProvider = 'simple';
exports.linkProvider = 'link';

exports.getDefinition = (providerName) => {
  try {
    const definition = fs.readFileSync(`./src/providers/${providerName}/${providerName}.yml`, 'utf8');
    const provider = YAML.parse(definition);
    // TODO: validation
    return provider;
  } catch (error) {
    console.log(`getDefinition: caught exception: ${error}`);
    return null;
  }
}
