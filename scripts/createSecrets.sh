#!/bin/bash

# default environment to "dev" (if not passed into script as env variable)
ENV=${ENV:-dev} 

# get environment name in lowercase
environment=$(echo ${ENV} | tr '[:upper:]' '[:lower:]')
credfile=./config/cloud_platform_config_${ENV}.json
for file in config/*_${environment}.json; do GOOGLE_APPLICATION_CREDENTIALS=${credfile} ENV=${environment} node utils/createSecret.js $file ; done