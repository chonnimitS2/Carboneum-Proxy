const request = require("request-promise-native");
const CryptoJS = require("crypto-js");
const moment = require('moment');
const getval = require("./getval");

const ExchangeError = require("./exchangeError");

async function getValue(req) {
    let secret_key = await getval.get(req.session.address + ":" + req.query.exchange + ":SECRET_KEY", req.session.sign);
    if (secret_key === null) {
        return {err: new ExchangeError('Required Secret_key.', 7000)};
    }

    let api_key = await getval.get(req.session.address + ":" + req.query.exchange + ":API_KEY", req.session.sign);
    if (api_key === null) {
        return {err: new ExchangeError('Required API_KEY.', 7001)};
    }

    return {
        api_key: api_key,
        secret_key: secret_key
    }
}

function genSignature(method, host_url, path, form, nonce, secret_key, api_key) {
    let queryString = [];
    if (form !== undefined) {
        for (let key in form) {
            if (form.hasOwnProperty(key)) {
                if (key !== 'Timestamp' && key !== 'Signature' && key !== 'AccessKeyId') {
                    queryString.push(key + '=' + form[key]);
                }
            }
        }
    }
    queryString.push('AccessKeyId=' + api_key);
    queryString.push('Timestamp=' + nonce);
    queryString.sort();
    queryString = queryString.join('&');

    let payload = [method, host_url, path, queryString];

    payload = payload.join('\n');

    return CryptoJS.HmacSHA256(payload, secret_key).toString(CryptoJS.enc.Base64);
}

