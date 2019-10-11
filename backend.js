// Github Auth
const fs = require("fs");
const readline = require("readline");
const USER = 'I354995';
const PASS = '43a4b431c7dc948abba63a3b7edaf7da5102563e';
const FOLDER = 'modelt-az-report-repository';
const REPO = 'github.tools.sap/COPS/';
const git = require('simple-git');
//const git = require('simple-git/promise');
const remote = `https://${USER}:${PASS}@${REPO}${FOLDER}`;

// Database Connection
const MongoClient = require('mongodb').MongoClient;
const DB_CONN_STR = "mongodb://localhost:27017/sap-cx";

// node.js Scheduled Task related
const schedule = require('node-schedule');

// node.js server
const express = require("express");

// node.js child process
const c = require('child_process');

// node.js Email sender
const nodemailer = require("nodemailer");
const smtpTransport = require('nodemailer-smtp-transport');
const config = require('./config');
const transport = nodemailer.createTransport(smtpTransport({
    service: config.email.service,
    auth: {
        user: config.email.user,
        pass: config.email.pass
    }
}));

// file change type
const ChangeType = ["New File Created", "Whole File Deleted", "File Updated"];
const FileContent = ["", "ORIGINAL", "UPDATED"];

function readFileToArr(fReadName, callback) {
    console.log('checkout ' + fReadName);
    var fRead = fs.createReadStream(fReadName);
    var objReadline = readline.createInterface({
        input: fRead
    });
    var arr = new Array();
    objReadline.on('line', function (line) {
        var row = line.split(",");
        arr.push(row);
        //console.log('line:'+ line);
    });
    objReadline.on('close', function () {
        //console.log(arr);
        callback(arr);
    });
}

// ONLY for recording select-27.csv updates in DB
// Whole File created
function recordInDB_file_created(file) {
    if (file.search("select-27.csv") == -1) return;
    sendNotificationEmail(file, 0);
    readFileToArr('./modelt-az-report-repository/' + file, function (file_content) {
        //console.log(file_content);
        file_content.forEach(function (file_content_i) {
            //console.log(file_content[i].length);
            //if(file_content_i != file_content[0] && file_content_i.length == file_content[0].length) {
            if (file_content_i != file_content[0] && file_content_i.length == file_content[0].length && file_content_i[0] != "-----------") {
                console.log("---------------RECORD FILE CONTENT IN DB---------------");
                // DATA MODEL
                var customer_id = file_content_i[0];
                var customer_code = file_content_i[1];
                var customer_name = file_content_i[2];
                var env_id = file_content_i[3];
                var env_code = file_content_i[4];
                var env_name = file_content_i[5];
                var deployment_id = file_content_i[6];
                var failed_deployment = file_content_i[7];
                var deployment_started = file_content_i[8];
                var time_queried = file_content_i[9];
                var already_running_in_minutes = file_content_i[10];

                var document = {
                    DBTime: Date(),
                    ChangedFile: file,
                    ChangeType: "Insert",
                    CustomerID: customer_id,
                    CustomerCode: customer_code,
                    CustomerName: customer_name,
                    EnvID: env_id,
                    EnvCode: env_code,
                    EnvName: env_name,
                    DeploymentID: deployment_id,
                    FailedDeployment: failed_deployment,
                    DeploymentSatarted: deployment_started,
                    TimeQueried: time_queried,
                    AlreadyRunningInMinutes: already_running_in_minutes
                };
                MongoClient.connect(DB_CONN_STR, {useNewUrlParser: true, useUnifiedTopology: true}, function (err, db) {
                    if (err) throw err;
                    console.log("Database Connected! --- TO INSERT A WHOLE FILE LINE");
                    var dbo = db.db("sap-cx");
                    var collection = dbo.collection("FileChanges");
                    collection.insertOne(document, function (err, result) {
                        if (err) throw err;
                        //console.log(result);
                    });
                    db.close();
                });
            }
        });
    });
}

// ONLY for recording select-27.csv updates in DB
// Whole File deleted
function recordInDB_file_deleted(file) {
    if (file.search("select-27.csv") == -1) return;
    sendNotificationEmail(file, 1);
    MongoClient.connect(DB_CONN_STR, {useNewUrlParser: true, useUnifiedTopology: true}, function (err, db) {
        if (err) throw err;
        console.log("Database Connected! ---- TO DELETE WHOLE FILE LINES");
        var dbo = db.db("sap-cx");
        var collection = dbo.collection("FileChanges");
        collection.updateMany({ChangedFile: file}, {
            $set: {
                DBTime: Date(),
                ChangeType: "Delete"
            }
        }, function (err, res) {
            if (err) throw err;
            console.log(res.result.nModified + "Documents Updated.");
        });
        db.close();
    });
}

