#!/bin/bash
# development
CONFIG_NAME=snapmaster-dev
PROJECT_ID=snapmaster-dev
ACCOUNT=snapmasterios@gmail.com
RUN_REGION=us-central1
# production
CONFIG_NAME=snapmaster-prod
PROJECT_ID=snapmaster
ACCOUNT=snapmasterios@gmail.com
RUN_REGION=us-central1

gcloud config configurations create $CONFIG_NAME 
gcloud config set account $ACCOUNT
gcloud config set project $PROJECT_ID
gcloud config set run/region $RUN_REGION
