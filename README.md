# Quickmatch

Lightning fast real-time data percolation engine, featuring a full-fledged [DSL](http://docs.kuzzle.io/kuzzle-dsl/), including geofencing capabilities.

This is the engine used by [Kuzzle](http://kuzzle.io/), an open-source and self-hostable backend, to handle real-time notifications.

**Table of contents:**

  - [Introduction](#introduction)
  - [How to use](#how-to-use)
  - [API](#api)
    - [`exists(index, collection)`](#existsindex-collection)
    - [`getRoomIds(index, collection)`](#getroomidsindex-collection)
    - [`normalize(index, collection, filters)`](#normalizeindex-collection-filters)
    - [`register(index, collection, filters)`](#registerindex-collection-filters)
    - [`remove(roomId)`](#removeroomid)
    - [`store(normalized)`](#storenormalized)
    - [`test(index, collection, data, [documentId])`](#testindex-collection-data-documentid)
    - [`validate(filters)`](#validatefilters)


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
        // The room identifier depends on a random seed (see below)
        // For now, let's pretend its value is 5db7052792b18cb2
        console.log(`Room identifier: ${result.id}`);

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


## How to use

[TODO]

## API

### `exists(index, collection)`

Returns a boolean indicating if filters exist for an index-collection pair

##### Arguments

| Name | Type | Description                      |
|------|------|----------------------------------|
|`index`|`string`| Data index name |
|`collection`|`string`| Data collection name |


##### Returns

Returns `true` if at least one filter exists on the provided index-collection pair, returns `false` otherwise


### `getRoomIds(index, collection)`

Returns the identifiers of rooms registered on an index-collection pair


##### Arguments

| Name | Type | Description                      |
|------|------|----------------------------------|
|`index`|`string`| Data index name |
|`collection`|`string`| Data collection name |

##### Returns

An `array` of room unique identifiers corresponding to filters registered on the provided index-collection pair.

### `normalize(index, collection, filters)`

Returns a promise resolved if the provided filters are well-formed.  
The resolved object is a normalized and optimized version of the supplied filters, along with its corresponding Room unique identifier.

This method does not modify the internal storage. To register the filters, the [store](#storenormalized) method must be called afterwards.  
If you do not need the Room unique identifier prior to register the filters, then consider using the all-in-one [register](#registerindex-collection-filters) method instead.

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
* `id`: the room unique identifier

### `register(index, collection, filters)`

Registers a filter to the engine instance. This method is equivalent to executing [normalize](#normalizeindex-collection-filters) + [store](#storenormalized).

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

### `remove(roomId)`

Removes all references to a given filter from the engine.

##### Arguments

| Name | Type | Description                      |
|------|------|----------------------------------|
|`roomId`|`string`| Room unique ID. Obtained by using `register`|

##### Returns

A `promise` resolved once the filter has been completely removed from the engine.


### `store(normalized)`

Registers normalized filters (obtained with [normalize](#normalizeindex-collection-filters)).

##### Arguments

| Name | Type | Description                      |
|------|------|----------------------------------|
|`normalized`|`Object`| Normalized filters |

##### Returns

An `Object` containing the following attributes:

* `id`: the filter unique identifier
* `diff`: `false` if the filter already existed in the engine. Otherwise, contains an object with the canonical version of the provided filters

### `test(index, collection, data, [id])`

Test data against filters registered in the engine, returning matching room IDs, if any.

##### Arguments

| Name | Type | Description                      |
|------|------|----------------------------------|
|`index`|`string`| Data index name |
|`collection`|`string`| Data collection name |
|`data`|`object`| Data to test against filters |
|`id`|`string`| If applicable, data unique ID (to use with the [ids](http://docs.kuzzle.io/kuzzle-dsl/terms/ids/)) filter term |


##### Returns

An array of room identifiers matching the provided data (and/or documentId, if any).

### `validate(filters)`

Tests the provided filters without storing them in the system, to check whether they are well-formed or not.

##### Arguments

| Name | Type | Description                      |
|------|------|----------------------------------|
|`filters`|`object`| Filters in [Kuzzle DSL](http://docs.kuzzle.io/kuzzle-dsl) format |

##### Returns

A resolved promise if the provided filters are valid, or a rejected one with the appropriate error object otherwise.
