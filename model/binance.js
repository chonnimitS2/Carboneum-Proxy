var request = require("request");
var CryptoJS = require("crypto-js");


let nonce = Date.now();

function genSignature(form) {
    let queryString = [];
    if (form !== undefined) {
        for (let key in form) {
            if (key !== 'timestamp' && key !== 'signature') {
                queryString.push(key + '=' + form[key]);
                console.log(key);
                console.log(form[key]);
            }
        }
    }

    queryString.push('timestamp=' + form.timestamp);
    queryString = queryString.join('&');

    console.log(queryString);
    let signatureResult = CryptoJS.HmacSHA256(queryString, "secretkey" ).toString(CryptoJS.enc.Hex);
    form.signature = signatureResult;
}

function deleteField(form) {
    let optionals = ['newClientOrderId', 'stopPrice', 'icebergQty', 'newOrderRespType']
    for (let i = 0; i < optionals.length; i++) {
        if (form[optionals[i]] === undefined) {
            delete form[optionals[i]];
        }
    }
}

let obj = {
    depth: function (req, res) {
        var options = {
            method: 'GET',
            url: 'https://api.binance.com/api/v1/depth',
            qs: {
                symbol: req.query.symbol
            },
            headers:
                {
                    'Postman-Token': 'cabcef67-a56f-4f80-b2cf-bd0a9001d03d',
                    'Cache-Control': 'no-cache'
                }
        };
        request(options, function (error, response, body) {
            if (error) throw new Error(error);

            obj = body;
            obj = JSON.parse(body);
            obj.lastUpdateId = nonce;

            console.log(obj);
            // res.setHeader('Content-Type', 'application/json');
            res.send(obj);
        });

    },
    newOrder: function (req, res) {
        let form = {
            symbol: req.body.symbol,
            side: req.body.side,
            type: req.body.type,
            timeInForce: req.body.timeInForce,
            quantity: req.body.quantity,
            price: req.body.price,
            newClientOrderId: req.body.newClientOrderId,
            stopPrice: req.body.stopPrice,
            icebergQty: req.body.icebergQty,
            newOrderRespType: req.body.newOrderRespType,
            recvWindow: req.body.recvWindow,
            timestamp: req.body.timestamp,
            signature: ''
        };

        deleteField(form);
        genSignature(form);
        console.log(form);
        var options = {
            method: 'POST',
            url: 'https://api.binance.com/api/v3/order',
            headers:
                {
                    'Cache-Control': 'no-cache',
                    'Content-Type': 'application/x-www-form-urlencoded',
                    'X-MBX-APIKEY': 'apikey'
                },
            form: form
        };

        request(options, function (error, response, body) {
            if (error) throw new Error(error);

            res.setHeader('Content-Type', 'application/json');
            console.log(body);
            res.send(body);
        });

    },
    allOrder: function (req, res) {
        let qs = {symbol: req.query.symbol,
            timestamp: req.query.timestamp + '000'};

        genSignature(qs);
        var options = {
            method: 'GET',
            url: 'https://api.binance.com/api/v3/allOrders',
            headers:
                {
                    'Content-Type': 'application/x-www-form-urlencoded',
                    'X-MBX-APIKEY': 'apikey'
                },
            qs: qs
        };
        request(options, function (error, response, body) {
            if (error) throw new Error(error);

            console.log(body);
            res.setHeader('Content-Type', 'application/json');
            res.send(body);
        });

    },
    deleteOrder: function (req,res) {
        let qs = {
            symbol: req.query.symbol,
            orderId: req.query.orderId,
            timestamp: req.query.timestamp
        };

        genSignature(qs);
        var options = {
            method: 'DELETE',
            url: 'https://api.binance.com/api/v3/order',
            headers:
                {
                    'Content-Type': 'application/x-www-form-urlencoded',
                    'X-MBX-APIKEY': 'apikey'
                },
            qs: qs
        };
        request(options, function (error, response, body) {
            if (error) throw new Error(error);

            console.log(body);
            res.setHeader('Content-Type', 'application/json');
            res.send(body);
        });

    },
    account: function (req,res) {
        let qs = {
            timestamp: req.query.timestamp
        };

        genSignature(qs);
        var options = {
            method: 'GET',
            url: 'https://api.binance.com/api/v3/account',
            headers:
                {
                    'Content-Type': 'application/x-www-form-urlencoded',
                    'X-MBX-APIKEY': 'apikey'
                },
            qs: qs
        };
        request(options, function (error, response, body) {
            if (error) throw new Error(error);

            console.log(body);
            res.setHeader('Content-Type', 'application/json');
            res.send(body);
        });

    }

};


module.exports = obj;