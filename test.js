const fs = require("fs");
const USER = 'I314119';
const PASS = '339f7a55781e7d54e99752f3f2a82d3f91a9aa96';
const FOLDER = 'modelt-az-report-repository';
const REPO = 'github.tools.sap/c4core-sre/';
const git = require('simple-git/promise');
const remote = `https://${USER}:${PASS}@${REPO}${FOLDER}`;

function printFile(file){
  fs.readFile('./modelt-az-report-repository/'+file, function(err, data) {
    console.log('checkout '+file);
    console.log(data.toString('utf8'));
  });
}

function checkDiff(diffSummary) {
  for (var i = 0, len = diffSummary.files.length; i < len; i++) {
    if(diffSummary.files[i].file.includes("hourly") && diffSummary.files[i].file.includes("select-22.csv")){
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
        ]).then(() => printFile(f))
        .catch((err) => console.error('failed: ', err));
    }  
  }          
}
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
