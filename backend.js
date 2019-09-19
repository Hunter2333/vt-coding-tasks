// Github Auth
const fs = require("fs");
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
const nodemailer  = require("nodemailer");
const smtpTransport = require('nodemailer-smtp-transport');
const config = require('./config');
const transport = nodemailer.createTransport(smtpTransport({
  service: config.email.service,
  auth: {
    user: config.email.user,
    pass: config.email.pass
  }
}));

function GetTableAttributes(file_content) {
  var attributes = new Array();
  //var rows = new Array();
  var rows = file_content.split("\r\n");
  attributes.push(rows[0].split(","));
  return attributes;
}

function insertData(file){
  MongoClient.connect(DB_CONN_STR, { useNewUrlParser: true },  function(err, db) {
    if (err) throw err;
    console.log("Database Connected!");
    var dbo = db.db("sap-cx");
    var collection = dbo.collection("FileChanges");
    fs.readFile('./modelt-az-report-repository/'+file, function(err, data) {
      console.log('checkout '+ file);
      var file_content = data.toString('utf8');
      var attributes = GetTableAttributes(file_content);
      //TODO
      var document = {Time: Date(), ChangedFile: file, Content: file_content};
      collection.insertOne(document, function (err, result) {
        if(err) throw err;
        else // Send Email to recipients
          sendNotificationEmail(config.recipient, file, file_content);
        //console.log(result);
      });
      db.close();
    });
});
}

/*function sendNotificationEmail(recipient, file, file_content){
  //TODO
  var emailContent = "Time: " + Date() + "\nChangedFile: " + file + "\nChangedContent: " + file_content;
  for(var i = 0; i < recipient.length; i++) {
    transport.sendMail({
      from    : config.email.user,
      to      : recipient[i].emailAddress,
      subject : '【CHANGED FILE】 /modelt-az-report-repository/' + file,
      text: emailContent
    }, function(err, res) {
      console.log(err, res);
    });
  }
}*/

//temp
function sendNotificationEmail(recipient, fileDir){
  fs.readFile('./modelt-az-report-repository/'+fileDir, function(err, data) {
    console.log('checkout ' + fileDir);
    var emailContent = "【TIME】\n" + Date() + "\n----------------------------------------------------------------------------------\n\n"
        + "【CHANGED FILE】\n " + fileDir + "\n----------------------------------------------------------------------------------\n\n"
        + "【FILE CONTENT】\n" + data.toString('utf8');
    for(var i = 0; i < recipient.length; i++) {
      transport.sendMail({
        from    : config.email.user,
        to      : recipient[i].emailAddress,
        subject : '【CHANGED FILE】 /modelt-az-report-repository/' + fileDir,
        text: emailContent
      }, function(err, res) {
        console.log(err, res);
      });
    }
  });
}

function checkFile(fileDir)
{
  // Save Diff Result into Database
  if(fileDir.search("select-27.csv") != -1)
  //insertData(changedFileDir);
    sendNotificationEmail(config.recipient, fileDir);
}

