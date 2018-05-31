var express = require('express');
var router = express.Router();
var binance = require('../model/binance');
var bx = require('../model/bx');

module.exports = function (exchange) {
    /* GET home page. */
    router.get('/', function(req, res, next) {
        exchange[req.query.exchange].depth(req, res);
    });

    return router;
};