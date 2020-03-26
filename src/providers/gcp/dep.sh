#!/bin/bash

# set up work directory
mkdir /tmp/$ACTIVESNAPID
cd /tmp/$ACTIVESNAPID
echo $SERVICECREDS >creds.json
