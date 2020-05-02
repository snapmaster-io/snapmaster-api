#!/bin/bash

# default environment to "dev" (if not passed into script as env variable)
ENV=${ENV:-dev} 
GOOGLE_APPLICATION_CREDENTIALS=${GOOGLE_APPLICATION_CREDENTIALS:-config/cloud_platform_config_${ENV}}

# get environment name in lowercase
environment=$(echo ${ENV} | tr '[:upper:]' '[:lower:]')

for file in config/*_${environment}.json; do ENV=${environment} node utils/createSecret.js $file ; done