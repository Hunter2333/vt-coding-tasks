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
const ChangeType = ["New File Created", "Whole File Deleted", "Insert", "Delete", "Update"];
const FileContent = ["", "ORIGINAL", "UPDATED", "UPDATED", "UPDATED"];

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
    MongoClient.connect(DB_CONN_STR, {useNewUrlParser: true, useUnifiedTopology: true}, function (err, db) {
        if (err) throw err;
        console.log("Database Connected!");
        var dbo = db.db("sap-cx");
        var collection = dbo.collection("FileChanges");
        readFileToArr('./modelt-az-report-repository/' + file, function(file_content){
            //console.log(file_content);
            for(var i = 1; i < file_content.length; i++)
            {
                //console.log(file_content[i].length);
                //if(file_content[i].length == file_content[0].length)
                if(file_content[i].length == file_content[0].length && file_content[i][0] != "-----------")
                {
                    console.log("---------------RECORD FILE CONTENT IN DB---------------");
                    // DATA MODEL
                    var customer_id = file_content[i][0];
                    var customer_code = file_content[i][1];
                    var customer_name = file_content[i][2];
                    var env_id = file_content[i][3];
                    var env_code = file_content[i][4];
                    var env_name = file_content[i][5];
                    var deployment_id = file_content[i][6];
                    var failed_deployment = file_content[i][7];
                    var deployment_started = file_content[i][8];
                    var time_queried = file_content[i][9];
                    var already_running_in_minutes = file_content[i][10];

                    var document = {DBTime: Date(), ChangedFile: file, ChangeType: "Insert",
                    CustomerID: customer_id, CustomerCode: customer_code, CustomerName: customer_name,
                    EnvID: env_id, EnvCode: env_code, EnvName: env_name, DeploymentID: deployment_id, FailedDeployment: failed_deployment,
                    DeploymentSatarted: deployment_started, TimeQueried: time_queried, AlreadyRunningInMinutes: already_running_in_minutes};
                    collection.insertOne(document, function (err, result) {
                        if (err) throw err;
                        //console.log(result);
                    });
                }
            }
        });
        db.close();
    });
}

// ONLY for recording select-27.csv updates in DB
// Whole File deleted
function recordInDB_file_deleted(file) {
    if (file.search("select-27.csv") == -1) return;
    sendNotificationEmail(file, 1);
    MongoClient.connect(DB_CONN_STR, {useNewUrlParser: true, useUnifiedTopology: true}, function (err, db) {
        if (err) throw err;
        console.log("Database Connected!");
        var dbo = db.db("sap-cx");
        var collection = dbo.collection("FileChanges");
        collection.update({ChangedFile: file},{$set:{DBTime: Date(), ChangeType: "Delete"}},{safe:true},function(err,result){
            //console.log(result);
        });
        db.close();
    });
}

function sendNotificationEmail(fileDir, changeTypeID){
  fs.readFile('./modelt-az-report-repository/'+fileDir, function(err, data) {
    console.log('checkout ' + fileDir);
    var emailContent = "【TIME】\n" + Date() + "\n----------------------------------------------------------------------------------\n\n"
        + "【CHANGED FILE】\n " + fileDir + "\n----------------------------------------------------------------------------------\n\n"
        + "【CHANGE TYPE】\n " + ChangeType[changeTypeID] + "\n----------------------------------------------------------------------------------\n\n"
        + "【" + FileContent[changeTypeID] + " FILE CONTENT】\n" + data.toString('utf8');
    for(var i = 0; i < config.recipient.length; i++) {
      transport.sendMail({
        from    : config.email.user,
        to      : config.recipient[i].emailAddress,
        subject : '【LONG RUNNING DEPLOYMENT DETECTED IN CCV2】【' + ChangeType[changeTypeID] + '】 /modelt-az-report-repository/' + fileDir,
        text: emailContent
      }, function(err, res) {
        console.log(err, res);
      });
    }
  });
}

