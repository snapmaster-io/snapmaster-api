#!/bin/bash
# development
PROJECT_ID=snapmaster-dev
PROJECT_NUMBER=505686329254
SERVICE_NAME=snapmaster-dev
# production
PROJECT_ID=snapmaster
PROJECT_NUMBER=629824558218
SERVICE_NAME=snapmaster

gcloud projects add-iam-policy-binding $PROJECT_ID \
  --member=serviceAccount:service-$PROJECT_NUMBER@gcp-sa-pubsub.iam.gserviceaccount.com \
  --role=roles/iam.serviceAccountTokenCreator

gcloud iam service-accounts create cloud-run-pubsub-invoker \
  --display-name "Cloud Run Pub/Sub Invoker"

gcloud run services add-iam-policy-binding $SERVICE_NAME \
  --platform managed \
  --member=serviceAccount:cloud-run-pubsub-invoker@$PROJECT_ID.iam.gserviceaccount.com \
  --role=roles/run.invoker
