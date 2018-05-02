from node:alpine

RUN apk update
RUN npm install -g handlebars
COPY backend.js /bin/main.js

RUN adduser -S backend
WORKDIR /home/backend
USER backend
RUN npm init -y
RUN npm install aws-sdk handlebars
COPY backend.js main.js
COPY results.handlebars results.handlebars
RUN handlebars results.handlebars -f results.js

CMD node main.js

