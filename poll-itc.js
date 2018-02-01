var poster = require('./post-update.js');
var dirty = require('dirty');
var db = dirty('kvstore.db');
var pollIntervalSeconds = 120
var debug = false

function checkAppStatus() {
	var result;
	result = process.env.bundle_ids.split("|"); 
	console.log(result)
	var index;
	for (index = 0; index < result.length; ++index) {
		var appleIDPlusBundle_id = result[index]
		var arr = appleIDPlusBundle_id.split("=");
		var appleID = arr[0]
		var bundle_id = arr[1]

		//invoke ruby script to grab latest app status
		var exec = require("child_process").exec;
		var command = 'ruby get-app-status.rb'+' '+appleID+' '+bundle_id
		console.log("Fetching latest app status: "+bundle_id)
		exec(command, function (err, stdout, stderr) {
			if (stdout) {
				// compare new app info with last one (from database)
				var versions = JSON.parse(stdout);
				
				// use the live version if edit version is unavailable
				var currentAppInfo = versions["editVersion"] ? versions["editVersion"] : versions["liveVersion"];

				var appId = currentAppInfo.appId
				console.log(appId+"------------------------------");

				var lastAppInfo = db.get('appInfo_'+appId);

				if (!lastAppInfo || lastAppInfo.status != currentAppInfo.status || debug) {
					console.log(appId+": "+"New status");
					poster.slack(currentAppInfo, db.get('submissionStart_'+appId));

					// store submission start time
					if (currentAppInfo.status == "Waiting For Review") {
						db.set('submissionStart_'+appId, new Date());
					}
				}
				else if (currentAppInfo) {
					console.log(appId+": "+`Current status \"${currentAppInfo.status}\" matches previous status`);
				}
				else {
					console.log(appId+": "+"Could not fetch app status");
				}

				// store latest app info in database
				db.set('appInfo_'+appId, currentAppInfo);
			}
			else {
				console.log("There was a problem fetching the status of the app!");
			}
		});
	}

	
}

setInterval(checkAppStatus, pollIntervalSeconds * 1000);
checkAppStatus();
