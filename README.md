# Quickmatch

Lightning fast real-time data percolation engine, featuring a full-fledged [DSL](http://docs.kuzzle.io/kuzzle-dsl/), including geofencing capabilities.

This is the engine used by [Kuzzle](http://kuzzle.io/), an open-source and self-hostable backend, to handle real-time notifications.

**Table of contents:**

  - [Introduction](#introduction)
  - [Index and collection parameters](#index-and-collection-parameters)
  - [Filter unique identifier](#filter-unique-identifier)
  - [API](#api)
    - [`constructor`](#constructor)
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

This can be described by the following Kuzzle DSL filters: 

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
const Quickmatch = require('quickmatch');

const engine = new Quickmatch();

const filters = {
    geoDistance: {
        position: {
            lat: 43.6073913, 
            lon: 3.9109057
        },
        distance: "500m"
    }
};

// More on index/collection parameters later
engine.register('index', 'collection', filters)
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

## Index and collection parameters

Though it can be used in a variety of ways, most use cases for a data percolation engine imply to put it on top of some kind of storage database, dealing with large quantities of data.  
And the most common way to store data in a database (relational, NoSQL or whatnot), is in some kind of collection of data, regrouped in data indexes.

Even though this engine can be instantiated multiple times just fine, each instance has a constant overhead cost which may quickly adds up.

To allow using this engine on top of databases, with dozens or even hundreds of collections and/or indexes, Quickmatch emulates that kind of structure, making it able to handle large numbers of indexed filters, dispatched across a complex storage system.

Using different `index` and `collection` parameters will make Quickmatch effectively act as if it was looking for data in a database.

If you do not need different indexes and/or collections, just use constants, as in the above example.

## Filter unique identifier

Filter identifiers are unique hashes, dependant on the following:

* filters in their [canonicalized form](https://en.wikipedia.org/wiki/Canonicalization)
* the index and collection parameters (see [above](#index-and-collection-parameters))
* a random seed (see the engine's [constructor](#constructor) documentation)

This means that:

* filter identifiers are predictable, given that the same random seed is supplied to each new Quickmatch instance
* since filters are transformed into a canonical form before a filter identifier is calculated, equivalent yet differently written filters will produce the same identifier

**Example:**

In the following example, we provide a fixed random seed. Replaying this example will always generate the same result:

```js
const Quickmatch = require('quickmatch');

const 
    seed = Buffer.from('ac1bb751a1e5b3dce4a5d58e3e5e317677f780f57f8ca27b624345808b3e0e86', 'hex'),
    engine = new Quickmatch({seed});

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

## API

### `constructor`

**constructor([options])**

[TODO]

### `exists`

Returns a boolean indicating if filters exist for an index-collection pair

**exists(index, collection)**

##### Arguments

| Name | Type | Description                      |
|------|------|----------------------------------|
|`index`|`string`| Data index name |
|`collection`|`string`| Data collection name |


##### Returns

Returns `true` if at least one filter exists on the provided index-collection pair, returns `false` otherwise


### `getFilterIds`

Returns the identifiers of filters registered on an index-collection pair

**getFilterIds(index, collection)**

##### Arguments

| Name | Type | Description                      |
|------|------|----------------------------------|
|`index`|`string`| Data index name |
|`collection`|`string`| Data collection name |

##### Returns

An `array` of filter unique identifiers corresponding to filters registered on the provided index-collection pair.

### `normalize`

Returns a promise resolved if the provided filters are well-formed.  
The resolved object is a normalized and optimized version of the supplied filters, along with its corresponding filter unique identifier.

This method does not modify the internal storage. To register the filters, the [store](#storenormalized) method must be called afterwards.  
If you do not need the filter unique identifier prior to register the filters, then consider using the all-in-one [register](#registerindex-collection-filters) method instead.

**normalize(index, collection, filters)**

##### Arguments

| Name | Type | Description                      |
|------|------|----------------------------------|
|`index`|`string`| Data index name |
|`collection`|`string`| Data collection name |
|`filters`|`object`| Filters in [Kuzzle DSL](http://docs.kuzzle.io/kuzzle-dsl) format |

##### Returns

A `promise` resolving to an object containing the following attributes:

* `index`: data index name
* `collection`: data collection name
* `normalized`: an object containing the optimized version of the supplied filters
* `id`: the filter unique identifier

### `register`

Registers a filter to the engine instance. This method is equivalent to executing [normalize](#normalizeindex-collection-filters) + [store](#storenormalized).

**register(index, collection, filters)**

##### Arguments

| Name | Type | Description                      |
|------|------|----------------------------------|
|`index`|`string`| Data index name |
|`collection`|`string`| Data collection name |
|`filters`|`object`| Filters in [Kuzzle DSL](http://docs.kuzzle.io/kuzzle-dsl) format |

##### Returns

A `promise` resolving to an object containing the following attributes:

* `id`: the filter unique identifier
* `diff`: `false` if the filter already existed in the engine. Otherwise, contains an object with the canonical version of the provided filters

### `remove`

Removes all references to a given filter from the engine.

**remove(filterId)**

##### Arguments

| Name | Type | Description                      |
|------|------|----------------------------------|
|`filterId`|`string`| Filter unique ID. Obtained by using `register`|

##### Returns

A `promise` resolved once the filter has been completely removed from the engine.


### `store`

Registers normalized filters (obtained with [normalize](#normalizeindex-collection-filters)).

**store(normalized)**

##### Arguments

| Name | Type | Description                      |
|------|------|----------------------------------|
|`normalized`|`Object`| Normalized filters |

##### Returns

An `Object` containing the following attributes:

* `id`: the filter unique identifier
* `diff`: `false` if the filter already existed in the engine. Otherwise, contains an object with the canonical version of the provided filters

### `test`

Test data against filters registered in the engine, returning matching filter IDs, if any.

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

### `validate`

Tests the provided filters without storing them in the system, to check whether they are well-formed or not.

**validate(filters)**

##### Arguments

| Name | Type | Description                      |
|------|------|----------------------------------|
|`filters`|`object`| Filters in [Kuzzle DSL](http://docs.kuzzle.io/kuzzle-dsl) format |

##### Returns

A resolved promise if the provided filters are valid, or a rejected one with the appropriate error object otherwise.
