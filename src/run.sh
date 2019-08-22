#!/bin/sh
set -x

umask 000
cd /home/node/usr

if [ -f package.json ] ; then
  npm install
fi

cd ../src

node .