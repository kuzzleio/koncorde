[![Build Status](https://travis-ci.org/kuzzleio/koncorde.svg?branch=master)](https://travis-ci.org/kuzzleio/koncorde)
[![Codecov](http://codecov.io/github/kuzzleio/koncorde/coverage.svg?branch=master)](http://codecov.io/github/kuzzleio/koncorde?branch=master)

# Koncorde

Supersonic real-time data percolation engine, featuring a full-fledged [DSL](http://docs.kuzzle.io/kuzzle-dsl/), including geofencing capabilities.

This is the engine used by [Kuzzle](http://kuzzle.io/), an open-source and self-hostable backend, to handle real-time notifications and data validations.

**Table of contents:**

  - [Introduction](#introduction)
  - [Install](#install)
  - [Index and collection parameters](#index-and-collection-parameters)
  - [Filter unique identifier](#filter-unique-identifier)
  - [Testing nested properties](#testing-nested-properties)
  - [API](#api)
    - [`constructor`](#constructor)
    - [`convertDistance`](#convertdistance)
    - [`convertGeopoint`](#convertgeopoint)
    - [`exists`](#exists)
    - [`getFilterIds`](#getfilterids)
    - [`normalize`](#normalize)
    - [`register`](#register)
    - [`remove`](#remove)
    - [`store`](#store)
    - [`test`](#test)
    - [`validate`](#validate)
  - [Benchmarks](#benchmarks)


## Introduction

This library is a real-time data percolation engine: 

* an arbitrary number of filters can be registered and indexed
* whenever data are submitted to this engine, it returns the list of registered filters matching them

In other words, this is the reverse of a search engine, where data are indexed, and filters are used to retrieved the matching data.

**Example:**

In the following example, we'll listen to objects containing a `position` property, describing a geopoint. We want that geopoint to be 500 meters around a pre-defined starting position.

This can be described by the following Kuzzle DSL filter: 

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
const Koncorde = require('koncorde');

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

// More on index/collection parameters later
engine.register('index', 'collection', filter)
    .then(result => {
        // The filter identifier depends on a random seed (see below)
        // For now, let's pretend its value is 5db7052792b18cb2
        console.log(`Filter identifier: ${result.id}`);

        // *** Now, let's test data with our engine ***

        // Returns: [] (distance is greater than 500m)
        console.log(engine.test('index', 'collection', {
            position: {
                lat: 43.6073913, 
                lon: 5.7
            }
        }));

        // Returns: ['5db7052792b18cb2']
        console.log(engine.test('index', 'collection', {
            position: {
                lat: 43.608, 
                lon: 3.905
            }
        }));


        // Returns: [] (the geopoint is not stored in a "position" field)
        console.log(engine.test('index', 'collection', {
            point: {
                lat: 43.608, 
                lon: 3.905
            }
        }));
    });
```

## Install

This library can only be used with NodeJS version 6.x or higher.  
Both a C and a C++ compilers are needed to install the following dependencies: [Espresso Logic Minimizer](https://www.npmjs.com/package/espresso-logic-minimizer) and [Boost Geospatial Index](https://www.npmjs.com/package/boost-geospatial-index)

To install:

```
npm install --save koncorde
```


## Index and collection parameters

Though it can be used in a variety of ways, most use cases for a data percolation engine imply to put it on top of some kind of storage database, dealing with large quantities of data.  
And the most common way to store data in a database (relational, NoSQL or whatnot), is in some kind of collection of data, regrouped in data indexes.

Even though this engine can be instantiated multiple times just fine, each instance has a constant overhead cost which may quickly add up.

To allow using this engine on top of databases, with dozens or even hundreds of collections and/or indexes, Koncorde emulates that kind of structure, making it able to handle large numbers of indexed filters, dispatched across a complex storage system.

Using different `index` and `collection` parameters will make Koncorde effectively act as if it was looking for data in a database.

If you do not need different indexes and/or collections, just use constants, as in the above example.

## Filter unique identifier

Filter identifiers are unique hashes, dependant on the following:

* filters in their [canonicalized form](https://en.wikipedia.org/wiki/Canonicalization)
* the index and collection parameters (see [above](#index-and-collection-parameters))
* a seed (see the engine's [constructor](#constructor) documentation)

This means that:

* filter identifiers are predictable, as long that the same random seed is supplied to each new Koncorde instance
* since filters are transformed into a canonical form before a filter identifier is calculated, equivalent yet differently written filters will produce the same identifier

**Example:**

In the following example, we provide a fixed random seed. Replaying this example will always generate the same result:

```js
const Koncorde = require('koncorde');

const 
    seed = Buffer.from('ac1bb751a1e5b3dce4a5d58e3e5e317677f780f57f8ca27b624345808b3e0e86', 'hex'),
    engine = new Koncorde({seed});

// filter1 and filter2 are equivalent
const
    filter1 = {
        and:[
            {equals: {firstname: 'Grace'}},
            {exists: {field: 'hobby'}}
        ]
    },
    filter2 = {
        not: {
            bool: {
                should_not: [
                    {in: {firstname: ['Grace']}},
                    {exists: {field: 'hobby'}}
                ]
            }
        }
    };

let filterId1;

engine.register('index', 'collection', filter1)
    .then(result => {
        filterId1 = result.id;
        return engine.register('index', 'collection', filter2);
    })
    .then(result => {
        console.log(`Filter ID 1: ${filterId1}, Filter ID 2: ${result.id}, Equals: ${filterId1 === result.id}`);
    });

// Prints:
// Filter ID 1: b4ee9ece4d7b1398, Filter ID 2: b4ee9ece4d7b1398, Equals: true
```

## Testing nested properties

The examples so far show how to test for fields at the root of provided data, but it is also possible to add filters on nested properties.

To do that, instead of giving the name of the property to test, its path must be supplied, in the following manner: `path.to.property`

**Example:**

Given the following document:

```json
{
    "name": {
        "first": "Grace",
        "last": "Hopper"
    }
}
```

Here is a filter, testing equality on the field `last` in the `name` sub-object:

```json
{
    "equals": {
        "name.last": "Hopper"
    }
}
```

Full code:

```js
const Koncorde = require('koncorde');

const
  engine = new Koncorde(),
  filter = {
    equals: {
      'name.last': 'Hopper'
    }
  };

engine.register('index', 'collection', filter)
  .then(result => {
    // Prints: 'a_filter_id'
    console.log(`Filter ID: ${result.id}`);

    // Prints: []
    console.log(engine.test('index', 'collection', {
      name: {
        first: 'Ada',
        last: 'Lovelace'
      }
    }));

    // Prints: ['a_filter_id']
    console.log(engine.test('index', 'collection', {
      name: {
        first: 'Grace',
        last: 'Hopper'
      }
    }));

    // Prints: [] (searched field not at the right place)
    console.log(engine.test('index', 'collection', {
      identification: {
        first: 'Grace',
        last: 'Hopper'
      }
    }));
  });
```


## API

### `constructor`

Instantiates a new Koncorde engine.

**constructor([options])**

##### Arguments

| Name | Type | Description                      |
|------|------|----------------------------------|
|`options`|`Object`| Optional parameters |

##### Options

| Name | Type | Default |Description                      |
|------|------|---------|---------------------------------|
|`maxMinTerms`| `Number` | `256` | The maximum number of conditions a filter can hold after being canonicalized in its [CDNF](https://en.wikipedia.org/wiki/Canonical_normal_form) form. It is advised to test performance and memory consumption impacts before increasing this value. If set to 0, no limit is applied.
|`seed`|`Buffer`| fixed | 32 bytes buffer containing a fixed random seed. 

---

### `convertDistance`

**(static method)**

Utility method converting a distance value to meters.

Accepted units:

* `m`, `meter`, `meters`
* `ft`, `feet`, `feets`
* `in`, `inch`, `inches`
* `yd`, `yard`, `yards`
* `mi`, `mile`, `miles`

Accepted unit modifiers: from `yocto-` (10e-21) to `yotta-` (10e24), and their corresponding short forms (e.g. `kilometers` or `km`)

Accepted formats: `<int (spaces accepted)>[.|,]<decimal><spaces><unit>`.  

Examples:

```js
const Koncorde = require('koncorde');

// Prints: 4.88442
console.log(Koncorde.convertDistance('192.3in'));

// Prints: 3456580
console.log(Koncorde.convertDistance('3 456,58 kilometers'));
```

**convertDistance(str)**

##### Arguments

| Name | Type | Description                      |
|------|------|----------------------------------|
|`str`|`string`| Distance to convert |

##### Returns

The distance converted in meters (type: number)

---

### `convertGeopoint`

**(static method)**

Converts one of the accepted geopoint format into the following standardized version:

```json
{
    "lat": 12.345,
    "lon": 67.890
}
```

Accepted input formats (with latitude = `43.6021299` and longitude = `3.8989713`):

* `[ 43.6021299, 3.8989713 ]`
* `"43.6021299, 3.8989713"`
* `"spfb09x0ud5s"` ([geohash](https://en.wikipedia.org/wiki/Geohash))
* `{ lat: 43.6021299, lon: 3.8989713 }`

Alternative:

* `{ latLon: [ 43.6021299, 3.8989713 ] }`
* `{ latLon: { lat: 43.6021299, lon: 3.8989713 } }`
* `{ latLon: "43.6021299, 3.8989713" }`
* `{ latLon: "spfb09x0ud5s"}` ([geohash](https://en.wikipedia.org/wiki/Geohash))

Also accepted:

* `{ lat_lon: [ 43.6021299, 3.8989713 ] }`
* `{ lat_lon: { lat: 43.6021299, lon: 3.8989713 } }`
* `{ lat_lon: "43.6021299, 3.8989713" }`
* `{ lat_lon: "spfb09x0ud5s"}` ([geohash](https://en.wikipedia.org/wiki/Geohash))


Example:

```js
const Koncorde = require('koncorde');

// Prints: Coordinate { lat: 43.6021299, lon: 3.8989713 }
console.log(Koncorde.convertGeopoint('spfb09x0ud5s'));
```

**convertGeopoint(point)**

##### Arguments

| Name | Type | Description                      |
|------|------|----------------------------------|
|`point`|`object`| Geopoint to convert |

##### Returns

A `Coordinate` object containing the following properties: `lat` (latitude, type: number), `lon` (longitude, type: number)

---

### `exists`

Returns a boolean indicating if filters exist for a given index-collection pair

**exists(index, collection)**

##### Arguments

| Name | Type | Description                      |
|------|------|----------------------------------|
|`index`|`string`| Data index name |
|`collection`|`string`| Data collection name |


##### Returns

Returns `true` if at least one filter exists on the provided index-collection pair, returns `false` otherwise

---

### `getFilterIds`

Returns the list of filter identifiers registered on a given index-collection pair

**getFilterIds(index, collection)**

##### Arguments

| Name | Type | Description                      |
|------|------|----------------------------------|
|`index`|`string`| Data index name |
|`collection`|`string`| Data collection name |

##### Returns

An `array` of filter unique identifiers corresponding to filters registered on the provided index-collection pair.

---

### `normalize`

Returns a promise resolved if the provided filter are well-formed.  
The resolved object contains the provided filter in its canonical form, along with the corresponding filter unique identifier.

This method does not modify the internal storage. To save a filter, the [store](#store) method must be called afterward.  
If you do not need the filter unique identifier prior to save a filter in the engine, then consider using the all-in-one [register](#register) method instead.

**normalize(index, collection, filter)**

##### Arguments

| Name | Type | Description                      |
|------|------|----------------------------------|
|`index`|`string`| Data index name |
|`collection`|`string`| Data collection name |
|`filter`|`object`| A filter in [Kuzzle DSL](http://docs.kuzzle.io/kuzzle-dsl) format |

##### Returns

A `promise` resolving to an object containing the following attributes:

* `index`: data index name
* `collection`: data collection name
* `normalized`: an object containing the canonical form of the supplied filter
* `id`: the filter unique identifier

---

### `register`

Registers a filter to the engine instance. This method is equivalent to executing [normalize](#normalize) + [store](#store).

**register(index, collection, filter)**

##### Arguments

| Name | Type | Description                      |
|------|------|----------------------------------|
|`index`|`string`| Data index name |
|`collection`|`string`| Data collection name |
|`filter`|`object`| A filter in [Kuzzle DSL](http://docs.kuzzle.io/kuzzle-dsl) format |

##### Returns

A `promise` resolving to an object containing the following attributes:

* `id`: the filter unique identifier
* `diff`: `false` if the filter already exists in the engine. Otherwise, contains an object with the canonical version of the provided filter

---

### `remove`

Removes all references to a given filter from the engine.

**remove(filterId)**

##### Arguments

| Name | Type | Description                      |
|------|------|----------------------------------|
|`filterId`|`string`| Filter unique ID. Obtained by using `register`|

##### Returns

A `promise` resolved once the filter has been completely removed from the engine.

---

### `store`

Stores a normalized filter (obtained with [normalize](#normalize)).

**store(normalized)**

##### Arguments

| Name | Type | Description                      |
|------|------|----------------------------------|
|`normalized`|`Object`| Normalized filter |

##### Returns

An `Object` containing the following attributes:

* `id`: the filter unique identifier
* `diff`: `false` if the filter already exists in the engine. Otherwise, contains an object with the canonical version of the provided filter

---

### `test`

Test data against filters registered in the engine, returning matching filter identifiers, if any.

**test(index, collection, data, [id])**

##### Arguments

| Name | Type | Description                      |
|------|------|----------------------------------|
|`index`|`string`| Data index name |
|`collection`|`string`| Data collection name |
|`data`|`object`| Data to test against filters |
|`id`|`string`| If applicable, data unique ID (to use with the [ids](http://docs.kuzzle.io/kuzzle-dsl/terms/ids/)) filter term |


##### Returns

An array of filter identifiers matching the provided data (and/or documentId, if any).

---

### `validate`

Tests the provided filter without storing it in the engine, to check whether it is well-formed or not.

**validate(filter)**

##### Arguments

| Name | Type | Description                      |
|------|------|----------------------------------|
|`filter`|`object`| A filter in [Kuzzle DSL](http://docs.kuzzle.io/kuzzle-dsl) format |

##### Returns

A resolved promise if the provided filter is valid, or a rejected one with the appropriate error object otherwise.

---

## Benchmarks

The following results are obtained running `node benchmark.js` at the root of the projet.

```
Filter count per tested keyword: 10000

> Benchmarking keyword: equals
    Registration: time = 0.647s, mem = +42MB
    Matching x 92,270 ops/sec ±5.91% (50 runs sampled)

> Benchmarking keyword: exists
    Registration: time = 2.223s, mem = +15MB
    Matching x 3,169 ops/sec ±1.50% (56 runs sampled)

> Benchmarking keyword: geoBoundingBox
    Registration: time = 1.572s, mem = +50MB
    Matching x 57,731 ops/sec ±3.36% (38 runs sampled)

> Benchmarking keyword: geoDistance
    Registration: time = 2.145s, mem = +16MB
    Matching x 41,764 ops/sec ±0.50% (33 runs sampled)

> Benchmarking keyword: geoDistanceRange
    Registration: time = 2.744s, mem = +27MB
    Matching x 39,031 ops/sec ±0.90% (28 runs sampled)

> Benchmarking keyword: geoPolygon (10 vertices)
    Registration: time = 2.657s, mem = +26MB
    Matching x 15,847 ops/sec ±9.65% (48 runs sampled)

> Benchmarking keyword: in (5 random values)
    Registration: time = 3.238s, mem = +164MB
    Matching x 7,654 ops/sec ±7.76% (12 runs sampled)

> Benchmarking keyword: range (random bounds)
    Registration: time = 1.074s, mem = +3MB
    Matching x 18,291 ops/sec ±0.46% (93 runs sampled)
```

_(results obtained with node v6.10)_
