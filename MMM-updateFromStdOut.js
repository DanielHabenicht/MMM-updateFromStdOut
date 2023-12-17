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

Module.register("MMM-updateFromStdOut", {
  // Default module config.
  defaults: {},

  start: function () {
    Log.info("Starting module: " + this.name);

    this.loaded = false;
	this.values = {}
    this.battery = "";

    // initialize socket communication with node_helper so it can send us information.
    this.sendSocketNotification("REQUEST-MMM-updateFromStdOut", {
		config: this.config
	});
  },

  getDom: function () {
    var wrapper = document.createElement("div");
      wrapper.className = "bright large light mmm-updatefromstdout";

    if (!this.loaded) {
      wrapper.innerHTML = "Loading...";
      wrapper.className = "dimmed light small";
      return wrapper;
    }

    var div = document.createElement("div");

    if (this.battery === "empty") {
      div.innerHTML +=
        "<i aria-hidden='true' class='fa fa-battery-empty' style='color: red'></i>";
      wrapper.appendChild(div);
    } else {
		this.config.values.forEach((element, index) => {
			div.innerHTML += "<div>"
			div.innerHTML += "<i aria-hidden='true' class='fa " + element.icon + "'></i>&nbsp;";
			div.innerHTML += element.title + ":&nbsp;";
			div.innerHTML += "<span class='bold'>" + this.values[index] + "</span>" + element.suffix + "&nbsp;";
			div.innerHTML += "</div>"
		});
      wrapper.appendChild(div);
    }

    return wrapper;
  },

  socketNotificationReceived: function (notification, payload) {
    if (notification === "DATA-MMM-updateFromStdOut") {
	  this.values[payload.index] = payload.value;
      this.battery = payload.battery;

      this.loaded = 1;

      this.updateDom();
    }
  }
});
