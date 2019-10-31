const express = require("express");
const router  = express.Router();
const MongoClient = require('mongodb').MongoClient;
const DB_CONN_STR = "mongodb://localhost:27017/sap-cx";

router.get('/', (req, res) => {
  res.send('It works!');
});

router.get('/posts', (req, res) => {
  // Get initial data collection
  MongoClient.connect(DB_CONN_STR, {useNewUrlParser: true, useUnifiedTopology: true}, function (err, db) {
    if (err) {res.status(500).send(err);}
    console.log("Database Connected! ---- TO GET ALL DATA AS JSON");
    var dbo = db.db("sap-cx");
    var collection = dbo.collection("FileChanges");
    collection.find({}).toArray(async function(err, result) {
      if (err) throw err;
      //console.log(result);
      await res.status(200).json(result);
      db.close();
    });
  });
});

router.get('/changes', (req, res) => {
  // Check for data changes
  MongoClient.connect(DB_CONN_STR, {useNewUrlParser: true, useUnifiedTopology: true}, function (err, db) {
    if (err) {res.status(500).send(err);}
    console.log("Database Connected! ---- TO GET DATA CHANGES");
    var dbo = db.db("sap-cx");
    var collection = dbo.collection("FileChanges");
    // Define change stream
    const changeStream = collection.watch();
    // start listen to changes
    changeStream.on("change", async function (event) {
      // console.log(JSON.stringify(event));
      // Refresh web page to get updated data collection
      await res.status(200).json([{'msg': '1'}]);
      changeStream.close();
      //-----------NO db.close();-------------
    });
  });
});

module.exports = router;
