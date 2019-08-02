#!/bin/sh

set -x

cd /home/node/usr

if [ -f package.json ] ; then
  npm install --no-cache
fi

cd ../src

node .