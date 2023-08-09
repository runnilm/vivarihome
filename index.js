const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const pathfav = require('path');
const five = require('johnny-five');
const board = new five.Board({ 
    port: "/dev/serial/by-id/usb-Arduino__www.arduino.cc__0042_551313238373518051A2-if00",
    repl: false 
});

const favicon = require('serve-favicon');

const app = express();
const server = require('http').createServer(app);
const io = require('socket.io')(server);
const path = '/home/vivarihome/vivarihome/build/';
console.log(__dirname);
var corsOptions = {
    origin: "http://localhost:8080"
};

const ip = require('ip');
const PORT = 3030;
//const serverIP = `${ip.address()}:${PORT}`

const timestamp = require('log-timestamp');
const readline = require('readline');

const nodemailer = require('nodemailer');
const { setInterval } = require('timers');
var transporter = nodemailer.createTransport({
    service: 'outlook',
    auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS
    }
});

var misterToggleText = {
    from: process.env.SMTP_USER,
    to: process.env.SMTP_RECEIVER,
    subject: 'Mister Alert',
    text: 'The misting pump has been turned on.'
};
var uvToggleText = {
    from: process.env.SMTP_USER,
    to: process.env.SMTP_RECEIVER,
    subject: 'UVB Alert',
    text: 'The UVB light has been turned on.'
};
var baskingToggleText = {
    from: process.env.SMTP_USER,
    to: process.env.SMTP_RECEIVER,
    subject: 'Basking Alert',
    text: 'The basking light has been turned on.'
};
var cheToggleText = {
    from: process.env.SMTP_USER,
    to: process.env.SMTP_RECEIVER,
    subject: 'CHE Alert',
    text: 'The CHE has been turned on.'
};
var ledToggleText = {
    from: process.env.SMTP_USER,
    to: process.env.SMTP_RECEIVER,
    subject: 'LED Alert',
    text: 'The LED has been turned on.'
};

var numPOST = 0;
var timeDiff = 0;
var currentPOSTTime;
var lastPOSTTime;
var timeAvg = 0;
var timeMin = 0;
var timeMax = 0;
var timeTotal = 0;

var temp3 = 0, temp4 = 0, temp5 = 0,
    dhtHum = 0, mistLevel = 0, mistPercent = 0,
    leftDoorState, rightDoorState, 
    leftDoor, rightDoor, doorsOpen;

var isRefreshing = false;

var uvValue,
    misterValue,
    baskingValue,
    cheValue,
    ledValue;

var Data = {
    temp3: temp3,
    temp4: temp4,
    temp5: temp5,
    dhtHum: dhtHum,
    mistLevel: mistLevel,
    doorsOpen: doorsOpen
}

var RelayStates = {
    uvValue: uvValue,
    misterValue: misterValue,
    baskingValue: baskingValue,
    cheValue: cheValue,
    ledValue: ledValue
}

