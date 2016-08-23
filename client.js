var SmartObject = require('smartobject');

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
/*** Init Resources                                                                            ***/
/*************************************************************************************************/
var x = 0;
var so = new SmartObject();
so.init('temperature', 0, {
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

so.init('temperature', 1, {
    sensorValue: 100
});

so.init('temperature', 2, {
    sensorValue: 101
});
/*************************************************************************************************/
/*** Prepare the Client Node                                                                   ***/
/*************************************************************************************************/
var devAttrs = {
    lifetime: 2000,
    version: '1.0.2'
};

var qnode = new MqttNode('test_node_01', so, devAttrs);

/*********************************************/
/*** The custom encrption/decryption       ***/
/*********************************************/
// qnode.encrypt = function (msg, clientId, callback) {
//     var msgBuf = new Buffer(msg),
//         cipher = crypto.createCipher('aes128', 'mypassword'),
//         encrypted = cipher.update(msgBuf, 'binary', 'base64');
//     try {
//         encrypted += cipher.final('base64');
//         callback(null, encrypted);
//     } catch (e) {
//         callback(e);
//     }

// };

// qnode.decrypt = function (msg, clientId, callback) {
//     msg = msg.toString();
//     var decipher = crypto.createDecipher('aes128', 'mypassword'),
//         decrypted = decipher.update(msg, 'base64', 'utf8');

//     try {
//         decrypted += decipher.final('utf8');
//         callback(null, decrypted);
//     } catch (e) {
//         // log 'decrytion fails'
//         console.log('decrytion fails.');
//         callback(e);
//     }
// };


/*************************************************************************************************/
/*** Client Node Listeners                                                                     ***/
/*************************************************************************************************/
/*********************************************/
/*** Fundamental Events                    ***/
/*********************************************/
qnode.on('connect', function () {
    console.log('connect');
});

qnode.on('reconnect', function () {
    console.log('reconnect');
});

qnode.on('offline', function () {
    console.log('offline');
});

qnode.on('close', function () {
    console.log('close');
});

qnode.on('error', function (err) {
    console.log(err);
});

qnode.on('login', function () {
    console.log('login');
});

qnode.on('logout', function () {
    console.log('logout');
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

qnode.on('ready', function () {
    console.log('ready');
    setTimeout(function () {
        qnode.connect('mqtt://localhost', {
            // username: 'freebird',
            // password: 'skynyrd',
            reconnectPeriod: 5000
        }, function (err, rsp) {
            console.log(err);
            console.log(rsp);
        });
    }, 1000);
});

/*********************************************/
/*** Registered Events                     ***/
/*********************************************/
qnode.on('registered', function (rsp) {
    REG('registered: ');
    REG(rsp);
    console.log('registered');
    // runTask(function () {
    //     qnode.checkin(function (err, rsp) {
    //         console.log(err);
    //         console.log(rsp);
    //     });
    // }, { interval: 4000, repeat: 1 });

        runTask(function () {
            qnode.checkout(function (err, rsp) {
                qnode.close();
                setTimeout(function () {
                    qnode.connect('mqtt://localhost', function (err, rsp) {
                        console.log(err);
                        console.log(rsp);
                    });
                    setTimeout(function () {
                        qnode.checkin();
                    }, 3000);
                    
                }, 2000);
            });
        }, { interval: 10000, repeat: 1 });

    runTask(readTemp, { interval: 4000, repeat: 1 });
    runTask(writeTemp, { interval: 2000, repeat: 1 });
    // runTask(function () {
    //     qnode.pingServer(function (err, r) {
    //         console.log(err);
    //         console.log(r);
    //     });

    // }, { interval: 2000, repeat: 1 } );

    // runTask(function () {
    //     console.log(qnode.so.temperature[0]);
    //     qnode._dumpObj('temperature', 0, function (err, o) {

    //         qnode.pubNotify({
    //             oid: 'temperature',
    //             iid: 0,
    //             rid: 'sensorValue',
    //             data: o.sensorValue
    //         }, function (err, rsp) {
    //             console.log(rsp); 
    //         });
    //     });


    //     // qnode.setDevAttrs({
    //     //     clientId: 3
    //     // }, function (err, rsp) {
    //     //     console.log('******* PUB UPDATE ********');
    //     //     console.log(rsp);
    //     // });

    // }, { interval: 2000, repeat: 1 } );

});

qnode.on('request', function (msg) {
    // console.log(msg);
});

qnode.on('announce', function (msg) {
    console.log('announce');
    console.log(msg);
    if (msg === 'resetting') {
        qnode.close(true, function () {
            setTimeout(function () {
                qnode.connect('mqtt://localhost', {
                    // username: 'freebird',
                    // password: 'skynyrd',
                    reconnectPeriod: 5000
                });
            }, 6000);
        });
    }
});


/*************************************************************************************************/
/*** Testing Tasks                                                                             ***/
/*************************************************************************************************/
function readTemp() {
    qnode.so.read('temperature', 0, 'sensorValue', function (err, val) {
        TASK('READ >> read: ' + val + ', sensorValue: ' + qnode.so.temperature[0].sensorValue);
    });
}

function writeTemp() {
    var v = Math.floor((Math.random() * 100) + 1),
        x = Math.floor((Math.random() * 100) + 1);
    qnode.so.write('temperature', 0, 'sensorValue', v, function (err, val) {
        TASK('WRITE >> write: ' + val + ', sensorValue: ' + qnode.so.temperature[0].sensorValue);
    });


    qnode.so.write('temperature', 0, 'minRangeValue', x, function (err, val) {
        TASK('WRITE >> write: ' + val + ', minRangeValue: ' + qnode.so.temperature[0].minRangeValue);
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
