// Github Auth
const fs = require("fs");
const readline = require("readline");
const USER = 'I354995';
const PASS = '43a4b431c7dc948abba63a3b7edaf7da5102563e';
// const USER = 'I314119';
// const PASS = '339f7a55781e7d54e99752f3f2a82d3f91a9aa96';
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
  pool: true,
  host: config.email.host,
  port: config.email.port,
  secure: true,
  auth: {
    user: config.email.user,
    pass: config.email.pass
  }
}));

// Start Server at Port 8080
// API for Frontend
const app = express();
const path = require("path");
const routes = require("./server/routes/routes");
app.use(express.static(path.join(__dirname, 'dist/vt-coding-tasks/')));
app.use("/routes", routes);
// Catch all other routes request and return it to the index
app.get('*', (req, res) => {
  res.redirect('http://localhost:8080');
});

// Socket IO
const server = require("http").createServer(app);
const io = require("socket.io")(server);
server.listen(8080, (req, res) => {
  console.log(Date() + '\nRunning on port 8080\n');
});
io.on('connection', (socket) => {
  console.log(Date() + '\nNew connection!\n');
  socket.on('disconnect', () => {
    console.log(Date() + '\nOne disconnected!\n');
  });
});
c.exec('start chrome http://localhost:8080');

// file change type
const ChangeType = ["New File Created", "Whole File Deleted", "File Updated"];
const FileContent = ["", "ORIGINAL", "UPDATED"];

function readFileToArr(fReadName, callback) {
  console.log(Date() + '\ncheckout ' + fReadName + '\n');
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

function getModelTLink(file, deployment_id) {
  // ae.prodweu.model-t.cc.commerce.ondemand.com/#!/deployment/34613
  let link = "https://ae.prod";
  const region = file.split('/')[2];
  link = link + region + ".model-t.cc.commerce.ondemand.com/#!/deployment/" + deployment_id;
  return link;
}

// ONLY for recording select-27.csv updates in DB
// Whole File created
function recordInDB_file_created(file, str) {
  if (file.search("select-27.csv") == -1) return;
  var updated_file_content = "";
  var lines = str.split("\n");
  for (var i = 0; i < lines.length; i++) {
    (function (i) {
      if (lines[i].substring(0, 2) == "@@") {
        updated_file_content = updated_file_content + "+" + lines[i+1].substring(1, lines[i+1].length) + "\n";
        for (var k = i + 2; k < lines.length; k++) {
          (function (k) {
            //console.log("\n" + lines[k] + "\n");
            var line_content = lines[k].split(",");
            //if (line_content.length == 11) {
            if (line_content.length == 11 && line_content[3] != "------") {
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

              //console.log(contentStr);
              const link = getModelTLink(file, deployment_id);
              // INSERT
              // notification email content by line
              updated_file_content = updated_file_content + "+" + lines[k].substring(1, lines[k].length) + "\n" + link + "\n";
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
                DeploymentStarted: deployment_started,
                TimeQueried: time_queried,
                AlreadyRunningInMinutes: already_running_in_minutes,
                Link: link,
                DeleteTime: "/"
              };
              MongoClient.connect(DB_CONN_STR, {
                useNewUrlParser: true,
                useUnifiedTopology: true
              }, function (err, db) {
                if (err) console.log(err);
                console.log(Date() + "\nDatabase Connected! ---- TO INSERT WHOLE FILE LINES\n");
                var dbo = db.db("sap-cx");
                var collection = dbo.collection("CCv2LongRunningDeployment");
                collection.insertOne(document, function (err, result) {
                  if (err) console.log(err);
                  //console.log(result);
                  db.close();
                });
              });
            }
          })(k);
        }
      }
    })(i);
  }
  // send notification email
  sendNotificationEmail(file, 0, updated_file_content)
}

