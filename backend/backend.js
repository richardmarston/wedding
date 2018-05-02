const http = require("http")
const url = require("url")
const path = require("path")
const fs = require("fs")
const port = process.argv[2] || 8888;
global.Handlebars = require("handlebars");
const results = require("./results.js")
const resultsTemplate = global.Handlebars.templates["results"]
const AWS = require("aws-sdk");

if (process.env.NODE_ENV == "test") {
    let config = {
        "endpoint": "http://dynamo:8000",
        "region": "eu-central-1",
    }
    AWS.config.update(config);
}
else {
    let config = {
        "region": "eu-central-1",
    }
    AWS.config.update(config);
}

const dynamodb = new AWS.DynamoDB();
const docClient = new AWS.DynamoDB.DocumentClient();

const createTable = function(schema) {
    dynamodb.createTable(schema, function(err, data) {
        if (err) {
            console.error("Unable to create table. Error JSON:", JSON.stringify(err, null, 2));
        } else {
            console.log("Created table. Table description JSON:", JSON.stringify(data, null, 2));
        }
    });
}

if (process.env.NODE_ENV == "test") {
    let schema = {
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
    createTable(schema);
    schema = {
        TableName : "Wall",
        KeySchema: [
            { AttributeName: "time", KeyType: "HASH"},  //Partition key
        ],
        AttributeDefinitions: [
            { AttributeName: "time", AttributeType: "N" },
        ],
        ProvisionedThroughput: {
            ReadCapacityUnits: 5,
            WriteCapacityUnits: 5
        }
    };
    createTable(schema);
    schema = {
        TableName : "RSVP",
        KeySchema: [
            { AttributeName: "time", KeyType: "HASH"},  //Partition key
        ],
        AttributeDefinitions: [
            { AttributeName: "time", AttributeType: "N" },
        ],
        ProvisionedThroughput: {
            ReadCapacityUnits: 5,
            WriteCapacityUnits: 5
        }
    };
    createTable(schema);
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

const doSubmit = function(params, attributes, table, forwardLocation, response) {

    let responseCode = 303;

    for (let index in attributes) {
        let attribute = attributes[index];
        if (params[attribute] == undefined) {
            console.error("Incomplete contact message: " + JSON.stringify(params));
            return;
        }
    }
    let putData = { "TableName": table, "Item" : params }
    putData["Item"]["time"] = new Date().getTime();
    docClient.put(putData, function(err, data) {
       if (err) {
           console.error("Unable to add contact: ", JSON.stringify(putData), ". Error JSON:", JSON.stringify(err, null, 2));
           forwardLocation += "?success=false"
       } else {
           console.log("PutItem succeeded:", JSON.stringify(putData));
           forwardLocation += "?success=true"
       }
       response.writeHead(responseCode, {"Location": forwardLocation});
       response.end();
    });
};

const promisifyScan = function(tablename, params) {

    var scanParams = {
        TableName: tablename,
        ProjectionExpression: params.join(", "),
    };

    return new Promise(function(resolve, reject) {
        docClient.scan(scanParams, function (err, data) {
            messages = [];
            if (err) {
                console.error("Unable to scan the table. Error JSON:", JSON.stringify(err, null, 2));
                reject(err);
            } else {
                resolve(data.Items)
            }
        })
    });
};

const ContactAttributes = [ 'firstname', 'lastname', 'subject', 'message' ];
const RSVPAttributes = [ 'firstname', 'lastname', 'starter', 'main', 'highchairs', 'special' ];
const WallAttributes = [ 'firstname', 'lastname', 'message' ];

const scanContact = promisifyScan("Contact", ContactAttributes).then(
        function(result) {
            console.log("Scanned Contact table")
            return { "Contact": result };
        }, function(err) {
            console.error("Could not scan Contact table")
        }
    );

const scanRSVP = promisifyScan("RSVP", RSVPAttributes).then(
        function(result) {
            console.log("Scanned RSVP table")
            return { "RSVP": result };
        }, function(err) {
            console.error("Could not scan RSVP table")
        }
    );

const scanWall = promisifyScan("Wall", WallAttributes).then(
        function(result) {
            console.log("Scanned Wall table")
            return { "Wall": result };
        }, function(err) {
            console.error("Could not scan Wall table")
        }
    );

http.createServer(function(request, response) {

    console.log("Request received at url: " + request.url)

    let forwardLocation = request["headers"]["referer"];

    if (request.method == 'POST') {
        let requestBody = '';

        request.on('data', function (data) {
            requestBody += data;
        });

        request.on('end', function () {
            let params = convertPostToJson(requestBody);

            if (request.url === "/contact") {
                doSubmit(params, ContactAttributes, "Contact", forwardLocation, response)
            }
            if (request.url === "/wall") {
                doSubmit(params, WallAttributes, "Wall", forwardLocation, response)
            }
            if (request.url === "/rsvp") {
                doSubmit(params, RSVPAttributes, "RSVP", forwardLocation, response);
            }
        });
    }
    if (request.method == 'GET') {
        let requestBody = '';

        request.on('data', function (data) {
            requestBody += data;
        });

        request.on('end', function () {
            if (request.url === "/results") {
                Promise.all([
                    scanContact,
                    scanRSVP,
                    scanWall,
                ]).then(function(data, err) {
                    templateData = { "Contact": data[0]["Contact"], "RSVP": data[1]["RSVP"], "Wall": data[2]["Wall"] };
                    let page = resultsTemplate(templateData);
                    response.write(page);
                    response.end();
                }).catch(function(err) {
                    console.error("Could not scan tables")
                    response.writeHead(500, err);
                    response.end();
                });
            }
        });
    }
}).listen(parseInt(port, 10));

console.log("Server running at\n  => http://localhost:" + port + "/\nCTRL + C to shutdown");
