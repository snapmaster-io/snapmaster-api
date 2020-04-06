![SnapMaster](https://github.com/snapmaster-io/snapmaster/blob/master/public/SnapMaster-logo-220.png)
# SnapMaster-API
## Master your DevOps toolchain

This repository contains the API for the SnapMaster single-page application.  

SnapMaster-API utilizes the express web server, and relies on [Auth0](https://auth0.com) for authentication and authorization.

It is a Google Cloud Platform app, with dependencies on Google Cloud Build, Google Cloud Run, Google Cloud Pubsub, and Google Cloud Scheduler. 

## Available scripts

### `npm start` (or `npm run start:dev`)

Runs the backend with ENV=dev, which invokes the dev environment.  This will append "-dev" to the pubsub topic (`invoke-load-dev`), scheduler job, etc.

The pub-sub subscription will run in pull mode, and is invoked by the scheduler every hour on the hour.

The express webserver will default to listening on port 8080.  Override with PORT=xxxx variable.

### `npm run start:prod`

Runs the backend with ENV=prod, which invokes the production environment. This will append "-prod" to various resources such as the pubsub topic (`invoke-load-prod`), scheduler job, etc.  

The pub-sub subscription will run in push mode, calling the /invoke-load API, and is invoked by the scheduler 
every hour on the hour.

The express webserver will default to listening on port 8080.  Override with PORT=xxxx variable.

### `npm run start:devhosted`

Runs the backend with dev account credentials but with the `prod` configuration, which runs 
a production-like hosted environment in the dev account. 

### `npm run build-spa:dev` | `npm run build-spa:prod`, and `npm run copy`

These will build the production (minified) version of the [SnapMaster](https://github.com/snapmaster-io/snapmaster) front-end, 
and copy the files into the `build` subdirectory.  It assumes that the snapmaster project is cloned into a peer directory of 
the snapmaster-api project.

### `npm run build:dev | build:prod` and `npm run deploy:dev | deploy:prod`

These will build the Docker container for the API (including the SPA) using Google Cloud Build, and deploy it to Google Cloud Run.  

### `npm run push:dev | push:prod`

This combines the `build-spa`, `copy`, `build`, and `deploy` operations to automate the deployment of the current source code with one command into the respective environment.

## Directory structure

The app is bootstrapped out of `server.js`, which pulls in all other source dependencies out of the `src` directory.

### `config`

Contains all the config for the project.  These files aren't committed to source control since they contain secrets.
The API expects an `auth0_config_{dev|prod}.json` file for application keys and secret keys for Auth0; 
a `{google|twilio|sendgrid|etc}_config_{dev|prod}.json` for client ID's and secret keys for various service providers; and a 
`cloud_platform_config_{dev|prod}.json` file for the Google Cloud Platform service account used with this application.

In particular, the `cloud_platform_config_{dev|prod}.json` file is required for proper bring-up of the service.  It is the 
key file associated with a service account that has "project/owner" permissions on your GCP project.

Also, the `auth0_config_{dev|prod}.json` file is required for the client ID and client secret for your Auth0 tenant.

```
{
  "domain": "YOURDOMAIN.auth0.com",
  "client_id": "THE CLIENT ID FOR YOUR DOMAIN",
  "client_secret": "THE CLIENT SECRET FOR YOUR DOMAIN",
  "audience": "https://api.snapmaster.io"
}
```

### `scripts`

Contains scripts to build and deploy the app to GCP, as well as to set up the IAM rules for the app.

### `src/data`

Contains the data access layer, database abstraction layer, and data pipeline.

### `src/modules`

Contains various app modules such as the environment, data pipeline, profile, connections, entities, etc.

### `src/providers`

Contains the provider implementations for the supported social media accounts.  `providers.js` pulls these all together. 

### `src/services`

Contains wrappers around all of the services used: Auth0, GCP (pubsub, scheduler, etc), twilio, sendgrid, etc.

### `src/snap`

Contains the Snap Engine and the snap data access layer.

### `snaps`

Contains YAML definitions for common snaps.

### `utils`

Contains various utilities.

