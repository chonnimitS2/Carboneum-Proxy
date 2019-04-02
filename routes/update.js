const express = require('express');
const request = require("request-promise-native");

const router = express.Router();

const redis = require('../model/redis');


router.get('/coinData', async (req, res, next) => {
  const ip = req.ip || req.connection.remoteAddress;

  if (['10.0.0.1', '0.1.0.1'].findIndex(x => x === ip) !== -1 || process.env.NODE_ENV !== 'production') {
    const options = {
      method: 'GET',
      uri: 'https://pro-api.coinmarketcap.com/v1/cryptocurrency/listings/latest',
      qs: {
        limit: 5000,
        convert: 'USD'
      },
      headers: {
        'X-CMC_PRO_API_KEY': process.env.COINMARKETCAPKEY
      },
      json: true,
      gzip: true
    };

    try {
      const body = await request(options);

      for (let i = 0; i < body.data.length; i++) {
        redis.hset('COINMARKETCAP', body.data[i].symbol, JSON.stringify(body.data[i]));
        redis.hset('fullName', body.data[i].symbol, body.data[i]['name']);
      }

      res.status(200).end();
    } catch (e) {
      next(e)
    }
  } else {
    res.status(403).end();
  }
});

module.exports = router;