//changedFilesDiffInfo[i]:
/*/kpis/daily/2019-09-09-06/use/select-3.csv b/kpi
s/daily/2019-09-09-06/use/select-3.csv
index e7631557e..d12270e31 100644
--- a/kpis/daily/2019-09-09-06/use/select-3.csv
+++ b/kpis/daily/2019-09-09-06/use/select-3.csv
@@ -1,7 +1,7 @@
    customer_id,customer_code,customer_name,proj_id,proj_code,e
nv_type,env_code,env_name,env_creation_time,env_status
-----------,-------------,-------------,-------,---------,-
    -------,--------,--------,-----------------,----------
    1,sreuse,SRE US,2,sreuse,project,z1,NULL,2018-05-16 06:28:4
2.8800000,CLUSTER_REMOVED
-1,sreuse,SRE US,2,sreuse,commerce,dev1,dev1,2018-05-17 15:3
1:54.1780000,DEMATERIALIZED
+1,sreuse,SRE US,2,sreu2ewa,commerce,dev1,dev1,2018-05-17 15
:31:54.1780000,DEMATERIALIZED
2,sreaue,SRE,3,sreuse1,project,z1,NULL,2018-05-31 13:52:50.
4320000,DRAFT
2,sreaue,SRE,3,sreuse1,dmz,dmz,NULL,2018-05-31 13:52:51.662
0000,DEMATERIALIZED
2,sreaue,SRE,4,sreuse2,project,z1,NULL,2018-05-31 14:46:15.
2660000,DEMATERIALIZED*/
function getChangedLineInfoInFile(str)
{
  //Map Format: [lineNo, changeType]
  let changedLineInfoList = new Map();
  var lines = str.split("\n");
  for(var i = 0; i < lines.length; i++)
  {
    if(lines[i].substring(0,2) == "@@")
    {
      var changes = lines[i].split(" ");
      //cut START "@@'
      changes.splice(0,1);
      //cut things both include and after END "@@'
      for(var j = 0; j < changes.length; j++)
      {
        var count = 0;
        if(changes[j] == "@@") count++;
        if(count > 0)
        {
          changes.splice(j, changes.length - j);
          break;
        }
      }
      //console.log(changes);
      //changes[j]: "+1,7"
      for(var j = 0; j < changes.length; j++)
      {
        let tempStr = changes[j].substring(1, changes[j].length);
        //tempStr: "1,7"
        //Get changed Line Number in this File
        let start = parseInt(tempStr.split(",")[0]);
        let spread = parseInt(tempStr.split(",")[1]);
        let lineNo = start + (spread - 1) / 2;
        //Update ChangeType for this line, representing by "+" or "-"
        var changeType = "";
        if(changedLineInfoList.has(lineNo))
        {
          changeType = changedLineInfoList.get(lineNo);
        }
        changedLineInfoList.set(lineNo, changeType + changes[j][0]);
      }
      //Get Changing Operation Type: Update || Insert || Delete
      changedLineInfoList.forEach(function (value, key, map) {
        //console.log("key: " + key + ", value: " + value + "\n");
        if(value == "+") changedLineInfoList.set(key, "Insert");
        else if(value == "-") changedLineInfoList.set(key, "Delete");
        else changedLineInfoList.set(key, "Update");
      });
      return changedLineInfoList;
    }
  }
}

//For select-27.csv in ./hourly
//TODO
function checkDiff(diffresult) {
  var changedFilesDiffInfo = diffresult.split("diff --git a/");
  changedFilesDiffInfo.splice(0, 1);
  for(var i = 0; i < changedFilesDiffInfo.length; i++)
  {
    var changedFileDir = changedFilesDiffInfo[i].split(".csv")[0] + ".csv";
    var changedLineInfoList = getChangedLineInfoInFile(changedFilesDiffInfo[i]);
    /*console.log(changedFileDir + "\n");
    changedLineInfoList.forEach(function (value, key, map) {
      console.log("key: " + key + ", value: " + value);
    });
    console.log("*********************\n");*/
    console.log("There is change in file:");
    console.log("/" + changedFileDir);
    console.log("*********************************")
    git("./modelt-az-report-repository").raw(
        [
          'checkout',
          'origin/master',
          '--',
          changedFileDir
        ]).exec(() => checkFile(changedFileDir));
  }
}

// Start Server at Port 8080
/*const app = express();
app.use(express.static("frontend")).listen(8080);
c.exec('start chrome http://localhost:8080/index.html');*/


if (!fs.existsSync('./'+FOLDER)) {
  git().clone(remote)
      .exec(() => console.log('finished'))
      .catch((err) => console.error('failed: ', err));
}else{
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
    git('./modelt-az-report-repository').diff(["origin/master"], function(err,status){
      console.log(status);
      checkDiff(status);
    });
  })
}
