#!/bin/bash

# Uncomment this for verbose output
# set -x

TEST_IMAGE=$1
CID_FILE=`date +%s`$$.cid

remove_container_id_file () {
  rm -f $CID_FILE
}

remove_node_modules () {
  rm -rf test/node_modules
  rm -f test/package-lock.json
  rm -rf test/.npm
  rm -rf test/false # TODO: What is this dir doing here?
}

test_probe () {
  probe_path=$1
  echo "Testing probe path ${probe_path}"
  EXPECTED='OK'
  RESPONSE=$(curl "http://localhost:8080${probe_path}")
  if [ "${RESPONSE}" == "${EXPECTED}" ] ; then
    echo "Got expected response from probe ${probe_path} '${RESPONSE}'"
  else
    echo "Unexepected response received from probe ${probe_path} '${RESPONSE}'"
    exit 1
  fi
}

cleanup () {
  echo "Stopping ${TEST_IMAGE}..."
  docker stop $(cat ${CID_FILE})

  echo "Removing generated test files..."
  remove_container_id_file
  remove_node_modules
}

wait_for_cid() {
  wait_for_file $CID_FILE
}

wait_for_file() {
  local max_attempts=10
  local sleep_time=1
  local attempt=1
  local result=1
  while [ $attempt -le $max_attempts ]; do
    [ -f $1 ] && [ -s $1 ] && break
    echo "Waiting for $1..."
    attempt=$(( $attempt + 1 ))
    sleep $sleep_time
  done
}

fail () {
  cleanup
  exit 1
}

echo "Testing ${TEST_IMAGE}"
echo "Building image..."
docker build -t ${TEST_IMAGE} .

echo "Starting container for ${TEST_IMAGE}..."
echo "docker run --rm --cidfile ${CID_FILE} -a stdout -a stderr -v $(pwd)/test:/home/node/usr -p 8080:8080 ${TEST_IMAGE} &"
docker run --rm --cidfile ${CID_FILE} -a stdout -a stderr -v $(pwd)/test:/home/node/usr -p 8080:8080 ${TEST_IMAGE} &

echo "Giving it a few seconds to initialize..."
wait_for_cid
wait_for_file "package-lock.json"

echo "Contacting runtime function..."
EXPECTED='This is the test function for Node.js FaaS. Success.'
RESPONSE=$(curl http://localhost:8080)

if [ "${RESPONSE}" == "${EXPECTED}" ] ; then
  echo "Got expected response '${RESPONSE}'"
else
  echo "Unexepected response received from function '${RESPONSE}'"
  fail
fi

test_probe "/health"

echo "Test success. Cleaning up..."
cleanup

echo "Done."
