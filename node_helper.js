/*
Provided under the MIT License.

Copyright (c) 2017 Matthias Steinkogler

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

var _breakOffFirstLine = /\r?\n/;
function filterStdoutDataDumpsToTextLines(callback) {
  var acc = "";
  return function (data) {
    var splitted = data.toString().split(_breakOffFirstLine);
    var inTactLines = splitted.slice(0, splitted.length - 1);

    inTactLines[0] = acc + inTactLines[0]; //if there was a partial, unended line in the previous dump, it is completed by the first section.

    acc = splitted[splitted.length - 1]; //if there is a partial, unended line in this dump, store it to be completed by the next (we assume there will be a terminating newline at some point. This is, generally, a safe assumption.)
    for (var i = 0; i < inTactLines.length; ++i) {
      callback(inTactLines[i]);
    }
  };
}

module.exports = NodeHelper.create({
  start: function () {
    var self = this;
    try {
      console.log("MMM-updateFromStdOut helper started...");

      var timeoutId = null;

      var rtl_433 = spawn(
        "/usr/local/bin/rtl_433",
        // ["-R", "12", "-F", "json"],
        ["-F", "json"],
        {
          detached: true,
          shell: true
        }
      );

      console.debug("Spawned Process");

      rtl_433.stdout.on("data", (data) => {
        console.log(data.toString());
      });

      rtl_433.stderr.on("data", (data) => {
        console.log("err" + data.toString());
      });

      rtl_433.stdout.on(
        "data",
        filterStdoutDataDumpsToTextLines((line) => {
          //each time this inner function is called, you will be getting a single, complete line of the stdout ^^

          if (timeoutId !== null) {
            clearTimeout(timeoutId);
          }

          // If we haven't received information from the sensor for the timeout,
          // the battery is probably empty.
          timeoutId = setTimeout(function () {
            self.sendSocketNotification("DATA-MMM-updateFromStdOut", {
              temp: "--",
              humidity: "--",
              battery: "empty"
            });
            return;
          }, 6 * 60 * 60 * 1000); // 6 hours

          var dataObject = JSON.parse(line.toString());
          console.log(dataObject);
          this.temperature = dataObject["temperature_C"] || this.temperature;
          this.humidity = dataObject["humidity"] || this.humidity;

          self.sendSocketNotification("DATA-MMM-updateFromStdOut", {
            temp: this.temperature,
            humidity: this.humidity
          });
        })
      );

      rtl_433.stdout.on("end", function () {
        console.log("Process ended");
      });
      rtl_433.stdout.on("close", function () {
        console.log("Process ended");
      });

      rtl_433.on("exit", (code) => {
        console.log("Process ended");
      });
    } catch (err) {
      console.log(err);
    }
  },

  socketNotificationReceived: function (notification, payload) {
    // we receive this notification upon startup of the module, then we can respond.
  }
});
