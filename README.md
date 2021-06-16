[![Codecov](http://codecov.io/github/kuzzleio/koncorde/coverage.svg?branch=master)](http://codecov.io/github/kuzzleio/koncorde?branch=master)
[![Code Quality: Javascript](https://img.shields.io/lgtm/grade/javascript/g/kuzzleio/koncorde.svg?logo=lgtm&logoWidth=18)](https://lgtm.com/projects/g/kuzzleio/koncorde/context:javascript)
[![Total Alerts](https://img.shields.io/lgtm/alerts/g/kuzzleio/koncorde.svg?logo=lgtm&logoWidth=18)](https://lgtm.com/projects/g/kuzzleio/koncorde/alerts)

# Koncorde

This module is a reverse-search engine.

Instead of indexing data and searching for them using filters, Koncorde does the opposite: it indexes search filters, and returns the corresponding ones when presented with data.

* an arbitrary large number of filters can be registered and indexed;
* whenever data are submitted to Koncorde, it returns the list of indexed filters matching them;
* Koncorde's [filter syntax](https://github.com/kuzzleio/koncorde/wiki/Filter-Syntax) supports a variety of different matchers, and ways to combine them.

Koncorde can be used in a variety of ways. For instance:

* as a base of a notification system, where indexed filters are used as user subscriptions: Koncorde tells which JSON objects verify what subscriptions, making it easy to send events to listening users; 
* to verify if JSON objects comply to filters used as validation rules.

Check our [full documentation](https://github.com/kuzzleio/koncorde/wiki) to know more about Koncorde's API, filter syntax, and more.


# Quick start example

In the following example, we'll listen to objects containing a `position` property, describing a geopoint. We want that geopoint to be 500 meters around a pre-defined starting position.

This can be described by the following Koncorde filter:

```json
{
    "geoDistance": {
        "position": {
            "lat": 43.6073913,
            "lon": 3.9109057
        },
        "distance": "500m"
    }
}
```

All you need to do now is to register this filter to the engine, and use it to test data:

```js
import { Koncorde } from 'koncorde';

const engine = new Koncorde();

const filter = {
    geoDistance: {
        position: {
            lat: 43.6073913,
            lon: 3.9109057
        },
        distance: "500m"
    }
};

const filterId = engine.register(filter);

// Filter Identifiers are seeded. Given the same seed (to be provided to the
// constructor), then the filter IDs stay stable.
console.log(`Filter identifier: ${filterId}`);

// No match found, returns an empty array (distance is greater than 500m)
console.log(engine.test({ position: { lat: 43.6073913, lon: 5.7 } }));

// Point within the filter's scope: returns the list of matched filters
// Here we registered just one of them, so the array contains only 1 filter ID
console.log(engine.test({ position: { lat: 43.608, lon: 3.905 } }));

// No match found, returns an empty array 
// (the geopoint in the provided data is not stored in the tested field)
console.log(engine.test({ not_position: { lat: 43.608, lon: 3.905 } }));
```

# Install

This library is compatible with Node.js version 12.x or higher.
Both a C and a C++ compilers are needed to install its dependencies: Koncorde cannot be used in a browser.

Koncorde is compatible with either Javascript or Typescript projects.

To install:

```
npm install koncorde
```


## Benchmarks

The following results are obtained running `node benchmark.js` at the root of the projet.

```
Filter count per tested keyword: 10000

> Benchmarking keyword: equals
  Indexation: time = 0.255s, mem = +39MB
  Matching x 10,320,209 ops/sec ±0.70% (95 runs sampled)
  Filters removal: time = 0.018s

> Benchmarking keyword: exists
  Indexation: time = 0.285s, mem = +20MB
  Matching x 5,047,932 ops/sec ±0.23% (97 runs sampled)
  Filters removal: time = 0.021s

> Benchmarking keyword: geoBoundingBox
  Indexation: time = 0.685s, mem = +-8MB
  Matching x 1,322,528 ops/sec ±0.52% (94 runs sampled)
  Filters removal: time = 0.092s

> Benchmarking keyword: geoDistance
  Indexation: time = 1.052s, mem = +3MB
  Matching x 1,656,882 ops/sec ±0.65% (96 runs sampled)
  Filters removal: time = 0.094s

> Benchmarking keyword: geoDistanceRange
  Indexation: time = 1.551s, mem = +20MB
  Matching x 1,344,257 ops/sec ±2.83% (90 runs sampled)
  Filters removal: time = 0.101s

> Benchmarking keyword: geoPolygon (5 vertices)
  Indexation: time = 0.818s, mem = +-74MB
  Matching x 112,091 ops/sec ±0.54% (97 runs sampled)
  Filters removal: time = 0.098s

> Benchmarking keyword: in (5 random values)
  Indexation: time = 0.974s, mem = +90MB
  Matching x 3,579,507 ops/sec ±2.93% (92 runs sampled)
  Filters removal: time = 0.058s

> Benchmarking keyword: range (random bounds)
  Indexation: time = 0.276s, mem = +-72MB
  Matching x 122,311 ops/sec ±1.28% (96 runs sampled)
  Filters removal: time = 0.074s
```

_(results obtained with node v16.2.0)_
