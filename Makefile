
all:
	make -C backend
	make -C frontend

start:
	docker-compose up -d

stop:
	docker-compose down || true
