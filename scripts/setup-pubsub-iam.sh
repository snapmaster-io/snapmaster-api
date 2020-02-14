#!/bin/bash
# development
PROJECT_ID=saasmaster
PROJECT_NUMBER=1006951261261
SERVICE_NAME=saasmaster-api
# production
PROJECT_ID=saasmaster-prod
PROJECT_NUMBER=634939719144
SERVICE_NAME=saasmaster

gcloud projects add-iam-policy-binding $PROJECT_ID \
  --member=serviceAccount:service-$PROJECT_NUMBER@gcp-sa-pubsub.iam.gserviceaccount.com \
  --role=roles/iam.serviceAccountTokenCreator

gcloud iam service-accounts create cloud-run-pubsub-invoker \
  --display-name "Cloud Run Pub/Sub Invoker"

gcloud run services add-iam-policy-binding $SERVICE_NAME \
  --platform managed \
  --member=serviceAccount:cloud-run-pubsub-invoker@$PROJECT_ID.iam.gserviceaccount.com \
  --role=roles/run.invoker
