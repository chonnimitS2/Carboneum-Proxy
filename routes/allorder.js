var express = require('express');
var router = express.Router();
var binance = require('../model/binance');

module.exports = function (exchange) {
    /* GET home page. */
    router.get('/', function(req, res, next) {
        exchange[req.query.exchange].allOrder(req, res);
    });

    router.post('/', function(req, res, next) {
        exchange[req.query.exchange].allOrder(req, res);
    });

    return router;
};