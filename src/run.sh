#!/bin/sh
set -x

umask 000

cd /home/node/usr

if [ -f package.json ] ; then
  export NO_UPDATE_NOTIFIER=true
  npm install --only=prod
fi

cd ../src

node .