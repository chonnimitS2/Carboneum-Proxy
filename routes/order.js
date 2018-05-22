var express = require('express');
var router = express.Router();
var binance = require('../model/binance');
/* GET home page. */
router.post('/', function(req, res, next) {
    binance.newOrder(req, res);
});


router.delete('/', function(req, res, next) {
    binance.deleteOrder(req, res);
});


module.exports = router;
