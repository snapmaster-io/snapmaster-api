#!/bin/bash
gcloud run deploy $SVC \
  --image gcr.io/$PROJ/$SVC \
  --platform managed --allow-unauthenticated