IMAGE_NAME = lanceball/js-runtime
DOCKER_IMAGE = docker.io/$(IMAGE_NAME)
TEST_IMAGE = $(IMAGE_NAME)-candidate

.PHONY: build test
build:
	docker build -t $(DOCKER_IMAGE) .

test:
	./run-test.sh $(TEST_IMAGE)

clean:
	docker rmi `docker images $(TEST_IMAGE) -q`
	docker rmi `docker images $(IMAGE_NAME) -q`