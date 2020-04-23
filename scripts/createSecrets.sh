#!/bin/bash

# default environment to "DEV" (if not passed into script as env variable)
ENV=${ENV:-DEV} 

# get environment name in lowercase
environment=$(echo ${ENV} | tr '[:upper:]' '[:lower:]')

for file in config/*_${environment}.json; do ENV=${ENV} node utils/createSecret.js $file ; done