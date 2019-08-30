// Github Auth
const fs = require("fs");
const USER = 'I314119';
const PASS = '339f7a55781e7d54e99752f3f2a82d3f91a9aa96';
const FOLDER = 'modelt-az-report-repository';
const REPO = 'github.tools.sap/c4core-sre/';
const git = require('simple-git/promise');
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

function insertData(file){
  MongoClient.connect(DB_CONN_STR, { useNewUrlParser: true },  function(err, db) {
    if (err) throw err;
    console.log("Database Connected!");
    var dbo = db.db("sap-cx");
    var collection = dbo.collection("FileChanges");
    fs.readFile('./modelt-az-report-repository/'+file, function(err, data) {
      console.log('checkout '+ file);
      var document = {Time: Date(), ChangedFile: file, Content: data.toString('utf8')};
      collection.insertOne(document, function (err, result) {
        if(err) throw err;
        //console.log(result);
      });
      db.close();
    });
});
}

//TODO
function sendNotificationEmail(recipient, file){
  fs.readFile('./modelt-az-report-repository/'+file, function(err, data) {
    var emailContent = "Time: " + Date() + "\nChangedFile: " + file + "\nContent: " + data.toString('utf8');
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
  });
}

function checkDiff(diffSummary) {
  for (var i = 0, len = diffSummary.files.length; i < len; i++)
  {
    /*if(diffSummary.files[i].file.includes("hourly"))
    {
      console.log("There is changes in file:");
      console.log(diffSummary.files[i]);
      console.log("*********************************")
      var f = diffSummary.files[i].file;
      git("./modelt-az-report-repository").raw(
        [
          'checkout',
          'origin/master',
          '--',
          f
        ]);
      // Save Diff Result into Database
      insertData(f, i);
    }*/
    console.log("There is changes in file:");
    console.log(diffSummary.files[i]);
    console.log("*********************************")
    var f = diffSummary.files[i].file;
    git("./modelt-az-report-repository").raw(
        [
          'checkout',
          'origin/master',
          '--',
          f
        ]).then(() => sendNotificationEmail(config.recipient, f));
    // Save Diff Result into Database
    insertData(f);
  }          
}

// Start Server at Port 8080
const app = express();
app.use(express.static("frontend")).listen(8080);
c.exec('start chrome http://localhost:8080/index.html');

// Start Git Diff Schedule Task
//const rule = new schedule.RecurrenceRule();
//rule.minute = [10, 30, 50];
const rule = '30 * * * * *';
schedule.scheduleJob(rule, function () {
  // run on xx:xx:30 every minute
  // run on xx:10 & xx:30 & xx:50 every hour
  console.log('Schedule Rule is Running!');
  //git.listRemote([], console.log.bind(console));
  if (!fs.existsSync('./'+FOLDER)) {
    git().clone(remote)
        .then(() => console.log('finished'))
        .catch((err) => console.error('failed: ', err));
  }else{
    console.log('Local Copy is already existing!')
    git('./modelt-az-report-repository').diffSummary()
        .then((summary) => checkDiff(summary))
        .catch((err) => console.error('failed: ', err));
  }
})

