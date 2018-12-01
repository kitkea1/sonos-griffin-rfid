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
// DATA ////////////////////////////////////////////////////////////////////////
////////////////////////////////////////////////////////////////////////////////
var uidLookup_json = '{"884654c":"After Laughter",' +
                      '"8844b94":"Woodstock"}';

var uidLookup = JSON.parse(uidLookup_json);

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
          var uidString = uid[0].toString(16) + uid[1].toString(16) + uid[2].toString(16) + uid[3].toString(16);

          console.log(uidString);
          console.log(uidLookup[uidString]);

          if(uidLookup[uidString]!=undefined) {
            rfidReady = false;
            powermate.setBrightness(255);

            player.coordinator.replaceWithFavorite(uidLookup[uidString])
                         .then(() => player.coordinator.play()
                         .then(function() {
                           console.log('Promise accepted, playing favorite')
                           rfidReady = true;
                           powermate.setBrightness(0);
                         }).catch(function() {
                           console.log("Promise rejected, could not play")
                         })).catch(function() {
                           rfidReady = true;
                           powermate.setBrightness(0);
                           console.log("Promise rejected, could not find favorite")
                         });
          }
        }
      }
    }
}, 25);

////////////////////////////////////////////////////////////////////////////////
// CALLED FUNCTIONS ////////////////////////////////////////////////////////////
////////////////////////////////////////////////////////////////////////////////

function isPlaying() {
    return player.coordinator.state.playbackState == "PLAYING";
}