board.on('ready', function () {
    // 8-channel relay
    const uvRelay       = new five.Relay(53);  // uv light
    const misterRelay   = new five.Relay(51);  // misting pump
    const baskingRelay  = new five.Relay(49);  // basking lamp
    const cheRelay      = new five.Relay(47);  // ceramic heat emitter
    const ledRelay      = new five.Relay(45);  // led grow light

    // boot with relays off (active low)
    uvRelay.open(); // close() == OFF, open() == ON
    misterRelay.open(); // UNTIL NPN TRANSISTOR IS FIXED
    baskingRelay.open();
    cheRelay.open();
    ledRelay.open();

    uvValue         = false;
    misterValue     = false;
    baskingValue    = false;
    cheValue        = false;
    ledValue        = false;

    io.on('connection', function (socket) {
        process.stdout.cursorTo(0, 9);
        process.stdout.clearLine(0);
        process.stdout.write('Client connected... @' + new Date());

        console.log('A user connected.');
        socket.on('disconnect', () => {
            console.log('A user disconnected.');
        });

        socket.on('toggleUV', function() {
            uvRelay.toggle();
            uvValue = !uvValue;

            /* if (uvValue) {
                transporter.sendMail(uvToggleText, function(error, info) {
                    if (error) {
                        console.log('sendmail' + error);
                    } else {
                        console.log('Email sent: ' + info.response);
                    }
                });
            } */
        });

        socket.on('toggleMister', function() {
            if (!doorsOpen) {
                misterRelay.toggle();
                misterValue = !misterValue;
    
                /* if (misterValue) {
                    transporter.sendMail(misterToggleText, function(error, info) {
                        if (error) {
                            console.log('sendmail' + error);
                        } else {
                            console.log('Email sent: ' + info.response);
                        }
                    });
                } */
            }
        });

        socket.on('toggleBasking', function (value) {
            baskingRelay.toggle();
            baskingValue = !baskingValue;

            /* if (baskingValue) {
                transporter.sendMail(baskingToggleText, function(error, info) {
                    if (error) {
                        console.log('sendmail' + error);
                    } else {
                        console.log('Email sent: ' + info.response);
                    }
                });
            } */
        })

        socket.on('toggleCHE', function (value) {
            cheRelay.toggle();
            cheValue = !cheValue;

            /* if (cheValue) {
                transporter.sendMail(cheToggleText, function(error, info) {
                    if (error) {
                        console.log('sendmail' + error);
                    } else {
                        console.log('Email sent: ' + info.response);
                    }
                });
            } */
        })

        socket.on('toggleLED', function() {
            ledRelay.toggle();
            ledValue = !ledValue;

            /* if (ledValue) {
                transporter.sendMail(ledToggleText, function(error, info) {
                    if (error) {
                        console.log('sendmail' + error);
                    } else {
                        console.log('Email sent: ' + info.response);
                    }
                });
            } */
        });

        socket.on('refreshData', function() {
            socket.emit('uvValue', uvValue);
            socket.emit('misterValue', misterValue);
            socket.emit('baskingValue', baskingValue);
            socket.emit('cheValue', cheValue);
            socket.emit('ledValue', ledValue);
        
            socket.emit('temp3', temp3); // cool
            socket.emit('temp4', temp4); // basking
            socket.emit('temp5', temp5); // hot
            socket.emit('dhtHum', dhtHum);
            socket.emit('mistPercent', mistPercent);
            socket.emit('doorsOpen', doorsOpen);
        });
    });

    app.use(express.static(path));
    app.use(cors(corsOptions));
    app.use(bodyParser.urlencoded({ extended: true }));
    
    //app.use('/css', express.static(path.join(__dirname, 'public/css')));
    app.use(favicon(pathfav.join(__dirname, 'public', 'images', 'reptile.ico')));

    app.get('/', function (req, res) {
        res.sendFile('/home/vivarihome/vivarihome/public/index.html');
    });

    app.get('*', function (req, res) {
        res.sendFile('/home/vivarihome/vivarihome/public/index.html');
    });

    /* app.get('/', (req, res, next) => {
        res.render('index.pug', { temp3: temp3, temp4: temp4, temp5: temp5, 
                                dhtHum: dhtHum, leftDoor: leftDoor, 
                                rightDoor: rightDoor, mistLevel: mistLevel });
        next();
    }); */

    app.post('/temperatures', (req, res, next) => {
        getTime();

        let body = JSON.parse(JSON.stringify(req.body));
        let reading = {
            date: new Date(),
            //temp1: body.temp1,
            //temp2: body.temp2,
            temp3: body.temp3,
            temp4: body.temp4,
            temp5: body.temp5,
            dhtHum: body.dhtHum,
            dhtTemp: body.dhtTemp,
            leftDoorState: body.leftDoorState,
            rightDoorState: body.rightDoorState,
            mistLevel: body.mistLevel,
        }

        //temp1 = reading.temp1;
        //temp2 = reading.temp2;
        temp3 = reading.temp3;
        temp4 = reading.temp4;
        temp5 = reading.temp5;
        dhtHum = reading.dhtHum;
        dhtTemp = reading.dhtTemp;
        mistLevel = reading.mistLevel;

        leftDoorState = reading.leftDoorState;
            if (leftDoorState == 0) {
                leftDoor = 'closed';
            } else if (leftDoorState == 1) {
                leftDoor = 'open';
            }
            
        rightDoorState = reading.rightDoorState;
            if (rightDoorState == 0) {
                rightDoor = 'closed';
            } else if (rightDoorState == 1) {
                rightDoor = 'open';
            }
        
        if (leftDoorState == 1 || rightDoorState == 1) {
            doorsOpen = true;
        } else {
            doorsOpen = false;
        }

        mistPercent = (100 - ((mistLevel/13)*100)).toFixed(1);
        if (mistPercent > 100) {
            mistPercent = 100;
        }

        if (mistPercent < 0) {
            mistPercent = 0;
        }

        console.log('temp3:'+temp3+'     '); // COOL SIDE
        console.log('temp4:'+temp4+'     '); // BASKING AREA
        console.log('temp5:'+temp5+'     '); // HOT SIDE
        console.log('dhtHum:'+dhtHum+'     ');
        console.log('dhtTemp:'+dhtTemp+'     ');
        console.log('mistLevel:'+mistLevel+'     ');
        console.log('mistPercent:'+mistPercent+'     ');
        console.log('rightDoor:'+rightDoorState+'     ');
        console.log('leftDoor:'+leftDoorState+'     ');
        console.log('doorsOpen:'+doorsOpen+'     ');

        res.sendStatus(200); // send 'OK' ***CAUSES ERROR***
        next();
    });
});

