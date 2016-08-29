'use strict';

var util = require('util'),
    crypto = require('crypto'),
    debug = require('debug'),
    MqttNode = require('./index');

// set up debuggers
var CON = debug('con'),
    REG = debug('reg'),
    RAW = debug('raw'),
    MSG = debug('msg'),
    PUB = debug('pub'),
    TASK = debug('task'),
    ERR = debug('err');

/*************************************************************************************************/
/*** Prepare the Client Node                                                                   ***/
/*************************************************************************************************/
var devAttrs = {
    lifetime: 2000,
    version: '1.0.2',
    ip: '192.168.1.104',
    mac: '00:0c:29:71:74:ff'
};

var qnode = new MqttNode('test_node_01', devAttrs);


/*********************************************/
/*** Prepare Resources on the Client Node  ***/
/*********************************************/
var x = 0;
qnode.initResrc('temperature', 0, {
    sensorValue: 1200,
    units: 'mCel',
    minMeaValue: 10,
    maxMeaValue: 2000,
    minRangeValue: 0,
    maxRangeValue: 4000,
    some1: {
        exec: function (name, cb) { 
            console.log('hello ' + name);
            cb(null, 'exec world');
        }
    },
    some2: {
        write: function (val, cb) {
            x = val;
            console.log('write~~~~');
            console.log(x);
            cb(null, x);
        }
    },
    some3: {
        read: function (cb) { cb(null, 'hello'); }
    }
});

/*************************************************************************************************/
/*** Client Node Listeners                                                                     ***/
/*************************************************************************************************/
/*********************************************/
/*** Fundamental Events                    ***/
/*********************************************/
qnode.on('connect', function () {
    CON('connect');
});

qnode.on('reconnect', function () {
    CON('reconnect');
});

qnode.on('offline', function () {
    CON('offline');
});

qnode.on('close', function () {
    CON('close');
});

qnode.on('error', function (err) {
    ERR(err);
});

/*********************************************/
/*** TRX Message Events                    ***/
/*********************************************/
qnode.on('raw', function (topic, message, packet) {
    RAW('topic: ' + topic + ', msg: ' + message.toString());
});

qnode.on('message', function (topic, message, packet) {
    MSG('topic: ' + topic + ', msg: ' + message.toString());
});

qnode.on('published', function (msg) {
    PUB('topic: ' + msg.topic + ', msg: ' + msg.message.toString());
});

/*********************************************/
/*** Registered Events                     ***/
/*********************************************/
qnode.on('registered', function (rsp) {
    REG('registered: ');
    REG(rsp);

    runTask(readTemp, { interval: 1000, repeat: 1 });
    runTask(writeTemp, { interval: 5000, repeat: 1 });

});

qnode.on('request', function (msg) {
    // console.log(msg);
});

qnode.on('announce', function (msg) {
    console.log('announcexxxxxxxxxxx');
    console.log(msg);
});


qnode.connect('mqtt://localhost', {
    username: 'freebird',
    password: 'skynyrd',
    reconnectPeriod: 5000
});



/*************************************************************************************************/
/*** Testing Tasks                                                                             ***/
/*************************************************************************************************/
function readTemp() {
    qnode.readResrc('temperature', 0, 'sensorValue', function (err, val) {
        TASK('READ >> read: ' + val + ', sensorValue: ' + qnode.so.temperature[0].sensorValue);
    });
}

function writeTemp() {
    var v = Math.floor((Math.random() * 100) + 1),
        x = Math.floor((Math.random() * 100) + 1);
    qnode.writeResrc('temperature', 0, 'sensorValue', v, function (err, val) {
        TASK('WRITE >> write: ' + val + ', sensorValue: ' + qnode.so.temperature[0].sensorValue);
    });


    qnode.writeResrc('temperature', 0, 'minRangeValue', x, function (err, val) {
        TASK('WRITE >> write: ' + val + ', minRangeValue: ' + qnode.so.temperature[0].sensorValue);
    });
}
/*************************************************************************************************/
/*** Test Task Runner                                                                          ***/
/*************************************************************************************************/
function runTask(task, opt) {
    // opt = { interval: x, repeat: y }
    var runType = 'NORMAL',
        counter = 0,
        tHandle;

    if (opt.interval !== undefined) {
        if (opt.repeat === 0)
            runType = 'TIMEOUT';
        else if (opt.repeat === 1)
            runType = 'REPEAT';
        else if (opt.repeat > 1)
            runType = 'COUNTS';
        else
            runType = 'TIMEOUT';
    }

    switch (runType) {
        case 'NORMAL':
            task();
            tHandle = {};
            break;
        case 'TIMEOUT':
            tHandle = setTimeout(task, opt.interval);
            break;
        case 'REPEAT':
            tHandle = setInterval(task, opt.interval);
            break;
        case 'COUNTS':
            tHandle = setInterval(function () {
                task();
                counter += 1;
                if (counter === opt.repeat)
                    clearTimeout(tHandle);
            }, opt.interval);
            break;
        default:
            tHandle = {};
    }

    return tHandle;
}
