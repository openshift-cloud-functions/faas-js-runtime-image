#!/bin/bash

# Uncomment this for verbose output
# set -x

TEST_IMAGE=$1

remove_container_id_file () {
  rm -f faas-test.cid
}

remove_node_modules () {
  rm -rf test/node_modules
  rm -f test/package-lock.json
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
  docker stop $(cat faas-test.cid)

  echo "Removing generated test files..."
  remove_container_id_file
  remove_node_modules
}

fail () {
  cleanup
  exit 1
}

# Make sure no stray container ID files are hanging out
remove_container_id_file
echo "Testing ${TEST_IMAGE}"

echo "Building image..."
docker build -t ${TEST_IMAGE} .

echo "Starting container for ${TEST_IMAGE}..."
echo "docker run --rm --cidfile faas-test.cid -a stdout -a stderr -v $(pwd)/test:/home/node/usr -p 8080:8080 ${TEST_IMAGE} &"
docker run --rm --cidfile faas-test.cid -a stdout -a stderr -v $(pwd)/test:/home/node/usr -p 8080:8080 ${TEST_IMAGE} &

echo "Giving it a few seconds to initialize..."
sleep 3

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