server.listen(process.env.PORT || 3030, () => {
    //console.log(`listening on ${serverIP}`);
    console.log(`listening on *:${process.env.PORT || 3030}`);
});

function nFormatter(num) {
    const lookup = [
        { value: 1, symbol: '' },
        { value: 1e3, symbol: 'k' },
        { value: 1e6, symbol: 'M' },
        { value: 1e9, symbol: 'G' }
    ];
    const rx = /\.0+$|(\.[0-9])0+$/;
    var item = lookup.slice().reverse().find(function(item) {
        return num >= item.value;
    });
    return item ? (num / item.value).toFixed(1).replace(rx, '$1') + item.symbol : '0';
}

function getTime() {
    if (numPOST == 0) {
        lastPOSTTime = currentPOSTTime = performance.now();
    } else {
        lastPOSTTime = currentPOSTTime;
        currentPOSTTime = performance.now();
        timeDiff = ((currentPOSTTime - lastPOSTTime) / 1000);

        if (timeDiff > timeMax) {
            timeMax = timeDiff;
        }

        if (numPOST == 1) {
            timeMin = timeDiff;
        }

        if (timeDiff < timeMin && numPOST >= 1) {
            timeMin = timeDiff;
        }

        timeTotal += timeDiff;
        timeAvg = timeTotal / numPOST;
    }

    readline.cursorTo(process.stdout, 0, 4);
    process.stdout.clearLine(0);
    process.stdout.write('Received POST req.' + nFormatter(numPOST));
    process.stdout.cursorTo(0, 5);
    process.stdout.clearLine(0);
    process.stdout.write('\tET:  ' + timeDiff.toFixed(3) + 's');
    process.stdout.cursorTo(0, 6);
    process.stdout.clearLine(0);
    process.stdout.write('\tAvg: ' + timeAvg.toFixed(3) + 's');
    process.stdout.cursorTo(0, 7);
    process.stdout.clearLine(0);
    process.stdout.write('\tMax: ' + timeMax.toFixed(3) + 's');
    process.stdout.cursorTo(0, 8);
    process.stdout.clearLine(0);
    process.stdout.write('\tMin: ' + timeMin.toFixed(3) + 's');
    process.stdout.cursorTo(0, 9);
    process.stdout.clearLine(0);
    process.stdout.write('Uptime: ' + (timeTotal/3600).toFixed(3) + 'h');

    process.stdout.cursorTo(0, 11);

    numPOST++;
}