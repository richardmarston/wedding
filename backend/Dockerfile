from node:alpine

RUN apk update
RUN npm install aws-sdk
COPY backend.js /bin/main.js

RUN adduser -S backend
WORKDIR /home/backend
USER backend

CMD /bin/main.js

