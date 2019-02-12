'use strict';

var _ = require('busyman'),
    mutils = require('lwmqn-util'),
    TTYPE = require('./constants').TTYPE;

var reporter = {};

reporter.enableReport = function (qn, oid, iid, rid) {
    var trg = qn._target(oid, iid, rid),                // { type, exist }
        so = qn.getSmartObject(),
        rAttrs = reporter.getAttrs(qn, oid, iid, rid),  // { pmin, pmax, mute, cancel, lastRpVal }
        okey = mutils.oidKey(oid),
        rkey, rpid, pmin, pmax, rRpt, dumper, notifier;

    if (!trg.exist || !so)
        return false;

    if (trg.type === TTYPE.obj) {
        return false;

        //TODO: recursively call this reporter on its instances
    } else if (trg.type === TTYPE.inst) {
        return false;

        //TODO: recursively call this reporter on the instances resources
    } else if (trg.type === TTYPE.rsc) {
        rkey = mutils.ridKey(oid, rid);

        rpid = okey + ':' + iid + ':' + rkey;
    } else {
        return false;
    }

    pmin = rAttrs.pmin * 1000;
    pmax = rAttrs.pmax * 1000;

    rAttrs.cancel = false;
    rAttrs.mute = false;
    qn._reporters[rpid] = { min: null, max: null, poller: null };
    rRpt = qn._reporters[rpid];

    so.read(oid, iid, rid, { restrict: true }, function(err, data) {
        if(err)
        {
            reporter.setTimers(rRpt, rAttrs, so, oid, iid, rid, true);
        }
    });

    /*if(pmin > 0)
    {
        rRpt.min = setTimeout(function () {
            // if no pmin, just report at pmax triggered
            rAttrs.mute = false;
        }, pmin);
    }

    rRpt.max = setInterval(function () {
        rAttrs.mute = true;
        dumper(function (err, val) {
            rAttrs.mute = false;
            notifier.data = val;
            //qn.notify(notifier, function () {});
        });

        if (!_.isNil(rRpt.min))
            clearTimeout(rRpt.min);

        rRpt.min = null;
        rRpt.min = setTimeout(function () {
            if (pmin === 0) {
                rAttrs.mute = false;
            } else {
                dumper(function (err, val) {
                    rAttrs.mute = false;
                    notifier.data = val;
                    //qn.notify(notifier, function () {});
                });
            }
        }, pmin);
    }, pmax);*/

    return true;
};

reporter.disableReport = function (qn, oid, iid, rid) {
    var trg = qn._target(oid, iid, rid),                // { type, exist }
        rAttrs = reporter.getAttrs(qn, oid, iid, rid),  // { pmin, pmax, mute, cancel, lastRpVal }
        okey = mutils.oidKey(oid),
        rpid,
        rRpt;

    if (!trg.exist)
        return false;

    if (trg.type === TTYPE.obj)
        //TODO recursively cancel reports on object instance
        rpid = okey;
    else if (trg.type === TTYPE.inst)
        //TODO recursively cancel reports on instances' resources
        rpid = okey + ':' + iid;
    else if (trg.type === TTYPE.rsc)
        rpid = okey + ':' + iid + ':' + mutils.ridKey(oid, rid);
    else
        return false;

    rRpt = qn._reporters[rpid];
 
    if (_.isNull(rAttrs))
        return false;

    if (_.isUndefined(rRpt))
        return true;

    rAttrs.cancel = true;
    rAttrs.mute = true;

    clearTimeout(rRpt.min);
    clearInterval(rRpt.max);
    clearInterval(rRpt.poller);

    rRpt.min = null;
    rRpt.max = null;
    rRpt.poller = null;
    rRpt = null;
    delete qn._reporters[rpid];

    return true;
};

reporter.clear = function (qn) {
    var repAttrs = qn._repAttrs;

    _.forEach(repAttrs, function (rAttrs, rpid) {
        // rAttrs =  rpid: { pmin, pmax, mute, cancel, lastRpVal }
        var rRpt = qn._reporters[rpid];

        rAttrs.cancel = true;
        rAttrs.mute = true;

        if (!_.isNil(rRpt)) {
            clearTimeout(rRpt.min);
            clearInterval(rRpt.max);
            clearInterval(rRpt.poller);
            rRpt.min = null;
            rRpt.max = null;
            rRpt.poller = null;
        }

        rRpt = null;
        delete qn._reporters[rpid];
    });

    return true;
};

reporter.getAttrs = function (qn, oid, iid, rid) {
    var trg = qn._target(oid, iid, rid),    // { type, exist }
        so = qn.getSmartObject(),
        key,
        defaultAttrs;

    if (!trg.exist)
        return undefined;

    key = mutils.oidKey(oid);
    defaultAttrs = {
        pmin: so.get('lwm2mServer', 0, 'defaultMinPeriod'),
        pmax: so.get('lwm2mServer', 0, 'defaultMaxPeriod'),
        mute: true,
        cancel: true,
        lastRpVal: null
    };

    if (trg.type === TTYPE.inst)
        key = key + ':' + iid;
    else if (trg.type === TTYPE.rsc)
        key = key + ':' + iid + ':' + mutils.ridKey(oid, rid);

    qn._repAttrs[key] = qn._repAttrs[key] || defaultAttrs;

    return qn._repAttrs[key];
};