function getChangedLineInfoInFile(str) {
    //Map Format: [lineNo, changeType]
    let changedLineInfoList = new Map();
    var lines = str.split("\n");
    for (var i = 0; i < lines.length; i++) {
        // Whole file DELETED
        if (lines[i].split(" ")[0] == "new" && lines[i].split(" ")[1] == "file" && lines[i].split(" ")[2] == "mode") {
            console.log("------------FILE DELETED-------------");
            changedLineInfoList.set(-1, "File Deleted");
            break;
        }
        // Whole file CREATED
        if (lines[i].split(" ")[0] == "deleted" && lines[i].split(" ")[1] == "file" && lines[i].split(" ")[2] == "mode") {
            console.log("------------FILE CREATED-------------");
            changedLineInfoList.set(-2, "File Created");
        }
        //TODO
        // more than one lines changed in one file
        // MODIFICATION within a file
        if (lines[i].substring(0, 2) == "@@") {
            var changes = lines[i].split(" ");
            //cut START "@@'
            changes.splice(0, 1);
            //cut things both include and after END "@@'
            for (var j = 0; j < changes.length; j++) {
                var count = 0;
                if (changes[j] == "@@") count++;
                if (count > 0) {
                    changes.splice(j, changes.length - j);
                    break;
                }
            }
            //console.log(changes);
            //changes[j]: "+1,7"
            for (var j = 0; j < changes.length; j++) {
                let tempStr = changes[j].substring(1, changes[j].length);
                //tempStr: "1,7"
                //Get changed Line Number in this File
                let start = parseInt(tempStr.split(",")[0]);
                let spread = parseInt(tempStr.split(",")[1]);
                let lineNo = start + (spread - 1) / 2;
                //Update ChangeType for this line, representing by "+" or "-"
                var changeType = "";
                if (changedLineInfoList.has(lineNo)) {
                    changeType = changedLineInfoList.get(lineNo);
                }
                changedLineInfoList.set(lineNo, changeType + changes[j][0]);
            }
            //Get Changing Operation Type: Update || Insert || Delete
            changedLineInfoList.forEach(function (value, key, map) {
                //console.log("key: " + key + ", value: " + value + "\n");
                if (value == "+") changedLineInfoList.set(key, "Insert");
                else if (value == "-") changedLineInfoList.set(key, "Delete");
                else changedLineInfoList.set(key, "Update");
            });
            break;
        }
    }
    return changedLineInfoList;
}

//For select-27.csv in ./hourly
//TODO
function checkDiff(diffresult) {
    var changedFilesDiffInfo = diffresult.split("diff --git a/");
    changedFilesDiffInfo.splice(0, 1);
    for (var i = 0; i < changedFilesDiffInfo.length; i++) {
        var changedFileDir = changedFilesDiffInfo[i].split(".csv")[0] + ".csv";
        var changedLineInfoList = getChangedLineInfoInFile(changedFilesDiffInfo[i]);
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
        if (changedLineInfoList.has(-1)) {
            recordInDB_file_deleted(changedFileDir);
            fs.unlinkSync('./modelt-az-report-repository/' + changedFileDir);
            return;
        }
        // Whole File CREATED
        if (changedLineInfoList.has(-2)) {
            git("./modelt-az-report-repository").raw(
                [
                    'checkout',
                    'origin/master',
                    '--',
                    changedFileDir
                ]).exec(() => recordInDB_file_created(changedFileDir));
        }
        //TODO
        // Modifications within a file
        /*git("./modelt-az-report-repository").raw(
            [
                'checkout',
                'origin/master',
                '--',
                changedFileDir
            ]).exec(() => recordInDB(changedFileDir, changedLineInfoList));*/
    }
}

// Start Server at Port 8080
/*const app = express();
app.use(express.static("frontend")).listen(8080);
c.exec('start chrome http://localhost:8080/index.html');*/


if (!fs.existsSync('./' + FOLDER)) {
    git().clone(remote)
        .exec(() => console.log('finished'))
    //.catch((err) => console.error('failed: ', err));
} else {
    // Start Git Diff Schedule Task
    //const rule = new schedule.RecurrenceRule();
    //rule.minute = [0, 5, 10, 15, 20, 25, 30, 35, 40, 45, 50, 55];
    const rule = '30 * * * * *';
    schedule.scheduleJob(rule, function () {
        // run on xx:xx:30 every minute
        // run on xx:10 & xx:30 & xx:50 every hour
        console.log('Schedule Rule is Running!');
        //git.listRemote([], console.log.bind(console));
        console.log('Local Copy is already existing!');
        git('./modelt-az-report-repository').diff(["origin/master"], function (err, status) {
            console.log(status);
            checkDiff(status);
        });
    })
}
