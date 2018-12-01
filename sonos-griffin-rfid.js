/*
* sonos-griffin-rfid.js
*
*/
'use strict'

////////////////////////////////////////////////////////////////////////////////
// GLOBAL VARIABLES ////////////////////////////////////////////////////////////
////////////////////////////////////////////////////////////////////////////////

// REQUIRED NODE MODULES
var SonosDiscovery = require('node-sonos-discovery');
var PowerMate      = require('node-powermate');
var mfrc522        = require("mfrc522-rpi");

// SONOS OBJECTS AND STARTUP SETTINGS
var discovery = new SonosDiscovery();
var player; // to be setup using topology-change function

// GRIFFIN POWERMATE AND STARTUP SETTINGS
var powermate = new PowerMate();
powermate.setBrightness(0);

// RFID READER STARTUP SETTINGS
mfrc522.initWiringPi(0); // Init WiringPi with SPI Channel 0
mfrc522.reset(); // resets card

// EVENT VARIABLES
var volumeReady = true;
var volumeTimer;
var rfidReady = true;
var rfidTimer;


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
    if (volumeReady && !!player && isPlaying()) {
      volumeReady = false;
      // Clockwise (right turn)
      if (delta > 0) {
        player.coordinator.setGroupVolume('+1');
      }
      // Counterclockwise (left turn)
      if (delta < 0) {
        player.coordinator.setGroupVolume('-1');
      }
      // Sets delay before next turn is accounted for
      volumeTimer = setTimeout(function() {
          volumeReady = true;
      }, 25);
    }
});

// RFID EVENTS
setInterval(function(){
    if (rfidReady) {
      let response = mfrc522.findCard();  // scans for cards
      if (!!response.status) {            // if card is detected
        response = mfrc522.getUid();      // get uid of card detected
        if (!!response.status) {          // if uid is valid
          var uid = response.data;        // get uid
          console.log("Card read UID: %s %s %s %s", uid[0].toString(16), uid[1].toString(16), uid[2].toString(16), uid[3].toString(16));

          playFavorite();

          // If a successful play
          rfidReady = false;
          powermate.setBrightness(255);
          // Sets delay before next scan
          rfidTimer = setTimeout(function() {
              rfidReady = true;
              powermate.setBrightness(0);
          }, 250);
        }
      }
    }
}, 25);

////////////////////////////////////////////////////////////////////////////////
// CALLED FUNCTIONS ////////////////////////////////////////////////////////////
////////////////////////////////////////////////////////////////////////////////

function isPlaying() {
    return player.coordinator.state['playbackState'] == "PLAYING";
}

function playFavorite() {
  return player.coordinator.replaceWithFavorite('After Laughter')
               .then(() => player.coordinator.play());
}
