#!/bin/bash

# set up work directory
mkdir /tmp/$ACTIVESNAPID
cd /tmp/$ACTIVESNAPID
echo $SERVICECREDS >creds.json

# set up gcloud authentication
gcloud auth activate-service-account snapmaster@$PROJECT.iam.gserviceaccount.com --key-file=creds.json --project=$PROJECT

# add the git host to known hosts
ssh-keyscan -H github.com >> ~/.ssh/known_hosts

# clone the repo
git clone $REPO
cd $REPO

# build the image from the current directory using the credentials set up above
gcloud --account snapmaster@$PROJECT.iam.gserviceaccount.com --project $PROJECT builds submit --tag gcr.io/$PROJECT/$SERVICE

# revoke the credentials
gcloud auth revoke snapmaster@$PROJECT.iam.gserviceaccount.com

# remove the work directory
cd /
rmdir /tmp/$ACTIVESNAPID
