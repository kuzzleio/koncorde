# Quickmatch

Lightning fast real-time matching engine, featuring a full-fledged [DSL](http://docs.kuzzle.io/kuzzle-dsl/), including geofencing capabilities.

This is the real-time engine used by [Kuzzle](http://kuzzle.io/), an open-source and self-hostable backend.

**Table of contents:**

  - [Introduction](#introduction)
  - [How to use](#how-to-use)
  - [API](#api)
    - [`exists(index, collection)`](#existsindex-collection)
    - [`getFilterIds(index, collection)`](#getfilteridsindex-collection)
    - [`normalize(index, collection, filters)`](#normalizeindex-collection-filters)
    - [`register(index, collection, filters)`](#registerindex-collection-filters)
    - [`remove(filterId)`](#removefilterid)
    - [`store(normalized)`](#storenormalized)
    - [`test(index, collection, data, [documentId])`](#testindex-collection-data-documentid)
    - [`validate(filters)`](#validatefilters)


## Introduction

[TODO]


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


### `getFilterIds(index, collection)`

Retrieves filter IDs registered on an index-collection pair


##### Arguments

| Name | Type | Description                      |
|------|------|----------------------------------|
|`index`|`string`| Data index name |
|`collection`|`string`| Data collection name |

##### Returns

An `array` of `filterId` corresponding to filters registered on an index-collection pair.

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

### `remove(filterId)`

Removes all references to a given filter from the engine.

##### Arguments

| Name | Type | Description                      |
|------|------|----------------------------------|
|`filterId`|`string`| Filter unique ID. Obtained by using `register`|

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

An array of `filterId` matching the provided data (and/or documentId, if any).

### `validate(filters)`

Tests the provided filters without storing them in the system, to check whether they are well-formed or not.

##### Arguments

| Name | Type | Description                      |
|------|------|----------------------------------|
|`filters`|`object`| Filters in [Kuzzle DSL](http://docs.kuzzle.io/kuzzle-dsl) format |

##### Returns

A resolved promise if the provided filters are valid, or a rejected one with the appropriate error object otherwise.
