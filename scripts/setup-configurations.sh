#!/bin/bash
# development
CONFIG_NAME=saasmaster-dev
PROJECT_ID=saasmaster
ACCOUNT=ogazitt@gmail.com
RUN_REGION=us-central1
# production
CONFIG_NAME=saasmaster-prod
PROJECT_ID=saasmaster-prod
ACCOUNT=saasmaster1@gmail.com
RUN_REGION=us-central1

gcloud config configurations create $CONFIG_NAME 
gcloud config set account $ACCOUNT
gcloud config set project $PROJECT_ID
gcloud config set run/region $RUN_REGION
