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
var uidMap_json = '{"884654c":"Play/Pause",' +
                   '"8848484":"Mute",' +
                   '"884654c":"After Laughter",' +
                   '"8844b94":"Woodstock"}';

var uidMap = JSON.parse(uidMap_json);


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

      if (player.coordinator.state.mute) {
          player.coordinator.unMuteGroup();
      } else {
        // Clockwise (right turn)
        if (delta > 0) {
          player.coordinator.setGroupVolume('+1');
        }
        // Counterclockwise (left turn)
        if (delta < 0) {
          player.coordinator.setGroupVolume('-1');
        }
      }
      // Sets delay before next turn is accounted for
      volumeTimer = setTimeout(function() {
          volumeReady = true;
      }, 25);
    }
});

// RFID EVENTS
setInterval(function(){
    if (rfidReady && !!player) {
      let response = mfrc522.findCard();  // scans for cards
      if (!!response.status) {            // if card is detected
        response = mfrc522.getUid();      // get uid of card detected
        if (!!response.status) {          // if uid is valid
          var uidResponse = response.data;        // get uid
          var uid = uidResponse[0].toString(16) + uidResponse[1].toString(16) + uidResponse[2].toString(16) + uidResponse[3].toString(16);

          rfidReady = false;
          powermate.setBrightness(255);

          console.log(uid);
          console.log(uidMap[uid]);

          switch (uidMap[uid]) {
            case undefined:

              break;

            case "Play/Pause":
              //player.coordinator.
              break;

            case "Mute":
              player.coordinator.muteGroup();
              rfidReady = true;
              powermate.setBrightness(0);
              break;

            // if its not an action or is undefined, must be a favorite
            default:
              player.coordinator.replaceWithFavorite(uidMap[uid])
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
