const express = require('express');
const Decimal = require('decimal.js');
const numeral = require('numeral');
const request = require("request-promise-native");

const redis = require('../model/redis');
const exchange = require('../model/exchange');
const ExchangeError = require("../model/exchangeError");

Decimal.set({toExpPos: 9e15, toExpNeg: -9e15});


function formatWithRemoveZero(decimalData) {
  if (decimalData.name !== '[object Decimal]') {
    decimalData = new Decimal(decimalData);
  }

  let dp = decimalData.dp();

  if (dp > 6) {
    dp = 6;
  } else if (dp < 2) {
    dp = 2;
  }

  decimalData = decimalData.toFixed(dp).split('.');

  const front = decimalData[0];
  let back = decimalData[1];

  return numeral(front).format('0,0') + '.' + back;
}
const router = express.Router();

router.get('/data', async (req, res, next) => {
  const symbol = await require('../model/symbol');
  let result = {};

  if (exchange[req.query.exchange]) {
    const symbolName = req.query.symbol;

    if (symbol['carboneum'].hasOwnProperty(symbolName) && symbol['carboneum'][symbolName].hasOwnProperty(req.query.exchange)) {
      const coinMarketCapDataRaw = await redis.hgetAsync('COINMARKETCAP', req.query.symbol.split('/')[0]);

      if (coinMarketCapDataRaw) {
        const coinMarketCapData = JSON.parse(coinMarketCapDataRaw);
        const options = {
          method: 'GET',
          uri: 'https://api.binance.com/api/v1/ticker/24hr',
          json: true,
        };

        const ticker24hr = await request(options);
        const exchangeName = symbol['carboneum'][symbolName][req.query.exchange];

        for (let i = 0; i < ticker24hr.length; i++) {

          if (ticker24hr[i].symbol === exchangeName) {
            const price = formatWithRemoveZero(ticker24hr[i]['lastPrice']);

            result = {
              symbol: req.query.symbol,
              price: price,
              change: ticker24hr[i]['priceChange'],
              percentChange: ticker24hr[i]['priceChangePercent'] + '%',
              fullName: coinMarketCapData['name'],
              rank: `${coinMarketCapData['cmc_rank']}`,
              marketCap: numeral(coinMarketCapData['quote']['USD']['market_cap']).format('0.0 a').toUpperCase().trim(),
              supply: numeral(coinMarketCapData['circulating_supply']).format('0.0 a').toUpperCase().trim(),
              color: parseFloat(ticker24hr[i]['priceChange']) < 0 ? '#A90436' : '#819214',
            };
            break;
          }
        }

        if (result) {
          return res.send(result);
        } else {
          return next(new ExchangeError('Invalid symbol.', 1121));
        }
      } else {
        return next(new ExchangeError('Invalid symbol.', 1121));
      }
    } else {
      return next(new ExchangeError('Invalid symbol.', 1121));
    }
  } else {
    return next(new ExchangeError('Exchange not found!', 9000));
  }
});

router.get('/list', async (req, res, next) => {
  const symbol = await require('../model/symbol');
  let result = [];

  if (req.query.exchange) {
    if (symbol[req.query.exchange]) {
      const fullNameDataList = [];
      const symbolList = [];

      for (let k in symbol[req.query.exchange]) {
        if (symbol[req.query.exchange].hasOwnProperty(k)) {
          fullNameDataList.push(symbol[req.query.exchange][k].split('/')[0]);
          symbolList.push(symbol[req.query.exchange][k]);
        }
      }

      const fullNameDataListDone = await redis.hmgetAsync('fullName', fullNameDataList);

      for (let i = 0; i < symbolList.length; i++) {
        let fullName = '';
        const symbolName = symbolList[i];
        const fullNameData = fullNameDataListDone[i];

        if (fullNameData) {
          fullName = fullNameData;
        }

        result.push({
          symbol: symbolName,
          fullName: fullName
        });
      }

      res.send(result);
    } else {
      next(new ExchangeError('Exchange not found!', 9000));
    }
  } else {
    const symbolList = Object.keys(symbol['carboneum']);
    const fullNameDataList = [];

    for (let i = 0; i < symbolList.length; i++) {
      fullNameDataList.push(symbolList[i].split('/')[0]);
    }

    const fullNameDataListDone = await redis.hmgetAsync('fullName', fullNameDataList);

    for (let i = 0; i < symbolList.length; i++) {
      let fullName = '';
      const symbolName = symbolList[i];
      const fullNameData = fullNameDataListDone[i];

      if (fullNameData) {
        fullName = fullNameData;
      }

      result.push({
        symbol: symbolName,
        fullName: fullName
      });
    }

    res.send(result);
  }
});

router.get('/listWithPrice', async (req, res, next) => {
  const symbol = await require('../model/symbol');
  let symbols = false;

  try {
    symbols = JSON.parse(req.query.symbols);
  } catch (e) {
    return next(e);
  }

  const cacheKey = `listWithPrice:1:${req.query.exchange}:${req.query.symbols}`;

  const cacheResult = await redis.getAsync(cacheKey);

  if (cacheResult) {
    return res.send(JSON.parse(cacheResult));
  }

  if (req.query.exchange) {
    if (exchange[req.query.exchange]) {
      let symbolList = [];
      let klineListPromise = [];
      let result = [];

      for (let i = 0; i < symbols.length; i++) {
        if (symbol['carboneum'].hasOwnProperty(symbols[i])) {
          if (symbol['carboneum'][symbols[i]].hasOwnProperty(req.query.exchange)) {
            symbolList.push({
              symbol: symbols[i],
              exchangeName: symbol['carboneum'][symbols[i]][req.query.exchange]
            });
          }
        }
      }

      const interval = exchange[req.query.exchange].allowInterval('1d');

      for (let i = 0; i < symbolList.length; i++) {
        klineListPromise.push(
          exchange[req.query.exchange].klines(
            symbolList[i].exchangeName, interval, undefined, undefined, 7, next
          ));
      }

      try {
        const klineList = await Promise.all(klineListPromise);

        for (let i = 0; i < klineList.length; i++) {
          const lastDateClose = new Decimal(klineList[i][klineList[i].length - 1][4]);
          const beforeLastDateClose = new Decimal(klineList[i][klineList[i].length - 2][4]);
          const change = lastDateClose.minus(beforeLastDateClose);

          // noinspection JSUnresolvedFunction
          result.push({
            symbol: symbolList[i].symbol,
            change: change.toString(),
            percentChange: change.dividedBy(beforeLastDateClose).mul(new Decimal('100')).toFixed(3) + '%',
            fullName: await redis.hgetAsync('fullName', symbolList[i].symbol.split('/')[0]),
            price: formatWithRemoveZero(lastDateClose),
            prices: klineList[i],
          });
        }

        redis.setex(cacheKey, 60, JSON.stringify(result));
        res.send(result);
      } catch (e) {
        return next(e)
      }
    } else {
      next(new ExchangeError('Exchange not found!', 9000));
    }
  } else {
    res.send(Object.keys(symbol['carboneum']));
  }
});

module.exports = router;