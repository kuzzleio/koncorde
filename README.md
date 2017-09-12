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

All there is to do is now to register this filter to the engine, and use it to test data:

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

This library can only be used with NodeJS version 6.9 or higher.  
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
* a random seed (see the engine's [constructor](#constructor) documentation)

This means that:

* filter identifiers are predictable, given that the same random seed is supplied to each new Koncorde instance
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
|`maxConditions`| `Number` | `8` | The maximum conditions a filter can hold. It is not advised to use a value greater than `15` without testing filter registration and matching performances |
|`seed`|`Buffer`| Randomly generated seed | 32 bytes buffer containing a fixed random seed |

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

Accepted input formats:

* `{ lat: -74.1, lon: 40.73 }`
* `{ latLon: [ -74.1, 40.73 ] }`
* `{ latLon: { lat: 40.73, lon: -74.1 } }`
* `{ latLon: "40.73, -74.1" }`
* `{ latLon: "dr5r9ydj2y73"}` ([geohash](https://en.wikipedia.org/wiki/Geohash))


Example:

```js
const Koncorde = require('koncorde');

// Prints: Coordinate { lat: 40.72999987984076, lon: -74.09999997122213 }
console.log(Koncorde.convertGeopoint({latLon: 'dr5r9ydj2y734'}))
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