// ONLY for recording select-27.csv updates in DB
// File modified
function recordInDB_file_modified(file, str) {
    if (file.search("select-27.csv") == -1) return;
    readFileToArr('./modelt-az-report-repository/' + file, function (file_content) {
        var updated_file_content = file_content[0].join(",") + "\n\n";
        //console.log("\n\n*********************************\n" + updated_file_content + "***************************************\n\n");
        var lines = str.split("\n");
        for (var i = 0; i < lines.length; i++) {
            (function (i) {
                if (lines[i].substring(0, 2) == "@@") {
                    // for line numbers in file ---- incompleted
                    /*var changes_chunk = lines[i].split(" ");
                    //cut START "@@'
                    changes_chunk.splice(0, 1);
                    //cut things both include and after END "@@'
                    for (var j = 0; j < changes_chunk.length; j++) {
                        var count = 0;
                        if (changes_chunk[j] == "@@") count++;
                        if (count > 0) {
                            changes_chunk.splice(j, changes_chunk.length - j);
                            break;
                        }
                    }
                    //console.log(changes_chunk);
                    //changes_chunk: "-1,7", "+1,7"
                    let tempStr_sub = changes_chunk[0].substring(1, changes_chunk[0].length);
                    let tempStr_add = changes_chunk[1].substring(1, changes_chunk[1].length);
                    //tempStr: "1,7"
                    let start = Math.min(parseInt(tempStr_sub.split(",")[0]), parseInt(tempStr_add.split(",")[0]));
                    let spread = Math.max(parseInt(tempStr_sub.split(",")[1]), parseInt(tempStr_add.split(",")[1]));
                    console.log(start, spread);*/
                    for (var k = i + 1; k < lines.length && lines[k].substring(0, 2) != "@@"; k++) {
                        (function (k) {
                            //console.log("\n" + lines[k] + "\n");
                            var line_content = lines[k].split(",");
                            if (line_content.length == 11) {
                                var customer_id = line_content[0].substring(1, line_content[0].length);
                                var customer_code = line_content[1];
                                var customer_name = line_content[2];
                                var env_id = line_content[3];
                                var env_code = line_content[4];
                                var env_name = line_content[5];
                                var deployment_id = line_content[6];
                                var failed_deployment = line_content[7];
                                var deployment_started = line_content[8];
                                var time_queried = line_content[9];
                                var already_running_in_minutes = line_content[10];

                                var contentStr = {
                                    ChangedFile: file,
                                    CustomerID: customer_id,
                                    EnvID: env_id,
                                    DeploymentID: deployment_id
                                }
                                //console.log(contentStr);
                                // SUB
                                // -: update DB
                                if (lines[k][0] == "+") {
                                    MongoClient.connect(DB_CONN_STR, {
                                        useNewUrlParser: true,
                                        useUnifiedTopology: true
                                    }, function (err, db) {
                                        if (err) throw err;
                                        console.log("Database Connected! ---- TO DELETE A LINE IN FILE");
                                        var dbo = db.db("sap-cx");
                                        var collection = dbo.collection("FileChanges");
                                        collection.updateOne(
                                            contentStr, {
                                                $set: {
                                                    DBTime: Date(),
                                                    ChangeType: "Delete"
                                                }
                                            }, function (err, result) {
                                                if (err) throw err;
                                                //console.log(result);
                                            });
                                        db.close();
                                    });
                                }
                                // ADD
                                // +: insert / update DB
                                else if (lines[k][0] == "-") {
                                    // notification email content by line
                                    updated_file_content = updated_file_content + lines[k].substring(1, lines[k].length) + "\n";

                                    MongoClient.connect(DB_CONN_STR, {
                                        useNewUrlParser: true,
                                        useUnifiedTopology: true
                                    }, function (err, db) {
                                        if (err) throw err;
                                        console.log("Database Connected! ---- TO SEARCH FOR A FILE LINE IN DB");
                                        var dbo = db.db("sap-cx");
                                        var collection = dbo.collection("FileChanges");
                                        collection.find(contentStr).toArray(function (err, res) {
                                            if (err) throw err;
                                            //console.log("SEARCH RESULT LENGTH: " + res.length + "\n");
                                            db.close();
                                            if (res.length > 0) {
                                                // UPDATE
                                                MongoClient.connect(DB_CONN_STR, {
                                                    useNewUrlParser: true,
                                                    useUnifiedTopology: true
                                                }, function (err, db) {
                                                    if (err) throw err;
                                                    console.log("Database Connected! ---- TO UPDATE A FILE LINE");
                                                    var dbo = db.db("sap-cx");
                                                    var collection = dbo.collection("FileChanges");
                                                    collection.updateOne(
                                                        contentStr, {
                                                            $set: {
                                                                DBTime: Date(),
                                                                ChangeType: "Update",
                                                                FailedDeployment: failed_deployment,
                                                                DeploymentSatarted: deployment_started,
                                                                TimeQueried: time_queried,
                                                                AlreadyRunningInMinutes: already_running_in_minutes
                                                            }
                                                        }, function (err, result) {
                                                            if (err) throw err;
                                                            //console.log(result);
                                                            db.close();
                                                        });
                                                });
                                            } else {
                                                // INSERT
                                                var document = {
                                                    DBTime: Date(),
                                                    ChangedFile: file,
                                                    ChangeType: "Insert",
                                                    CustomerID: customer_id,
                                                    CustomerCode: customer_code,
                                                    CustomerName: customer_name,
                                                    EnvID: env_id,
                                                    EnvCode: env_code,
                                                    EnvName: env_name,
                                                    DeploymentID: deployment_id,
                                                    FailedDeployment: failed_deployment,
                                                    DeploymentSatarted: deployment_started,
                                                    TimeQueried: time_queried,
                                                    AlreadyRunningInMinutes: already_running_in_minutes
                                                };
                                                MongoClient.connect(DB_CONN_STR, {
                                                    useNewUrlParser: true,
                                                    useUnifiedTopology: true
                                                }, function (err, db) {
                                                    if (err) throw err;
                                                    console.log("Database Connected! ---- TO INSERT A FILE LINE");
                                                    var dbo = db.db("sap-cx");
                                                    var collection = dbo.collection("FileChanges");
                                                    collection.insertOne(document, function (err, result) {
                                                        if (err) throw err;
                                                        //console.log(result);
                                                        db.close();
                                                    });
                                                });
                                            }
                                        });
                                    });
                                }
                            }
                        })(k);
                    }
                }
            })(i);
        }
        // send notification email
        sendNotificationEmail(file, 2, updated_file_content);
    });
}

