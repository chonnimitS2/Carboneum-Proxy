var request = require("request");
var CryptoJS = require("crypto-js");

let nonce = Date.now();

function genSignature(form) {
    let queryString = [];

    queryString.push(form.key + form.nonce);
    queryString = queryString.join('');

    console.log(queryString);
    let signatureResult = CryptoJS.SHA256(queryString + "secretkey").toString(CryptoJS.enc.Hex);
    form.signature = signatureResult;
}

let obj = {
    depth: function (req, res) {
        var options = {
            method: 'GET',
            url: 'https://bx.in.th/api/orderbook/',
            qs: {
                pairing: req.query.symbol
            },
            headers:
                {
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
            key: req.body.key,
            nonce: req.body.timestamp + '000',
            signature: '',
            pairing: req.body.symbol,
            type: req.body.side,
            amount: req.body.quantity,
            rate: req.body.price
        };

        genSignature(form);
        console.log(form);
        var options = {
            method: 'POST',
            url: 'https://bx.in.th/api/order',
            headers:
                {
                    'Content-Type': 'application/x-www-form-urlencoded'
                },
            form: form
        };

        request(options, function (error, response, body) {
            if (error) throw new Error(error);

            console.log(body);
            res.setHeader('Content-Type', 'application/json');
            res.send({
                "symbol": req.body.symbol,
                "clientOrderId": '',
                "transactTime": req.body.timestamp,
                "price": req.body.price,
                "origQty": req.body.quantity,
                "executeQty": '',
                "status": '',
                "timeInForce": '',
                "type": '',
                // "side": req.body.side.toUpperCase()
            });
        });

    },
    allOrder: function (req, res) {
        let form = {
            key: req.body.key,
            nonce: req.query.timestamp+ '000',
            pairing: req.query.symbol
        };

        let toBinance = [];

        genSignature(form);
        var options = {
            method: 'POST',
            url: 'https://bx.in.th/api/getorders/',
            headers:
                {
                    'Content-Type': 'application/x-www-form-urlencoded'
                },
            form: form
        };
        request(options, function (error, response, body) {
            if (error) throw new Error(error);

            let val = JSON.parse(body);

            for (let i in val.orders) {
                toBinance.push({
                    "symbol": req.query.symbol,
                    "orderId": val.orders[i].order_id,
                    "clientOrderId": '',
                    "price": val.orders[i].rate,
                    "origQty": val.orders[i].amount,
                    "executedQty": '',
                    "status": '',
                    "timeInForce": '',
                    "type": '',
                    "side": val.orders[i].order_type.toUpperCase(),
                    "stopPrice": '',
                    "icebergQty": '',
                    "time": Date.parse(val.orders[i].date)/1000,
                    "isWorking": ''
                });
            }
            console.log(toBinance);
            res.setHeader('Content-Type', 'application/json');
            res.send(toBinance);
        });

    },
    deleteOrder: function (req, res) {
        let form = {
            key: req.body.key,
            nonce: req.query.timestamp + '000',
            pairing: req.query.symbol,
            order_id: req.query.orderId
        };

        genSignature(form);
        var options = {
            method: 'POST',
            url: 'https://bx.in.th/api/cancel/',
            headers:
                {
                    'Content-Type': 'application/x-www-form-urlencoded'
                },
            form: form
        };
        request(options, function (error, response, body) {
            if (error) throw new Error(error);

            console.log(body);
            res.setHeader('Content-Type', 'application/json');
            res.send({
                "symbol": req.query.symbol,
                "origClientOrderId": '',
                "orderId": req.query.orderId,
                "clientOrderId": ''
            });
        });

    },
    account: function (req, res) {
        let form = {
            key: req.body.key,
            nonce: req.query.timestamp + '000'
        };

        let accBx = {
            "makerCommission": '',
            "takerCommission": '',
            "buyerCommission": '',
            "sellerCommission": '',
            "canTrade": '',
            "canWithdraw": '',
            "canDeposit": '',
            "updateTime": req.query.timestamp,
            "balances": []

    };

        genSignature(form);
        var options = {
            method: 'POST',
            url: 'https://bx.in.th/api/balance/',
            headers:
                {
                    'Content-Type': 'application/x-www-form-urlencoded'
                },
            form: form
        };
        request(options, function (error, response, body) {
            if (error) throw new Error(error);

            let value = JSON.parse(body);

            for (let i in value.balance) {
                if (value.balance.hasOwnProperty(i)) {
                    accBx.balances.push({
                        "asset": i,
                        "free": value.balance[i].available,
                        "locked": value.balance[i].orders
                    });
                }
            }

            console.log(accBx);
            res.setHeader('Content-Type', 'application/json');
            res.send(accBx);
        });

    }

};

module.exports = obj;