// ONLY for recording select-27.csv updates in DB
// Whole File deleted
function recordInDB_file_deleted(file) {
  if (file.search("select-27.csv") == -1) return;
  MongoClient.connect(DB_CONN_STR, {useNewUrlParser: true, useUnifiedTopology: true}, function (err, db) {
    if (err) console.log(err);
    console.log(Date() + "\nDatabase Connected! ---- TO DELETE WHOLE FILE LINES");
    var dbo = db.db("sap-cx");
    var collection = dbo.collection("CCv2LongRunningDeployment");
    collection.updateMany({ChangedFile: file, DeleteTime: "/", ChangeType: {$ne: "Delete"}}, {
      $set: {
        DeleteTime: Date(),
        ChangeType: "Delete"
      }
    }, function (err, res) {
      if (err) console.log(err);
      console.log(res.result.nModified + "Documents Updated.\n");
    });
    db.close();
  });
  readFileToArr('./modelt-az-report-repository/' + file, function (file_content) {
    //console.log(file_content);
    var updated_file_content = file_content[0].join(",") + "\n\n";
    //console.log("\n\n*********************************\n" + updated_file_content + "***************************************\n\n");
    file_content.forEach(function (file_content_i) {
      //console.log(file_content[i].length);
      //if(file_content_i != file_content[0] && file_content_i.length == file_content[0].length) {
      if (file_content_i != file_content[0] && file_content_i.length == file_content[0].length && file_content_i[0] != "-----------") {
        const link = getModelTLink(file, file_content_i[6]);
        updated_file_content = updated_file_content + "-" + file_content_i.join(',') + "\n" + link + "\n";
      }
    });
    // send notification email
    sendNotificationEmail(file, 1, updated_file_content)
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
          for (var k = i + 1; k < lines.length; k++) {
            (function (k) {
              //console.log("\n" + lines[k] + "\n");
              if(lines[k][0] == "+" || lines[k][0] == "-")
              {
                var line_content = lines[k].split(",");
                if (line_content.length == 11 && line_content[3] != "------") {
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
                    ChangeType: {$ne: "Delete"},
                    CustomerID: customer_id,
                    EnvID: env_id,
                    DeploymentID: deployment_id,
                  };

                  //console.log(contentStr);
                  const link = getModelTLink(file, deployment_id);
                  // SUB
                  // -: update DB
                  if (lines[k][0] == "+") {
                    updated_file_content = updated_file_content + "-" + lines[k].substring(1, lines[k].length) + "\n" + link + "\n";

                    MongoClient.connect(DB_CONN_STR, {
                      useNewUrlParser: true,
                      useUnifiedTopology: true
                    }, function (err, db) {
                      if (err) console.log(err);
                      console.log(Date() + "\nDatabase Connected! ---- TO DELETE A LINE IN FILE\n");
                      var dbo = db.db("sap-cx");
                      var collection = dbo.collection("CCv2LongRunningDeployment");
                      collection.updateOne(
                        contentStr, {
                          $set: {
                            ChangeType: "Delete",
                            DeleteTime: Date()
                          }
                        }, function (err, result) {
                          if (err) console.log(err);
                          //console.log(result);
                        });
                      db.close();
                    });
                  }
                  // ADD
                  // +: insert / update DB
                  else if (lines[k][0] == "-") {
                    // notification email content by line
                    updated_file_content = updated_file_content + "+" + lines[k].substring(1, lines[k].length) + "\n" + link + "\n";
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
                      DeploymentStarted: deployment_started,
                      TimeQueried: time_queried,
                      AlreadyRunningInMinutes: already_running_in_minutes,
                      Link: link,
                      DeleteTime: "/"
                    };
                    MongoClient.connect(DB_CONN_STR, {
                      useNewUrlParser: true,
                      useUnifiedTopology: true
                    }, function (err, db) {
                      if (err) console.log(err);
                      console.log(Date() + "\nDatabase Connected! ---- TO INSERT A FILE LINE\n");
                      var dbo = db.db("sap-cx");
                      var collection = dbo.collection("CCv2LongRunningDeployment");
                      collection.insertOne(document, function (err, result) {
                        if (err) console.log(err);
                        //console.log(result);
                        db.close();
                      });
                    });
                  }
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
  //console.log('checkout ' + fileDir);
  // new Email content
  var emailContent = "【TIME】\n" + Date() + "\n----------------------------------------------------------------------------------\n\n"
    + "【CHANGED FILE】\n " + fileDir + "\n----------------------------------------------------------------------------------\n\n"
    + "【CHANGE TYPE】\n " + ChangeType[changeTypeID] + "\n----------------------------------------------------------------------------------\n\n"
    + "【REGION】\n" + fileDir.split('/')[2].toUpperCase() + "\n----------------------------------------------------------------------------------\n\n"
    + "【" + FileContent[changeTypeID] + " FILE CONTENT】\n" + updated_file_content;
  for (var i = 0; i < config.recipient.length; i++) {
    (function (i) {
      transport.sendMail({
        from: config.email.user,
        to: config.recipient[i].emailAddress,
        subject: '【LONG RUNNING DEPLOYMENT DETECTED IN CCV2】【' + ChangeType[changeTypeID] + '】 /modelt-az-report-repository/' + fileDir,
        text: emailContent
      }, function (err, res) {
        console.log(err, res);
        console.log("\n");
      });
    })(i);
  }
}

function getFileChangeType(str) {
  //Map Format: [changeTypeNo, description]
  let fileChangeType = new Map();
  var lines = str.split("\n");
  //console.log(lines[0] + "\n");
  for (var i = 0; i < lines.length; i++) {
    // Whole file CREATED
    if (lines[i].split(" ")[0] == "deleted" && lines[i].split(" ")[1] == "file" && lines[i].split(" ")[2] == "mode") {
      console.log("------------FILE CREATED-------------");
      fileChangeType.set(-2, "File Created");
      break;
    }
    // Whole file DELETED
    else if (lines[i].split(" ")[0] == "new" && lines[i].split(" ")[1] == "file" && lines[i].split(" ")[2] == "mode") {
      console.log("------------FILE DELETED-------------");
      fileChangeType.set(-1, "File Deleted");
      break;
    }
    // MODIFICATION within a file
    else if (lines[i].substring(0, 2) == "@@") {
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
  changedFilesDiffInfo.splice(0, 1);  // changedFilesDiffInfo[0] = ' '
  console.log(changedFilesDiffInfo.length + "\n");
  for (var i = 0; i < changedFilesDiffInfo.length; i++) {
    var changedFileDir = changedFilesDiffInfo[i].split(".csv")[0] + ".csv";
    if(changedFileDir.indexOf("hourly") != -1) {
      console.log("*********************************");
      console.log("There is change in hourly query file:");
      console.log("/" + changedFileDir);
      console.log("*********************************");
      var fileChangeType = getFileChangeType(changedFilesDiffInfo[i]);
      // console.log(fileChangeType.size + "\n");
      // if(fileChangeType.size > 0)
      // {
      //   fileChangeType.forEach(function (value, key, map) {
      //     console.log("key: " + key + ", value: " + value);
      //   });
      //   console.log("\n");
      // }
      // Whole File CREATED
      if (fileChangeType.has(-2)) {
        recordInDB_file_created(changedFileDir, changedFilesDiffInfo[i]);
      }
      // Whole File DELETED
      if (fileChangeType.has(-1)) {
        recordInDB_file_deleted(changedFileDir);
      }
      // File MODIFIED
      if (fileChangeType.has(0)) {
        recordInDB_file_modified(changedFileDir, changedFilesDiffInfo[i]);
      }
    }
    }
  callback();
}


// ----------------- MAIN ------------------
if (!fs.existsSync('./' + FOLDER)) {
  git().clone(remote)
    .exec(() => console.log('finished'));
  //.catch((err) => console.error('failed: ', err));
}
// Start Git Fetch & Diff & Merge Schedule Task
const diff_rule = new schedule.RecurrenceRule();
//diff_rule.minute = [0, 5, 10, 15, 20, 25, 30, 35, 40, 45, 50, 55];
diff_rule.minute = [0, 10, 20, 30, 40, 50];
//diff_rule.minute = [0, 20, 40];
//diff_rule.minute = [0, 30];
//const diff_rule = '30 * * * * *';
schedule.scheduleJob(diff_rule, function () {
  // run on xx:xx:30 every minute
  // run on xx:10 & xx:30 & xx:50 every hour
  console.log(Date() + '\nDiff Schedule Rule is Running!');
  //git.listRemote([], console.log.bind(console));
  console.log('Local Copy is already existing!\n');
  git('./modelt-az-report-repository').fetch();
  git('./modelt-az-report-repository').diff(["origin/master"], async function (err, status) {
    //console.log(status + "\n");
    await checkDiff(status, function () {
      git('./modelt-az-report-repository').pull('origin', 'master', function (err, result) {
        if (err) console.log(err);
        console.log(result + "\n");
      });
    });
  });
});


// Check for data changes
MongoClient.connect(DB_CONN_STR, {useNewUrlParser: true, useUnifiedTopology: true}, function (err, db) {
  if (err) throw err;
  console.log("Database Connected! ---- TO GET DATA CHANGES\n");
  var dbo = db.db("sap-cx");
  var collection = dbo.collection("CCv2LongRunningDeployment");
  // Define change stream
  const changeStream = collection.watch();
  // start listen to changes
  changeStream.on("change", function (event) {
    // console.log(JSON.stringify(event));
    console.log(Date() + "\nGot Database change(s)!\n");
    io.emit('DBChange', {status: 'Got MongoDB change!'});
    //changeStream.close();
    //-----------NO db.close();-------------
  });
});