function sendNotificationEmail(fileDir, changeTypeID, updated_file_content) {
    fs.readFile('./modelt-az-report-repository/' + fileDir, function (err, data) {
        console.log('checkout ' + fileDir);
        if (changeTypeID == 2) {
            // new Email content for modified file --- only show updated lines
            var emailContent = "【TIME】\n" + Date() + "\n----------------------------------------------------------------------------------\n\n"
                + "【CHANGED FILE】\n " + fileDir + "\n----------------------------------------------------------------------------------\n\n"
                + "【CHANGE TYPE】\n " + ChangeType[changeTypeID] + "\n----------------------------------------------------------------------------------\n\n"
                + "【" + FileContent[changeTypeID] + " FILE CONTENT】\n" + updated_file_content;
        } else {
            var emailContent = "【TIME】\n" + Date() + "\n----------------------------------------------------------------------------------\n\n"
                + "【CHANGED FILE】\n " + fileDir + "\n----------------------------------------------------------------------------------\n\n"
                + "【CHANGE TYPE】\n " + ChangeType[changeTypeID] + "\n----------------------------------------------------------------------------------\n\n"
                + "【" + FileContent[changeTypeID] + " FILE CONTENT】\n" + data.toString('utf8');
        }
        for (var i = 0; i < config.recipient.length; i++) {
            transport.sendMail({
                from: config.email.user,
                to: config.recipient[i].emailAddress,
                subject: '【LONG RUNNING DEPLOYMENT DETECTED IN CCV2】【' + ChangeType[changeTypeID] + '】 /modelt-az-report-repository/' + fileDir,
                text: emailContent
            }, function (err, res) {
                console.log(err, res);
                console.log("\n");
            });
        }
    });
}

