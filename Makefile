
all:
	make -C backend

start:
	docker-compose up -d

stop:
	docker-compose down || true

starttest:
	docker-compose -f docker-compose.local.yaml up -d

stoptest:
	docker-compose -f docker-compose.local.yaml down || true
