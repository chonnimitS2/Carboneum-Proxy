var express = require('express');
var router = express.Router();
var binance = require('../model/binance');
var bx = require('../model/bx');


module.exports = function (exchange) {
    /* GET home page. */
    router.post('/', function(req, res, next) {
        exchange[req.query.exchange].newOrder(req, res);
    });

    router.post('/', function(req, res, next) {
        exchange[req.query.exchange].deleteOrder(req, res);
    });

    router.delete('/', function(req, res, next) {
        exchange[req.query.exchange].deleteOrder(req, res);
    });

    return router;
};