let obj = {
    depth: async (symbolName, next) => {
        let options = {
            method: 'GET',
            url: 'https://api.huobi.pro/market/depth',
            qs: {
                symbol: symbolName,
                type: 'percent10'
            },
            json: true
        };

        try {
            const body = await request(options);

            if (body.status === 'error') {
                if (body['err-code'].substring(0, 11) === 'bad-request') {
                    next(new ExchangeError('Invalid topic.', 9500));
                } else {
                    next(new ExchangeError('An unknown error occured while processing the request.', 1000));
                }
            } else {
                let depth = {
                    "lastUpdateId": body.ts,
                    "symbol": symbolName,
                    "bids": [],
                    "asks": []
                };

                for (let i in body.tick.bids) {
                    if (body.tick.bids.hasOwnProperty(i)) {
                        depth.bids.push([
                            body.tick.bids[i][0].toString(),
                            body.tick.bids[i][1].toString()
                        ]);
                    }
                }

                for (let i in body.tick.asks) {
                    if (body.tick.asks.hasOwnProperty(i)) {
                        depth.asks.push([
                            body.tick.asks[i][0].toString(),
                            body.tick.asks[i][1].toString()
                        ]);
                    }
                }

                return depth;
            }
        } catch (e) {
            next(e);
        }
    },

    newOrder: async function (req, res, next) {
        const symbol = await require('../model/symbol');

        let symbolName;
        const key = await getValue(req);

        if (key.hasOwnProperty('err')) {
            return next(key.err);
        }

        let nonce = moment().toISOString().substring(0, 19);


        if (req.body.side === 'sell' || req.body.side === 'SELL') {
            req.body.side = 'sell-limit'
        } else {
            req.body.side = 'buy-limit'
        }


        try {
            symbolName = symbol.carboneum[req.body.symbol].huobi;
        } catch (e) {
            symbolName = req.body.symbol;
        }

        const signature = genSignature('POST', 'api.huobi.pro', '/v1/order/orders/place', {
            symbol: symbolName,
            Signature: req.query.Signature,
            SignatureMethod: 'HmacSHA256',
            SignatureVersion: '2',
            AccessKeyId: key.api_key,
        }, encodeURIComponent(nonce), key.secret_key, key.api_key);

        let form = {
            AccessKeyId: key.api_key,
            Signature: signature,
            SignatureMethod: 'HmacSHA256',
            Timestamp: nonce,
            symbol: symbolName,
            SignatureVersion: '2'
        };

        let options = {
            method: 'POST',
            url: 'https://api.huobi.pro/v1/order/orders/place',
            qs: form,
            body:
              {
                  source: req.body.source,
                  amount: req.body.quantity,
                  price: req.body.price,
                  "account-id": process.env.HUOBI_ACC,
                  type: req.body.side,
                  symbol: symbolName
              },
            json: true
        };


        request(options, function (error, response, body) {
            if (error) {
                //todo handle this error
                return next(error);
            }

            if (body.status === 'error') {
                if (body['err-code'].substring(0, 23) === 'api-signature-not-valid') {
                    return next(new ExchangeError('Signature for this request is not valid.', 1022));
                } else if (body['err-code'].substring(0, 41) === 'account-frozen-balance-insufficient-error') {
                    return next(new ExchangeError('Trade account balance is not enough.', 9501));
                } else if (body['err-code'].substring(0, 41) === 'require-account-id') {
                    return next(new ExchangeError('Paramemter `account-id` is required.', 9502));
                } else {
                    return next(new ExchangeError('An unknown error occured while processing the request.', 1000));
                }
            }


            if (req.body.side === 'sell-limit') {
                req.body.side = req.body.side.substring(0, 4)
            } else {
                req.body.side = req.body.side.substring(0, 3)
            }


            res.send({
                "symbol": req.body.symbol,
                "orderId": body.data.toString(),
                "clientOrderId": null,
                "transactTime": Date.parse(nonce) / 1000,
                "price": req.body.price,
                "origQty": req.body.quantity,
                "executedQty": null,
                "status": null,
                "timeInForce": null,
                "type": null,
                "side": req.body.side.toUpperCase()
            });
        });

    },

    allOrder: async function (req, res, next) {
        const symbol = await require('../model/symbol');

        let symbolName;
        const key = await getValue(req);

        if (key.hasOwnProperty('err')) {
            return next(key.err);
        }

        let nonce = moment().toISOString().substring(0, 19);

        try {
            symbolName = symbol.carboneum[req.query.symbol].huobi;
        } catch (e) {
            symbolName = req.query.symbol;
        }

        const signature = genSignature('GET', 'api.huobi.pro', '/v1/order/orders', {
            symbol: symbolName,
            Signature: req.query.Signature,
            states: 'submitted',
            SignatureMethod: 'HmacSHA256',
            SignatureVersion: '2',
            AccessKeyId: key.api_key,
        }, encodeURIComponent(nonce), key.secret_key, key.api_key);

        let toHuobi = [];


        let form = {
            AccessKeyId: key.api_key,
            Signature: signature,
            SignatureMethod: 'HmacSHA256',
            Timestamp: nonce,
            symbol: symbolName,
            SignatureVersion: '2',
            states: 'submitted',
        };
        let options = {
            method: 'GET',
            url: 'https://api.huobi.pro/v1/order/orders',
            qs: form,
            json: true
        };
        request(options, function (error, response, body) {
            if (error) {
                //todo handle this error
                return next(error);
            }

            if (body.status === 'error') {
                if (body['err-code'].substring(0, 23) === 'api-signature-not-valid') {
                    return next(new ExchangeError('Signature for this request is not valid.', 1022));
                } else {
                    return next(new ExchangeError('An unknown error occured while processing the request.', 1000));
                }
            }

            for (let i in body.data) {
                if (body.data.hasOwnProperty(i)) {
                    body.data[i].symbol = symbol.huobi[body.data[i].symbol];
                    body.data[i].type = body.data[i].type.toUpperCase();

                    if (body.data[i].type === "SELL-LIMIT") {
                        body.data[i].type = body.data[i].type.substring(0, 4)
                    } else {
                        body.data[i].type = body.data[i].type.substring(0, 3)
                    }
                    toHuobi.push({
                        "symbol": body.data[i].symbol,
                        "orderId": body.data[i].id.toString(),
                        "clientOrderId": null,
                        "price": body.data[i].price,
                        "origQty": body.data[i].amount,
                        "executedQty": null,
                        "status": null,
                        "timeInForce": null,
                        "type": null,
                        "side": body.data[i].type,
                        "stopPrice": null,
                        "icebergQty": null,
                        "time": body.data[i]['created-at'],
                        "isWorking": null
                    });
                }
            }


            res.send(toHuobi);
        });

    },

    deleteOrder: async function (req, res, next) {

        const key = await getValue(req);

        if (key.hasOwnProperty('err')) {
            return next(key.err);
        }

        let nonce = moment().toISOString().substring(0, 19);


        let orderId = req.query.orderId;

        const signature = genSignature('POST', 'api.huobi.pro', `/v1/order/orders/${orderId}/submitcancel`, {
            Signature: req.query.Signature,
            SignatureMethod: 'HmacSHA256',
            SignatureVersion: '2',
            AccessKeyId: key.api_key,
        }, encodeURIComponent(nonce), key.secret_key, key.api_key);


        let form = {
            AccessKeyId: key.api_key,
            Signature: signature,
            SignatureMethod: 'HmacSHA256',
            Timestamp: nonce,
            SignatureVersion: '2',
        };

        let options = {
            method: 'POST',
            url: `https://api.huobi.pro/v1/order/orders/${orderId}/submitcancel`,
            form: form,
            json: true
        };
        request(options, function (error, response, body) {
            if (error) {
                //todo handle this error
                return next(error);
            }

            if (body.status === 'error') {
                if (body['err-code'].substring(0, 24) === 'order-orderstate-error') {
                    return next(new ExchangeError('The order state is error.', 9500));
                } else if (body['err-code'].substring(0, 23) === 'api-signature-not-valid') {
                    return next(new ExchangeError('Signature for this request is not valid.', 1022));
                } else {
                    return next(new ExchangeError('An unknown error occured while processing the request.', 1000));
                }
            }

            res.send({
                "symbol": null,
                "origClientOrderId": null,
                "orderId": `${body.data}`,
                "clientOrderId": null
            });
        });

    },

    account: async function (req, res, next) {

        const key = await getValue(req);

        if (key.hasOwnProperty('err')) {
            return next(key.err);
        }

        let nonce = moment().toISOString().substring(0, 19);


        const signature = genSignature('GET', 'api.huobi.pro', `/v1/account/accounts/${process.env.HUOBI_ACC}/balance`, {
            Signature: req.query.Signature,
            SignatureMethod: 'HmacSHA256',
            SignatureVersion: '2',
            AccessKeyId: key.api_key,
        }, encodeURIComponent(nonce), key.secret_key, key.api_key);


        let form = {
            AccessKeyId: key.api_key,
            Signature: signature,
            SignatureMethod: 'HmacSHA256',
            Timestamp: nonce,
            SignatureVersion: '2'
        };
        let accHb = {
            "makerCommission": null,
            "takerCommission": null,
            "buyerCommission": null,
            "sellerCommission": null,
            "canTrade": null,
            "canWithdraw": null,
            "canDeposit": null,
            "updateTime": Date.parse(nonce) / 1000,
            "balances": []
        };

        let options = {
            method: 'GET',
            url: `https://api.huobi.pro/v1/account/accounts/${process.env.HUOBI_ACC}/balance`,
            qs: form,
            json: true
        };

        request(options, function (error, response, body) {
            if (error) {
                //todo handle this error
                return next(error);
            }

            if (body.status === 'error') {
                if (body['err-code'].substring(0, 23) === 'api-signature-not-valid') {
                    return next(new ExchangeError('Signature for this request is not valid.', 1022));
                } else {
                    return next(new ExchangeError('An unknown error occured while processing the request.', 1000));
                }
            }

            let temp = {};
            for (let i in body.data.list) {
                if (body.data.list.hasOwnProperty(i)) {
                    if (i % 2 === 1) {
                        // noinspection JSUnresolvedVariable
                        temp["locked"] = body.data.list[i].balance;
                        accHb.balances.push(temp);
                        temp = {};
                    } else {
                        // noinspection JSUnresolvedVariable
                        temp = {
                            "asset": body.data.list[i].currency.toUpperCase(),
                            "free": body.data.list[i].balance,
                        };
                    }
                }
            }

            res.send(accHb);
        });

    },

    ticker: async function (symbolName, next) {
        let options = {
            method: 'GET',
            url: 'https://api.huobi.pro/market/detail',
            qs: {
                symbol: symbolName,
            },
            json: true
        };

        try {
            const body = await request(options);

            return {
                exchange: 'huobi',
                price: body.tick.close.toString()    // Open price
            };
        } catch (e) {
            next(e);
        }
    },

    klines: async (symbolName, interval, startTime, endTime, limit, next) => {
        let qs = {
            symbol: symbolName,
            period: interval,
            size: limit,
        };

        for (let q in qs) {
            if (qs.hasOwnProperty(q)) {
                if (qs[q] === undefined) {
                    delete qs[q]
                }
            }
        }

        const options = {
            method: 'GET',
            url: 'https://api.huobi.pro/market/history/kline',
            qs,
            headers:
              {
                  'Cache-Control': 'no-cache'
              },
            json: true
        };

        try {
            const data = await request(options);
            let result = [];

            for (let i=0; i<data.data.length; i++) {
                const item = data.data[i];

                result.push([
                    data.ts,
                    item['open'].toString(),
                    item['high'].toString(),
                    item['low'].toString(),
                    item['close'].toString(),
                    item['vol'].toString(),
                    data.ts,
                    item['amount'].toString(),
                    item['count'],
                    '',
                    '',
                    '',
                ]);
            }

            return result;
        } catch (e) {
            next(e);
        }
    },

    allowInterval: (interval) => {
        const intervalList = [
            '1m',
            '5m',
            '15m',
            '30m',
            '1h',
            '1d',
            '1w',
            '1M',
            '1Y',
        ];

        if (intervalList.indexOf(interval) !== -1) {
            switch (interval) {
                case '1h':
                    return '60min';
                case '1d':
                    return '1day';
                case '1w':
                    return '1week';
                case '1M':
                    return '1mon';
                case '1Y':
                    return '1year';
                default:
                    return interval.replace('m', 'min');
            }
        }

        return false;
    }

};

module.exports = obj;