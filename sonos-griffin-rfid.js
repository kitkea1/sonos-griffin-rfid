/*
* sonos-griffin-rfid.js
*
*/
'use strict'

////////////////////////////////////////////////////////////////////////////////
// GLOBAL VARIABLES ////////////////////////////////////////////////////////////
////////////////////////////////////////////////////////////////////////////////

// REQUIRED NODE MODULES
var SonosDiscovery = require('sonos-discovery');
var PowerMate      = require('node-powermate');

// SONOS OBJECTS AND STARTUP SETTINGS
var discovery = new SonosDiscovery();
var player; // to be setup using topology-change function

// GRIFFEN POWERMATE AND STARTUP SETTINGS
var powermate = new PowerMate();
powermate.setBrightness(0);

// COMMAND VARIABLES
var eventReady = true;
var eventTimer;


////////////////////////////////////////////////////////////////////////////////
// EVENTS //////////////////////////////////////////////////////////////////////
////////////////////////////////////////////////////////////////////////////////

// SONOS EVENTS
discovery.on('topology-change', function() {
    if (!player) {
      player = discovery.getPlayer('Kitchen');
    }
})

// VOLUME EVENTS
powermate.on('wheelTurn', function(delta) {
    if (eventReady && !!player && isPlaying()) {
      eventReady = false;
      // Clockwise (right turn)
      if (delta > 0) {
          player.coordinator.groupSetVolume('+1');
      }
      // Counterclockwise (left turn)
      if (delta < 0) {
          player.coordinator.groupSetVolume('-1');
      }
      // Sets delay before next turn is accounted for
      eventTimer = setTimeout(function() {
          eventReady = true;
      }, 25);
    }
});

// RFID EVENTS



////////////////////////////////////////////////////////////////////////////////
// CALLED FUNCTIONS ////////////////////////////////////////////////////////////
////////////////////////////////////////////////////////////////////////////////

function isPlaying() {
    return player.coordinator.state['currentState'] == "PLAYING";
}
