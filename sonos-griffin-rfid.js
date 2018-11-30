/*
* sonospowermate.js
* control a sonos speaker (or group that speaker belongs to)
* and monitor its play status with the led ring
*
*/
'use strict'

// REQUIRED NODE MODULES
var SonosDiscovery = require('sonos-discovery');
var PowerMate      = require('node-powermate');
var download       = require('url-download');
var fs             = require('fs');
var path           = require('path');
var http           = require('http');
var util           = require('util');
var os             = require('os');


// SONOS and GRIFFIN POWERMATE OBJECTS
var discovery = new SonosDiscovery();
var powermate = new PowerMate();

// SET BRIGHTNESS OF POWERMATE
powermate.setBrightness(0);

var faves;
var favIndex=-1;
var favCounter=20;
var canDelta=true;
var favServer;
var inFaves=false;
var canDelta=true;
var favTimer;
var favURI;
var favTrack;
var player;

// DISCOVER PLAYER
discovery.on('topology-change', function() {
    if (!player) {
      player = discovery.getPlayer('Kitchen');
    }
})

// COMMAND VARIABLES
var commandReady = true;
var commandTimer;

// VOLUME CONTROL
powermate.on('wheelTurn', function(delta) {
    if (commandReady && isPlaying()) {
      commandReady = false;
      // Clockwise (right turn)
      if (delta > 0) {
        player.coordinator.groupSetVolume('+1');
      }
      // Counterclockwise (left turn)
      if (delta < 0) {
        player.coordinator.groupSetVolume('-1');
      }
      // Sets delay before next turn is accounted for
      commandTimer = setTimeout(function() {
          commandReady = true;
      }, 25);
    }
});

function isPlaying() {
    return player.coordinator.state['currentState'] == "PLAYING";
}
