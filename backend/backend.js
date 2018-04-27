#!/usr/local/bin/node

const http = require("http")
const url = require("url")
const path = require("path")
const fs = require("fs")
const port = process.argv[2] || 8888;

const AWS = require("aws-sdk");

if (process.env.NODE_ENV == "test") {
    let config = {
        "endpoint": "http://dynamo:8000",
        "region": "eu-central-1",
    }
    AWS.config.update(config);
}

const dynamodb = new AWS.DynamoDB();
const docClient = new AWS.DynamoDB.DocumentClient();

if (process.env.NODE_ENV == "test") {
    const schema = {
        TableName : "Contact",
        KeySchema: [
            { AttributeName: "time", KeyType: "HASH"},  //Partition key
            { AttributeName: "subject", KeyType: "RANGE" }  //Sort key
        ],
        AttributeDefinitions: [
            { AttributeName: "time", AttributeType: "N" },
            { AttributeName: "subject", AttributeType: "S" }
        ],
        ProvisionedThroughput: {
            ReadCapacityUnits: 5,
            WriteCapacityUnits: 5
        }
    };

    dynamodb.createTable(schema, function(err, data) {
        if (err) {
            console.error("Unable to create table. Error JSON:", JSON.stringify(err, null, 2));
        } else {
            console.log("Created table. Table description JSON:", JSON.stringify(data, null, 2));
        }
    });
}

const convertPostToJson = function(postData) {
    let json = {};
    let pairs = postData.split('&');
    for (let index in pairs) {
        let items = pairs[index].split('=')
        json[items[0]] = items[1]
    }
    return json;
};

const doContact = function(params) {
    let attributes = [ 'firstname', 'lastname', 'subject', 'message' ];
    for (let index in attributes) {
        let attribute = attributes[index];
        if (params[attribute] == undefined) {
            console.error("Incomplete contact message: " + JSON.stringify(params));
            return;
        }
    }
    let putData = { "TableName": "Contact", "Item" : params }
    putData["Item"]["time"] = new Date().getTime();
    docClient.put(putData, function(err, data) {
       if (err) {
           console.error("Unable to add contact: ", JSON.stringify(putData), ". Error JSON:", JSON.stringify(err, null, 2));
       } else {
           console.log("PutItem succeeded:", JSON.stringify(putData));
       }
    });
};

http.createServer(function(request, response) {

  console.log("Request received at url: " + request.url)
  if (request.method == 'POST') {
      let requestBody = '';

      request.on('data', function (data) {
          requestBody += data;
      });

      request.on('end', function () {
          let attributes = convertPostToJson(requestBody);
          if (request.url === "/contact") {
              console.log("Attempting contact with " + JSON.stringify(attributes));
              doContact(attributes);
          }
      });
  }

  response.writeHead(200, {"Content-Length": 0});
  response.end();

}).listen(parseInt(port, 10));

console.log("Server running at\n  => http://localhost:" + port + "/\nCTRL + C to shutdown");
