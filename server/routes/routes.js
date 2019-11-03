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

module.exports = router;