function getFileChangeType(str) {
    //Map Format: [changeTypeNo, description]
    let fileChangeType = new Map();
    var lines = str.split("\n");
    for (var i = 0; i < lines.length; i++) {
        // Whole file DELETED
        if (lines[i].split(" ")[0] == "new" && lines[i].split(" ")[1] == "file" && lines[i].split(" ")[2] == "mode") {
            console.log("------------FILE DELETED-------------");
            fileChangeType.set(-1, "File Deleted");
            break;
        }
        // Whole file CREATED
        if (lines[i].split(" ")[0] == "deleted" && lines[i].split(" ")[1] == "file" && lines[i].split(" ")[2] == "mode") {
            console.log("------------FILE CREATED-------------");
            fileChangeType.set(-2, "File Created");
            break;
        }
        // MODIFICATION within a file
        if (lines[i].substring(0, 2) == "@@") {
            console.log("------------FILE MODIFIED-------------");
            fileChangeType.set(0, "File Modified");
            break;
        }
    }
    return fileChangeType;
}

//For select-27.csv in ./hourly
function checkDiff(diffresult, callback) {
    var changedFilesDiffInfo = diffresult.split("diff --git a/");
    changedFilesDiffInfo.splice(0, 1);
    for (var i = 0; i < changedFilesDiffInfo.length; i++) {
        var changedFileDir = changedFilesDiffInfo[i].split(".csv")[0] + ".csv";
        var fileChangeType = getFileChangeType(changedFilesDiffInfo[i]);
        /*console.log(changedFileDir + "\n");
        console.log(changedLineInfoList.size + "\n");
        if(changedLineInfoList.size > 0)
        {
          changedLineInfoList.forEach(function (value, key, map) {
            console.log("key: " + key + ", value: " + value);
          });
        }*/
        console.log("*********************************");
        console.log("There is change in file:");
        console.log("/" + changedFileDir);
        console.log("*********************************");
        // Whole File DELETED
        if (fileChangeType.has(-1)) {
            recordInDB_file_deleted(changedFileDir);
            fs.unlinkSync('./modelt-az-report-repository/' + changedFileDir);
            return;
        }
        // Whole File CREATED
        if (fileChangeType.has(-2)) {
            git("./modelt-az-report-repository").raw(
                [
                    'checkout',
                    'origin/master',
                    '--',
                    changedFileDir
                ]).exec(() => recordInDB_file_created(changedFileDir));
        }
        // File MODIFIED
        if (fileChangeType.has(0)) {
            recordInDB_file_modified(changedFileDir, changedFilesDiffInfo[i]);
            git("./modelt-az-report-repository").raw(
                [
                    'checkout',
                    'origin/master',
                    '--',
                    changedFileDir
                ]);
        }
    }
    callback();
}

// Start Server at Port 8080
//TODO
// API for Frontend
const app = express();
const path = require("path");
const posts = require("./server/routes/posts");
app.use(express.static(path.join(__dirname, 'dist/vt-coding-tasks/')));
app.use("/posts", posts);
// Catch all other routes request and return it to the index
app.get('*', (req, res)=>{
  res.sendFile(path.join(__dirname, 'dist/vt-coding-tasks/index.html'));
});
app.listen(8080, (req, res)=>{
    console.log('Running on port 8080');
});
c.exec('start chrome http://localhost:8080/index.html');


// ----------------- MAIN ------------------
if (!fs.existsSync('./' + FOLDER)) {
    git().clone(remote)
        .exec(() => console.log('finished'));
    //.catch((err) => console.error('failed: ', err));
} else {
    //TODO
    // Start Git Pull Schedule Task
    // Pull from https://github.tools.sap/COPS/modelt-az-report-repository every day at 7:30AM
    const pull_rule = '0 30 7 * * *';
    schedule.scheduleJob(pull_rule, function () {
        console.log('Pull Schedule Rule is Running!');
        console.log('Local Copy is already existing!');
        git('./modelt-az-report-repository').diff(["origin/master"], function (err, status) {
            console.log(status + "\n");
            checkDiff(status, function () {
                git('./modelt-az-report-repository').pull('origin', 'master', function (err, result) {
                    if (err) throw err;
                    console.log(result + "\n");
                });
            });
        });
    });

    // Start Git Diff Schedule Task
    //const diff_rule = new schedule.RecurrenceRule();
    //diff_rule.minute = [0, 5, 10, 15, 20, 25, 30, 35, 40, 45, 50, 55];
    const diff_rule = '30 * * * * *';
    schedule.scheduleJob(diff_rule, function () {
        // run on xx:xx:30 every minute
        // run on xx:10 & xx:30 & xx:50 every hour
        console.log('Diff Schedule Rule is Running!');
        //git.listRemote([], console.log.bind(console));
        console.log('Local Copy is already existing!');
        git('./modelt-az-report-repository').diff(["origin/master"], function (err, status) {
            console.log(status + "\n");
            checkDiff(status, function(){});
        });
    });
}
