IMAGE_NAME = redhat-faas/js-runtime
TEST_IMAGE = $(IMAGE_NAME)-candidate

.PHONY: build test
build:
	docker build -t $(IMAGE_NAME) .

test:
	./run-test.sh $(TEST_IMAGE)