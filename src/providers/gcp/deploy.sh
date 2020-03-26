#!/bin/bash

# set up work directory
mkdir /tmp/$ACTIVESNAPID
cd /tmp/$ACTIVESNAPID
echo $SERVICECREDS >creds.json

# set up gcloud authentication
gcloud auth activate-service-account snapmaster@$PROJECT.iam.gserviceaccount.com --key-file=creds.json --project=$PROJECT

# build the image from the current directory using the credentials set up above
gcloud --account snapmaster@$PROJECT.iam.gserviceaccount.com --project $PROJECT run deploy $SERVICE --image gcr.io/$PROJECT/$IMAGE --platform managed --allow-unauthenticated --region $REGION

# revoke the credentials
gcloud auth revoke snapmaster@$PROJECT.iam.gserviceaccount.com

# remove the work directory
cd /
rm -fr /tmp/$ACTIVESNAPID
