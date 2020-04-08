#!/bin/bash
for file in snaps/*; do node utils/createSnap.js $file ; done