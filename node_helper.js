/*
Provided under the MIT License.

Copyright (c) 2017 Matthias Steinkogler
Copyright (c) 2021 Daniel Habenicht

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
*/

"use strict";

const NodeHelper = require("node_helper");
const spawn = require("child_process").spawn;
const readline = require("readline");
const logPrefix = "[MMM-updateFromStdOut]";
const jsonata = require('jsonata');
var global_lock = false;
var config = {};


var _breakOffFirstLine = /\r?\n/;
function filterStdoutDataDumpsToTextLines(callback) {
  var acc = "";
  return function (data) {
    console.log(logPrefix + "Out:" + data);
    var splitted = data.toString().split(_breakOffFirstLine);
    var inTactLines = splitted.slice(0, splitted.length - 1);

    inTactLines[0] = acc + inTactLines[0]; //if there was a partial, unended line in the previous dump, it is completed by the first section.

    acc = splitted[splitted.length - 1]; //if there is a partial, unended line in this dump, store it to be completed by the next (we assume there will be a terminating newline at some point. This is, generally, a safe assumption.)
    for (var i = 0; i < inTactLines.length; ++i) {
      callback(inTactLines[i]);
    }
  };
}

function startRTL_Monitor(self) {
	if (global_lock){
		return
	}
	global_lock = true
  var timeoutId = null;
  if (self.read_back == true) {
    self.process_restart_time = self.process_restart_time * 2;
  } else {
    self.process_restart_time = 60;
  }
  if (
    self.read_back == false &&
    self.process_restart_time > 3 * 60 * 60 * 1000
  ) {
    // 3 hours
    self.sendSocketNotification("DATA-MMM-updateFromStdOut", {
      temp: "--",
      humidity: "--",
      battery: "empty"
    });
  }
  self.read_back = false;
  console.log(logPrefix + "Time: " + self.process_restart_time);

  if (config.executable != undefined) {

	  var rtl_433 = spawn(
		  config.command,
		  // ["-R", "12", "-F", "json"],
		  // T Option Needed because of https://github.com/merbanan/rtl_433/issues/1669
		  config.arguments,
		  // ||     ["-T", self.process_restart_time, "-F", "json"],
		  {
			  detached: true,
			  shell: true
			}
		);
  }else{
	var rtl_433 = spawn(
		"powershell.exe",
		["-Command", config.command],
		{
			// detached: true,
			shell: true
		  }
	  );
  }

  console.log("Spawned Process");

  rtl_433.stdout.on("data", (data) => {
    console.log(logPrefix + data.toString());
  });

  rtl_433.stderr.on("data", (data) => {
    console.log(logPrefix + "Error: " + data.toString());
  });

  rtl_433.stdout.on(
    "data",
    filterStdoutDataDumpsToTextLines((line) => {
      self.read_back = true;
      // each time this inner function is called, you will be getting a single,
	  // complete line of the stdout, which should be a JSON object

      if (timeoutId !== null) {
        clearTimeout(timeoutId);
      }

      var dataObject = JSON.parse(line.toString());
      console.log(logPrefix + "Object:" + line.toString());

	  config.values.forEach(async (configElement, index) => {
		  // Filter
		  const expression = jsonata(configElement.filter);
		  const result = await expression.evaluate(dataObject);
		  console.log(logPrefix + "Filter " + configElement.filter + " = " + result)
		  if (result) {
			  console.log(logPrefix + "Filter: " + result);

			  const valueExpression = jsonata(configElement.query);
			  const valueResult = await valueExpression.evaluate(dataObject);
			  console.log(logPrefix + "Query " + configElement.query + " = " + valueResult)


			  self.sendSocketNotification("DATA-MMM-updateFromStdOut", {
				index: index,
				value: valueResult
			  });
		  }
	  });
    })
  );

  rtl_433.stdout.on("close", function () {
    console.log(logPrefix + "Process ended");
  });

  rtl_433.on("exit", (code) => {
    startRTL_Monitor(self);
    console.log(logPrefix + "Process ended");
  });
}

module.exports = NodeHelper.create({
  start: function () {
	},

	socketNotificationReceived: function (notification, payload) {
		config = payload.config
		console.log(config)

		var self = this;
		// Time for rtl process timeout
		self.process_restart_time = 60;
		// Whether something was read back during the last timeout
		self.read_back = false;

		console.log("MMM-updateFromStdOut helper started...");
		startRTL_Monitor(self);
  }
});
