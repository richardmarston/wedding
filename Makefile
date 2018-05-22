
all:
	make -C backend

start:
	docker-compose -f docker-compose.prod.yaml up -d

stop:
	docker-compose -f docker-compose.prod.yaml down || true

starttest:
	docker-compose -f docker-compose.local.yaml up -d

stoptest:
	docker-compose -f docker-compose.local.yaml down || true