reporter.setAttrs = function (qn, oid, iid, rid, attrs) {
    var okey = mutils.oidKey(oid),
        rkey,
        key,
        trg;

    if (arguments.length === 5) {
        rkey = mutils.ridKey(oid, rid);
        key = okey + ':' + iid + ':' + rkey;
    } else if (arguments.length === 4) {
        attrs = rid;
        rid = undefined;
        key = okey + ':' + iid;
    } else if (arguments.length === 3) {
        attrs = iid;
        iid = undefined;
    }

    if (!_.isPlainObject(attrs))
        throw new TypeError('attrs should be given as an object.');

    trg = qn._target(oid, iid, rid);

    if (!trg.exist)
        return false;

    // attrs with default settings
    attrs.pmin = _.isNumber(attrs.pmin) ? attrs.pmin : qn.so.get('lwm2mServer', 0, 'defaultMinPeriod');
    attrs.pmax = _.isNumber(attrs.pmax) ? attrs.pmax : qn.so.get('lwm2mServer', 0, 'defaultMaxPeriod');
    attrs.mute = _.isBoolean(attrs.mute) ? attrs.mute : true;
    attrs.cancel = _.isBoolean(attrs.cancel) ? attrs.cancel : true;
    attrs.lastRpVal = attrs.lastRpVal || null;
    attrs.usecache = _.isBoolean(attrs.usecache) ? attrs.usecache : false;
    qn._repAttrs[key] = attrs;

    return true;
};

reporter.checkAndReportResource = function (qn, oid, iid, rid, currVal) {
    var rAttrs = reporter.getAttrs(qn, oid, iid, rid),  // { pmin, pmax, mute, cancel, lastRpVal }
        rpt = false,
        okey = mutils.oidKey(oid),
        rkey = mutils.ridKey(oid, rid),
        gt, lt, step, lastrp,
        rpid = okey + ':' + iid + ':' + rkey,
        rRpt = qn._reporters[rpid],
        cachevalues = rAttrs.usecache;

    if (_.isNil(rAttrs))
        return false;

    if (_.isNil(rRpt))
        return false;

    gt = rAttrs.gt;
    lt = rAttrs.lt;
    step = rAttrs.stp;
    lastrp = rAttrs.lastRpVal;

    if (rAttrs.cancel || rAttrs.mute)
        return false;

    if(!cachevalues)
    {
        rpt = true
    } else if (_.isObject(currVal)) {
        if (_.isObject(rAttrs.lastRpVal)) {
            _.forEach(rAttrs.lastRpVal, function (v, k) {
                rpt = rpt || (v !== rAttrs.lastRpVal[k]);
            });
        } else {
            rpt = true;
        }
    } else if (!_.isNumber(currVal)) {
        rpt = (rAttrs.lastRpVal !== currVal);
    } else {

        if (_.isNumber(gt) && _.isNumber(lt) && lt > gt) {
            rpt = (lastrp !== currVal) && (currVal > gt) && (currVal < lt);
        } else {
            rpt = _.isNumber(gt) && (lastrp !== currVal) && (currVal > gt);
            rpt = rpt || (_.isNumber(lt) && (lastrp !== currVal) && (currVal < lt));
        }

        if (_.isNumber(step)) {
            rpt = rpt || (Math.abs(currVal - lastrp) >= step);
        }
    }

    if (rpt) {
        qn.notify({ oid: oid, iid: iid, rid: rid, data: currVal }, function () {});
        rAttrs.lastRpVal = currVal;
    }

    if((rAttrs.pmin >= rAttrs.pmax) || rpt || (_.isNil(rRpt.max) && rAttrs.pmax > 0)) {
        reporter.setTimers(rRpt, rAttrs, qn.so, oid, iid, rid)
    }
        
    return rpt;
};

reporter.setTimers = function (rRpt, rAttrs, so, oid, iid, rid, initmute = false)
{
    var pmin, pmax;

    pmin = rAttrs.pmin * 1000;
    pmax = rAttrs.pmax * 1000;

    if (!_.isNil(rRpt.min))
        clearTimeout(rRpt.min);
    if (!_.isNil(rRpt.max))
        clearTimeout(rRpt.max);

    if (pmin > 0) {
        rAttrs.mute = !initmute;
        rRpt.min = setTimeout(function () {
            // if no pmin, just report at pmax triggered
            rAttrs.mute = false;
        }, pmin);
    }

    if (pmax > 0) {
        rRpt.max = setTimeout(function () {
            rAttrs.mute = false;
            rRpt.max = null;
            setImmediate(function () {
                so.read(oid, iid, rid, { restrict: true }, function () { })
            });
        }, pmax)
    }
}

module.exports = reporter;
