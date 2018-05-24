var request = require("request");
var CryptoJS = require("crypto-js");

function genSignature(form) {
    let queryString = [];

    queryString.push(form.key + form.nonce);
    queryString = queryString.join('');

    console.log(queryString);
    let signatureResult = CryptoJS.SHA256(queryString + "/*secretkey*/" ).toString(CryptoJS.enc.Hex);
    form.signature = signatureResult;
}
let obj = {
    depth: function (req, res) {
        var options = {
            method: 'GET',
            url: 'https://bx.in.th/api/orderbook',
            qs: {pairing: req.query.pairing},
            headers:
                {
                    'Postman-Token': 'cabcef67-a56f-4f80-b2cf-bd0a9001d03d',
                    'Cache-Control': 'no-cache'
                }
        };
        request(options, function (error, response, body) {
            if (error) throw new Error(error);

            console.log(body);
            res.setHeader('Content-Type', 'application/json');
            res.send(body);
        });

    },

    newOrder: function (req, res) {
        let form = {
            key: req.body.key,
            nonce: req.body.nonce+'000',
            signature: '',
            pairing: req.body.pairing,
            type: req.body.type,
            amount: req.body.amount,
            rate: req.body.rate
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
            res.send(body);
        });

    },
    allOrder: function (req, res) {
        let form = {
            key: req.body.key,
            nonce: req.body.nonce+'000',
            pairing: req.body.pairing,
            type: req.body.type
        };

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

            console.log(body);
            res.setHeader('Content-Type', 'application/json');
            res.send(body);
        });

    },
    deleteOrder: function (req,res) {
        let form = {
            key: req.body.key,
            nonce: req.body.nonce+'000',
            pairing: req.body.pairing,
            order_id: req.body.order_id
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
            res.send(body);
        });

    },
    account: function (req,res) {
        let form = {
            key: req.body.key,
            nonce: req.body.nonce+'000'
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

            console.log(body);
            res.setHeader('Content-Type', 'application/json');
            res.send(body);
        });

    }

};

module.exports = obj;