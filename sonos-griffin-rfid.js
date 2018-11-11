/*
* sonospowermate.js
* control a sonos speaker (or group that speaker belongs to)
* and monitor its play status with the led ring
*
*/
'use strict'

var SonosDiscovery = require('sonos-discovery'),
    discovery = new SonosDiscovery(),
    PowerMate = require('node-powermate'),
    powermate = new PowerMate(),
    download = require('url-download'),
    fs = require('fs'),
    path = require('path'),
    http = require('http'),
    util = require('util'),
    os = require('os');

// Get the LED strobing while we're discovering the Sonos topology
powermate.setPulseSpeed(511);
powermate.setPulseAwake(true);

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

// Get our ip addressand make sure our audio container directory exists
initialize();

// Wait until the Sonos discovery process is done, then grab our player
discovery.on('topology-change', function() {
    if (!player)
        grabPlayer();
})

discovery.on('transport-state', function(msg) {
    if (msg.uuid == player.coordinator.uuid) {
// And if we've paused, turn the LED off
        if (msg.state.zoneState == "PAUSED_PLAYBACK" || msg.state.zoneState == "STOPPED") powermate.setBrightness(0);
// Anf if we've played, turn the LED on
        else if (msg.state.zoneState == "PLAYING") powermate.setBrightness(255);
    }
});


var dblClickTimer;
var pressTimer;
var isDown = false;

powermate.on('wheelTurn', function(delta) {
    // This is a right turn
    if (delta > 0) {
        right('+1');
    }
    // Left
    if (delta < 0) {
        left('-1');
    }
});

// Our gesstures section
var commandReady = true;
var commandTimer;

// Turn up the group volume
function right(delta) {
    if (commandReady && isPlaying()) {
        commandReady = false;
        player.coordinator.groupSetVolume(delta);
        commandTimer = setTimeout(function() {
            commandReady = true;
        }, 25);
    }
}

// Turn down the group volume
function left(delta) {
    if (commandReady && isPlaying()) {
        commandReady = false;
        player.coordinator.groupSetVolume(delta);
        commandTimer = setTimeout(function() {
            commandReady = true;
        }, 25);
    }
}

function grabPlayer() {
    player = discovery.getPlayer('Kitchen');

    if (!player) return;

  //  grabFavorites();
    powermate.setPulseAwake(false);
// Figure out if our player is playing. If so, turn the LED on
    if (isPlaying()) {
        powermate.setBrightness(255);
// Otherwise turn it off
    } else {
        powermate.setBrightness(0);
    }
    faves = [];
    player.getFavorites(function(success, favorites) {
        if (!success) return;
        for (var i = 0; i < favorites.length; i++) {
            faves.push(favorites[i].title);
        }
//        getFaveAudio(0);
    });

}

function isPlaying() {
    return player.coordinator.state['currentState'] == "PLAYING";
}

// Replace the queue with the currently selected favorite (as determined by the index into the favorites array)
function playFavorite(index) {
    clearTimeout(favTimer);
    player.coordinator.replaceWithFavorite(faves[index], function(success) {
        if (success)
            player.coordinator.play();
        else {
            console.log('didnt find it');
        }
    });
}

// Grab text-to-speech audio for our favorites from voicerss.com
function getFaveAudio(index) {
    if (index == 0) deleteFavesAudio();
    if (!faves[index]) return;
    var link = voiceRssLink('put your key here', faves[index]);
    download(link, getUserHome() + '.sonospowermate/sound/', {outputName: index +'.mp3'})
        .on('close', function () {
            getFaveAudio(index + 1);
        })
        .on('invalid', function (e) {
            console.log('Bad URL: ' + e );
            getFaveAudio(index + 1);
        })
        .on('error', function (e) {
            console.log('Couldn\'t download: ' + e );
            getFaveAudio(index + 1);
        });
}

function voiceRssLink(key, text) {
    return('http://api.voicerss.org/?key=' + encodeURIComponent(key) + '&hl=en-us&f=16khz_8bit_mono&src=' + encodeURIComponent(text));
}

// Let's delete everything in the audio directory, because who know what happened while we weren't running,
// so we should start from scratch
function deleteFavesAudio() {
    fs.readdirSync(getUserHome() + ".sonospowermate/sound").forEach(function(fileName) {
        fs.unlinkSync(getUserHome() + ".sonospowermate/sound/" + fileName);
    });
}

function getUserHome() {
    return process.env[(process.platform === 'win32') ? 'USERPROFILE' : 'HOME'] + path.sep;
}

function enterFavorites() {
    resetFavTimer();
    favTurn(1);
    inFaves=true;
    powermate.setPulseSpeed(511);
    powermate.setPulseAwake(true);
    favURI=player.avTransportUri;
    favTrack=player.state.trackNo;

// Create the server that will listen for call from the Sonos, and server up the appropriate favorites
// audio file
    favServer=http.createServer(function(request, response) {
        var filePath = getUserHome()+'.sonospowermate/sound/'+request.url.replace('/','');
        if (fs.existsSync(filePath)) {
            var stat = fs.statSync(filePath);

            response.writeHead(200, {
                'Content-Type': 'audio/mpeg',
                'Content-Length': stat.size
            });

            var readStream = fs.createReadStream(filePath);
            readStream.pipe(response);
        }
        else {
            response.writeHead(200, {
                'Content-Type': 'audio/mpeg',
                'Content-Length': 0
            });
            response.end("");
        }
    })
    .listen(2000);

    favServer.on('error',function(msg){
        console.log(msg);
    });
}

function favTurn(delta) {
    resetFavTimer();
    if (canDelta && faves) favCounter += delta;
    if (favCounter > 10) {
        favCounter=0;
        favIndex++;
        if (favIndex > faves.length-1) favIndex=0;
    }
    else if (favCounter < -10) {
        favCounter=0
        favIndex--;
        if (favIndex < 0) favIndex=faves.length-1;
    }
    else return;
    canDelta=false;
    player.coordinator.setAVTransportURI('http://'+discovery.localEndpoint+':2000/'+favIndex+'.mp3','',function(success) {
        player.coordinator.play(function() {
            canDelta=true;
        });
    });
}

function resetFavTimer() {
    clearTimeout(favTimer);
    favTimer=setTimeout(exitFaves,15000);
}

function exitFaves() {
    player.setAVTransportURI(favURI,'',function(success) {
        player.seek(favTrack,function() {
            favServer.close(function() {
                clearTimeout(favTimer);
                powermate.setPulseAwake(false);
                inFaves=false;
                favCounter=20;
                favIndex=-1;
                favServer=null;
            });
        });
    });
}

function initialize() {

// See if our favorites sounds directory exists, and create it if it doesn't
    if (!fs.existsSync(getUserHome()+'.sonospowermate/sound')) {
        if (!fs.existsSync(getUserHome()+'.sonospowermate')) {
            fs.mkdir(getUserHome()+'.sonospowermate',function() {
                fs.mkdir(getUserHome()+'.sonospowermate/sound',function() {
                });
            });
        }
        else {
            fs.mkdir(getUserHome()+'.sonospowermate/sound',function() {

            });

        }
    }

}
