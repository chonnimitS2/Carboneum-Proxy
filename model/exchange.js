var binance = require('./binance')
var bx = require('./bx')

const exchange = {
    binance: binance,
    bx: bx,
    new: function (obj) {
        obj(this);
    }
};

module.exports = exchange;