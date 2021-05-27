[![Build Status](https://travis-ci.org/kuzzleio/koncorde.svg?branch=master)](https://travis-ci.org/kuzzleio/koncorde)
[![Codecov](http://codecov.io/github/kuzzleio/koncorde/coverage.svg?branch=master)](http://codecov.io/github/kuzzleio/koncorde?branch=master)
[![Code Quality: Javascript](https://img.shields.io/lgtm/grade/javascript/g/kuzzleio/koncorde.svg?logo=lgtm&logoWidth=18)](https://lgtm.com/projects/g/kuzzleio/koncorde/context:javascript)
[![Total Alerts](https://img.shields.io/lgtm/alerts/g/kuzzleio/koncorde.svg?logo=lgtm&logoWidth=18)](https://lgtm.com/projects/g/kuzzleio/koncorde/alerts)

# Koncorde

Supersonic real-time data percolation engine, featuring a set of [terms](https://docs.kuzzle.io/koncorde/1/essentials/terms/) and [operands](https://docs.kuzzle.io/koncorde/1/essentials/operands/) to build fine-grained filters, including geofencing capabilities.

This is the engine used by [Kuzzle](http://kuzzle.io/), an open-source and self-hostable backend, to handle real-time notifications and data validations.

**Table of contents:**

  - [Introduction](#introduction)
  - [Install](#install)
  - [Index and collection parameters](#index-and-collection-parameters)
  - [Filter unique identifier](#filter-unique-identifier)
  - [Field syntax](#field-syntax)
  - [Filter operands](#filter-operands)
    - [`and`](#and)
    - [`bool`](#bool)
    - [`not`](#not)
    - [`or`](#or)
  - [Filter terms](#filter-terms)
    - [`equals`](#equals)
    - [`exists`](#exists)
    - [`geoBoundingBox`](#geoBoundingBox)
    - [`geoDistance`](#geoDistance)
    - [`geoDistanceRange`](#geoDistanceRange)
    - [`geoPolygon`](#geoPolygon)
    - [`ids`](#ids)
    - [`in`](#in)
    - [`missing`](#missing)
    - [`range`](#range)
    - [`regexp`](#regexp)
  - [API](#api)
    - [`constructor`](#constructor)
    - [`convertDistance`](#convertdistance)
    - [`convertGeopoint`](#convertgeopoint)
    - [`exists`](#exists-1)
    - [`getCollections`](#getcollections)
    - [`getFilterIds`](#getfilterids)
    - [`getIndexes`](#getindexes)
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

In other words, this is the reverse of a search engine, where data are indexed, and filters are used to retrieve the matching data.

**Example:**

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
const result = engine.register('index', 'collection', filter);

// The filter identifier depends on a random seed (see below)
// For now, let's pretend its value is 5db7052792b18cb2
console.log(`Filter identifier: ${result.id}`);

// *** Now, let's test data with our engine ***

// Returns: [] (distance is greater than 500m)
console.log(engine.test('index', 'collection', {
  position: {
    lat: 43.6073913,
    lon: 5.7,
  },
}));

// Returns: ['5db7052792b18cb2']
console.log(engine.test('index', 'collection', {
  position: {
    lat: 43.608,
    lon: 3.905,
  },
}));


// Returns: [] (the geopoint is not stored in a "position" field)
console.log(engine.test('index', 'collection', {
  point: {
    lat: 43.608,
    lon: 3.905,
  },
}));
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

const seed = Buffer.from(
  'ac1bb751a1e5b3dce4a5d58e3e5e317677f780f57f8ca27b624345808b3e0e86', 
  'hex');
const engine = new Koncorde({seed});

// filter1 and filter2 are equivalent
const filter1 = {
  and: [
    { equals: { firstname: 'Grace' } },
    { exists: { field: 'hobby' } },
  ]
};
const filter2 = {
  not: {
    bool: {
      should_not: [
        { in: { firstname: [ 'Grace' ] } },
        { exists: { field: 'hobby' } },
      ],
    },
  },
};

const subscription1 = engine.register('index', 'collection', filter1);
const subscription2 = engine.register('index', 'collection', filter2);

// Prints:
// Filter ID 1: b4ee9ece4d7b1398, Filter ID 2: b4ee9ece4d7b1398, Equals: true
console.log(`Filter ID 1: ${subscription1.id}, Filter ID 2: ${subscription2.id}, Equals: ${subscription1.id === subscription2.id}`);
```

## Field syntax

The examples so far show how to test for scalar fields at the root of a document, but it is also possible to test nested properties or array values.

### Nested properties

To test for a nested property, a path to it must be supplied, in the following manner: `path.to.property`

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

### Array values

A few keywords, like [exists](#exists) or [missing](#missing), allow searching for array values.  

These values can be accessed with the following syntax: `<array path>[<value>]`  
Only one array value per `exists`/`missing` keyword can be searched in this manner.

Array values must be scalars (strings, numbers, booleans or `null`), following JSON format:

* Strings: the value must be enclosed in double quotes. Example: `foo["string value"]`
* Numbers, booleans and the null value must be used as is. Examples: `foo[3.14]`, `foo[false]`, `foo[null]`


Array values can be combined with [nested properties](#nested-properties): `nested.array["value"]`

**Example:**

Given the following document:

```json
{
    "name": {
        "first": "Grace",
        "last": "Hopper",
        "hobbies": ["compiler", "COBOL"]
    }
}
```

Here is a filter, testing whether the value `compiler` is listed in the array `hobbies`:

```json
{
    "exists": "name.hobbies[\"compiler\"]"
}
```

## Filter operands

### and
The `and` filter takes an array of filter objects, combining them with AND operands.

#### Syntax

`and: <array>`

#### Example

Given the following documents:

```javascript
{
  firstName: 'Grace',
  lastName: 'Hopper',
  city: 'NYC',
  hobby: 'computer'
},
{
  firstName: 'Ada',
  lastName: 'Lovelace',
  city: 'London',
  hobby: 'computer'
}
```

The following filter validates the first document:

```javascript
{
  and: [
    { equals: { city: 'NYC' } },
    { equals: { hobby: 'computer' } }
  ]
}
```

### bool

A filter matching documents matching boolean combinations of other queries.

This operand accepts at least one of the following attributes:

* `must` all listed conditions must be `true`
* `must_not` all listed conditions must be `false`
* `should` one of the listed condition must be `true`
* `should_not` one of the listed condition must be `false`


#### Syntax

```
bool: {
  [must]: <array>,
  [must_not]: <array>,
  [should]: <array>,
  [should_not]: <array>
}
```

#### Example

Given the following documents:

```javascript
{
  firstName: 'Grace',
  lastName: 'Hopper',
  age: 85,
  city: 'NYC',
  hobby: 'computer'
},
{
  firstName: 'Ada',
  lastName: 'Lovelace',
  age: 36
  city: 'London',
  hobby: 'computer'
},
{
  firstName: 'Marie',
  lastName: 'Curie',
  age: 55,
  city: 'Paris',
  hobby: 'radium'
}
```

The following filter validates the second document:

```javascript
{
  bool: {
    must : [
      { in : { firstName : ['Grace', 'Ada'] } },
      { range: { age: { gte: 36, lt: 85 } } }
    ],
    'must_not' : [
      { equals: { city: 'NYC' } }
    ],
    should : [
      { equals : { hobby : 'computer' } },
      { exists : 'lastName' }
    ]
  }
}
```

### not

The `not` filter reverts a filter result.

#### Syntax

`not: <object>`

#### Example

Given the following documents:

```javascript
{
  firstName: 'Grace',
  lastName: 'Hopper',
  city: 'NYC',
  hobby: 'computer'
},
{
  firstName: 'Ada',
  lastName: 'Lovelace',
  city: 'London',
  hobby: 'computer'
}
```

The following filter validates the first document:

```javascript
{
  not: { equals: { city: 'London' } }
}
```

### or

The `or` filter takes an array containing filter objects, combining them using OR operands.

#### Syntax

`or: <array>`

#### Example

Given the following documents:

```javascript
{
  firstName: 'Grace',
  lastName: 'Hopper',
  city: 'NYC',
  hobby: 'computer'
},
{
  firstName: 'Ada',
  lastName: 'Lovelace',
  city: 'London',
  hobby: 'computer'
},
{
  firstName: 'Marie',
  lastName: 'Curie',
  city: 'Paris',
  hobby: 'radium'
}
```

The following filter validates the first two documents:

```javascript
{
  or: [
    { equals: { city: 'NYC' } },
    { equals: { city: 'London' } }
  ]
}
```

## Filter terms

### equals

Matches attributes using strict equality.  
The tested attribute must be a scalar (number, string or boolean), and of the same type than the provided filter value.

#### Syntax

```
equals: {
  <field name>: <value>
}
```

#### Example

Given the following documents:

```javascript
{
  firstName: 'Grace',
  lastName: 'Hopper'
},
{
  firstName: 'Ada',
  lastName: 'Lovelace'
}
```

The following filter validates the first document:

```javascript
{
  equals: { firstName: 'Grace' }
}
```

### exists

Test for the existence of a key in an object, or of a scalar in an array.  

#### Syntax

`exists: 'nested.field.path'`
(see [nested field syntax](#nested-properties))

`exists: 'nested.array[value]'`
(see [array value syntax])(#array-values)

The following syntax is deprecated since Koncorde 1.2, and supported for backward compatibility only:

`exists: { field: 'nested.field.path' }`


#### Example

Given the following documents:

```javascript
{
  firstName: 'Grace',
  lastName: 'Hopper',
  city: 'NYC',
  hobby: ['compiler', 'COBOL'],
  alive: false
},
{
  firstName: 'Ada',
  lastName: 'Lovelace',
  city: 'London',
  hobby: ['programming', 'algorithm']
}
```

The following filter validates the first document:

```javascript
{
  exists: 'alive'
}
```

And this filter validates the second document:

```javascript
{
  exists: 'hobby["algorithm"]'
}
```

### geoBoundingBox

Filter documents containing a geographical point confined within a provided bounding box:

![Illustration of geoBoundingBox](http://docs.kuzzle.io/assets/images/geolocation/geoBoundingBox.png)

A bounding box is a 2D box that can be defined using either of the following formats:

* 2 geopoints, defining the top left (`topLeft` or `top_left`) and bottom right (`bottomRight` or `bottom_right`) corners of the box
* 4 distinct values defining the 4 box corners: `top` and `bottom` are latitudes, `left` and `right` are longitudes

The bounding box description must be stored in an attribute, named after the geographical point to be tested in future documents.

#### Syntax

```
geoBoundingBox: { 
  <geopoint field name>: {
    <bounding box description>
  } 
}
```

#### Bounding box description

All of the following syntaxes below are accepted, and they describe the same bounding box, with the following properties:

* top-left corner of latitude `43.5810609` and longitude `3.8433703`
* bottom-right corner of latitude `43.6331979` and longitude `3.9282093`

```javascript
{
  top: 43.5810609,
  left: 3.8433703,
  bottom: 43.6331979,
  right: 3.9282093
}
```

```javascript
{
  topLeft: { lat: 43.5810609, lon: 3.8433703 },
  bottomRight: { lat: 43.6331979, lon: 3.9282093 }
}
```

```javascript
{
  top_left: "43.5810609, 3.8433703",
  bottom_right: "43.6331979, 3.9282093"
}
```

#### Example

Given the following documents:

```javascript
{
  firstName: 'Grace',
  lastName: 'Hopper',
  location: {
    lat: 32.692742,
    lon: -97.114127
  }
},
{
  firstName: 'Ada',
  lastName: 'Lovelace',
  location: {
    lat: 51.519291,
    lon: -0.149817
  }
}
```

The following filter will match the second document only:

```javascript
{
  geoBoundingBox: {
    location: {
      top: -2.939744,
      left: 52.394484,
      bottom: 1.180129,
      right: 51.143628
    }
  }
}
```

### geoDistance

Filter documents containing a geographical point, whose position is within a distance radius centered around a provided point of origin:

![Illustration of geoDistance](http://docs.kuzzle.io/assets/images/geolocation/geoDistance.png)

A `geoDistance` filter contains the following properties:

* a [geopoint](https://docs.kuzzle.io/koncorde/1/essentials/geofencing/#geopoints) defining the point of origin. This geopoint attribute must be named after the geographical point to test in future documents
* a `distance` parameter in [geodistance format](https://docs.kuzzle.io/koncorde/1/essentials/geofencing/#geodistances)

#### Syntax

```
geoDistance: {
  <geopoint field name>: {
    <geopoint description>
  },
  distance: <geodistance>
}
```

#### Example

Given the following documents:

```javascript
{
  firstName: 'Grace',
  lastName: 'Hopper',
  location: {
    lat: 32.692742,
    lon: -97.114127
  }
},
{
  firstName: 'Ada',
  lastName: 'Lovelace',
  location: {
    lat: 51.519291,
    lon: -0.149817
  }
}
```

The following filter will match the second document only:

```javascript
{
  geoDistance: {
    location: {
      lat: 51.5029017,
      lon: -0.1606903
    },
    distance: '10km'
  }
}
```

### geoDistanceRange

Filter documents containing a geographical point, whose position is within a distance range from a given point of origin:

![Illustration of geoDistanceRange](http://docs.kuzzle.io/assets/images/geolocation/geoDistanceRange.png)

A `geoDistanceRange` filter contains the following properties:

* a [geopoint](https://docs.kuzzle.io/koncorde/1/essentials/geofencing/#geopoints) defining the center point of the distance range. This geopoint attribute must be named after the geographical point to test in future documents
* a `from` attribute, describing the minimum distance from the center point, using a [geodistance format](https://docs.kuzzle.io/koncorde/1/essentials/geofencing/#geodistances)
* a `to` attribute, describing the maximum distance from the center point, using a [geodistance format](https://docs.kuzzle.io/koncorde/1/essentials/geofencing/#geodistances)

#### Syntax

```
geoDistanceRange: {
  <geopoint field name>: {
    <geopoint description>
  },
  from: <geodistance>,
  to: <geodistance>
}
```

#### Example

Given the following documents:

```javascript
{
  firstName: 'Grace',
  lastName: 'Hopper',
  location: {
    lat: 32.692742,
    lon: -97.114127
  }
},
{
  firstName: 'Ada',
  lastName: 'Lovelace',
  location: {
    lat: 51.519291,
    lon: -0.149817
  }
}
```

The following filter will match the second document only:

```javascript
{
  geoDistanceRange: {
    location: [51.5029017, -0.1606903],
    from: '1km',
    to: '10 kilometers'
  }
}
```

### geoPolygon

Filter documents containing a geographical point, confined within a polygon of an arbitrary number of sides:

![Illustration of geoPolygon](http://docs.kuzzle.io/assets/images/geolocation/geoPolygon.png)

A `geoPolygon` filter is described using an array of [geopoints](https://docs.kuzzle.io/koncorde/1/essentials/geofencing/#geopoints) (at least 3).

Koncorde automatically closes geopolygons.

Different geopoint formats can be used to describe different corners of a polygon.

You can use http://geojson.io/ to draw your polygons on a map and then export the corresponding coordinates.

#### Syntax

```
geoPolygon: {
  <geopoint field name>: {
    points: <geopoints array>
  }
}
```

#### Example

Given the following documents:

```javascript
{
  firstName: 'Grace',
  lastName: 'Hopper',
  location: {
    lat: 32.692742,
    lon: -97.114127
  }
},
{
  firstName: 'Ada',
  lastName: 'Lovelace',
  location: {
    lat: 51.519291,
    lon: -0.149817
  }
}
```

The following filter will match the second document only:

```javascript
{
  geoPolygon: {
    location: {
      points: [
        { lat: 51.523029, lon: -0.160793 },
        [51.522842, -0.145043],
        '51.518303, -0.146116',
        { latLon: {lat: 51.516487, lon: -0.162295 }},
        'gcpvh6uxh60x1'
      ]
    }
  }
}
```

### ids

This filter returns only documents having their unique document ID listed in the provided list.

#### Syntax

`ids: <array of strings>`

#### Example

Given the following documents:

```javascript
{
  _id: 'a',
  firstName: 'Grace',
  lastName: 'Hopper'
},
{
  _id: 'b',
  firstName: 'Ada',
  lastName: 'Lovelace'
},
{
  _id: 'c',
  firstName: 'Marie',
  lastName: 'Curie'
}
```

The following filter validates first document:

```javascript
{
  ids: {
    values: ['a']
  }
}
```

### in

Like [equals](#equals), but accepts an array of possible scalar values to be tested.

#### Syntax

`in: { <field name>: <array of values> }`

#### Example

Given the following documents:

```javascript
{
  firstName: 'Grace',
  lastName: 'Hopper'
},
{
  firstName: 'Ada',
  lastName: 'Lovelace'
},
{
  firstName: 'Marie',
  lastName: 'Curie'
}
```

The following filter validates the first two documents:

```javascript
{
  in: { firstName: ['Grace', 'Ada'] }
}
```

### missing

A filter matching documents either with a missing field in an object, or with a missing value in an array.

#### Syntax

`missing: 'nested.field.path'`
(see [nested field syntax](#nested-properties))

`missing: 'nested.array[value]'`
(see [array value syntax])(#array-values)

The following syntax is deprecated since Koncorde 1.2, and supported for backward compatibility only:

`missing: { field: 'nested.field.path' }`


#### Example

Given the following documents:

```javascript
{
  firstName: 'Grace',
  lastName: 'Hopper',
  city: 'NYC',
  hobbies: ['compiler', 'COBOL'],
  alive: false
},
{
  firstName: 'Ada',
  lastName: 'Lovelace',
  city: 'London',
  hobbies: ['algorithm', 'programming'],
}
```

The following filter validates the second document:

```javascript
{
  missing: 'alive'
}
```

And this filter validates the first document: 

```javascript
{
  missing: 'hobbies["algorithm"]'
}
```

### range

Filters documents with number attributes within a provided interval.

A range can be defined with at least one of the following arguments:

* `gte`: Greater-than or equal to `<number>`
* `gt`: Greater-than `<number>`
* `lte`: Less-than or equal to
* `lt`: Less-than

Ranges can be either bounded or half-bounded.

#### Syntax 

```
range: {
  <field to be tested>: {
    [gte]: <number>,
    [gt]: <number>,
    [lte]: <number>,
    [lt]: <number>
  }
}
```

#### Example

Given the following documents:

```javascript
{
  firstName: 'Grace',
  lastName: 'Hopper',
  age: 85,
  city: 'NYC',
  hobby: 'computer'
},
{
  firstName: 'Ada',
  lastName: 'Lovelace',
  age: 36
  city: 'London',
  hobby: 'computer'
},
{
  firstName: 'Marie',
  lastName: 'Curie',
  age: 55,
  city: 'Paris',
  hobby: 'radium'
}
```

The following filter validates the last two documents:

```javascript
{
  range: {
    age: {
      lt: 85
    }
  }
}
```

### regexp

The `regexp` filter matches attributes using either [RE2](https://github.com/google/re2) (by default), or [PCREs](https://en.wikipedia.org/wiki/Perl_Compatible_Regular_Expressions).

#### Syntax

A `regexp` filter has the following structure, splitting the usual `/pattern/flags` into two parts:

```javascript
regexp: {
  <field name>: {
    value: '<search pattern>',
    flags: '<modifier flags>'
  }
}
```

If you don't need any modifier flag, then you may also use the following simplified form:

```javascript
  regexp: {
    <field name>: '<search pattern>'
  }
```

#### Example

Given the following documents:

```javascript
{
  firstName: 'Grace',
  lastName: 'Hopper'
},
{
  firstName: 'Ada',
  lastName: 'Lovelace'
}
```

The following filter validates the first document:

```javascript
{
  regexp: {
    firstName: {
      value: '^g\w+',
      flags: 'i'
    }
  }
}
```

## API

### `constructor`

Instantiates a new Koncorde engine.

**constructor([options])**

#### Arguments

| Name | Type | Description                      |
|------|------|----------------------------------|
|`options`|`Object`| Optional parameters |

#### Options

| Name | Type | Default |Description                      |
|------|------|---------|---------------------------------|
|`maxMinTerms`| `Number` | `256` | The maximum number of conditions a filter can hold after being canonicalized in its [CDNF](https://en.wikipedia.org/wiki/Canonical_normal_form) form. It is advised to test performance and memory consumption impacts before increasing this value. If set to 0, no limit is applied. |
|`seed`|`Buffer`| fixed | 32 bytes buffer containing a fixed random seed. |
| `regExpEngine` | `String` | `re2` | Set the engine to either [re2](https://github.com/google/re2) or [js](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/RegExp). The former is not fully compatible with PCREs, while the latter is vulnerable to [catastrophic backtracking](https://www.regular-expressions.info/catastrophic.html), making it unsafe if regular expressions are provided by outside clients |

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

#### Arguments

| Name | Type | Description                      |
|------|------|----------------------------------|
|`str`|`string`| Distance to convert |

#### Returns

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

#### Arguments

| Name | Type | Description                      |
|------|------|----------------------------------|
|`point`|`object`| Geopoint to convert |

#### Returns

A `Coordinate` object containing the following properties: `lat` (latitude, type: number), `lon` (longitude, type: number)

---

### `exists`

Returns a boolean indicating if filters exist for a given index-collection pair

**exists(index, collection)**

#### Arguments

| Name | Type | Description                      |
|------|------|----------------------------------|
|`index`|`string`| Data index name |
|`collection`|`string`| Data collection name |


#### Returns

Returns `true` if at least one filter exists on the provided index-collection pair, returns `false` otherwise

---

### `getCollections`

Returns the list of collections associated to an index registered in this Koncorde instance

**getCollections(index)**

#### Arguments

| Name | Type | Description                      |
|------|------|----------------------------------|
|`index`|`string`| Data index name |

#### Returns

An `array` of collection names.

---

### `getFilterIds`

Returns the list of filter identifiers registered on a given index-collection pair

**getFilterIds(index, collection)**


#### Arguments

| Name | Type | Description                      |
|------|------|----------------------------------|
|`index`|`string`| Data index name |
|`collection`|`string`| Data collection name |

#### Returns

An `array` of filter unique identifiers corresponding to filters registered on the provided index-collection pair.

---

### `getIndexes`

Returns the list of indexes registered in this Koncorde instance

**getIndexes()**

#### Returns

An `array` of index names.

---

### `normalize`

Returns an object containing the provided filter in its canonical form, along with the corresponding filter unique identifier.

This method does not modify the internal storage. To save a filter, the [store](#store) method must be called afterward.
If you do not need the filter unique identifier prior to save a filter in the engine, then consider using the all-in-one [register](#register) method instead.

**normalize(index, collection, filter)**

#### Arguments

| Name | Type | Description                      |
|------|------|----------------------------------|
|`index`|`string`| Data index name |
|`collection`|`string`| Data collection name |
|`filter`|`object`| A filter in [Koncorde format](https://docs.kuzzle.io/koncorde/1) |

#### Returns

An object containing the following attributes:

* `index`: data index name
* `collection`: data collection name
* `normalized`: an object containing the canonical form of the supplied filter
* `id`: the filter unique identifier

---

### `register`

Registers a filter to the engine instance. This method is equivalent to executing [normalize](#normalize) + [store](#store).

**register(index, collection, filter)**

#### Arguments

| Name | Type | Description                      |
|------|------|----------------------------------|
|`index`|`string`| Data index name |
|`collection`|`string`| Data collection name |
|`filter`|`object`| A filter in [Koncorde format](https://docs.kuzzle.io/koncorde/1) |

#### Returns

An object containing the following attributes:

* `id`: the filter unique identifier
* `diff`: `false` if the filter already exists in the engine. Otherwise, contains an object with the canonical version of the provided filter

---

### `remove`

Removes all references to a given filter from the engine.

**remove(filterId)**

#### Arguments

| Name | Type | Description                      |
|------|------|----------------------------------|
|`filterId`|`string`| Filter unique ID. Obtained by using `register`|

---

### `store`

Stores a normalized filter (obtained with [normalize](#normalize)).

**store(normalized)**

#### Arguments

| Name | Type | Description                      |
|------|------|----------------------------------|
|`normalized`|`Object`| Normalized filter |

#### Returns

An `Object` containing the following attributes:

* `id`: the filter unique identifier
* `diff`: `false` if the filter already exists in the engine. Otherwise, contains an object with the canonical version of the provided filter

---

### `test`

Test data against filters registered in the engine, returning matching filter identifiers, if any.

**test(index, collection, data, [id])**

#### Arguments

| Name | Type | Description                      |
|------|------|----------------------------------|
|`index`|`string`| Data index name |
|`collection`|`string`| Data collection name |
|`data`|`object`| Data to test against filters |
|`id`|`string`| If applicable, data unique ID (to use with the [ids](https://docs.kuzzle.io/koncorde/1/essentials/terms/#ids)) filter term |


#### Returns

An array of filter identifiers matching the provided data (and/or documentId, if any).

---

### `validate`

Tests the provided filter without storing it in the engine, to check whether it is well-formed or not.

**validate(filter)**

#### Arguments

| Name | Type | Description                      |
|------|------|----------------------------------|
|`filter`|`object`| A filter in [Koncorde format](https://docs.kuzzle.io/koncorde/1) |

#### Returns

Throws with an appropriate error if the provided filter is invalid.

---

## Benchmarks

The following results are obtained running `node benchmark.js` at the root of the projet.

```
> Benchmarking keyword: equals
  Indexation: time = 0.357s, mem = +42MB
  Matching x 1,738,037 ops/sec ±0.28% (94 runs sampled)
  Filters removal: time = 0.022s

> Benchmarking keyword: exists
  Indexation: time = 0.374s, mem = +23MB
  Matching x 1,526,909 ops/sec ±0.72% (97 runs sampled)
  Filters removal: time = 0.026s

> Benchmarking keyword: geoBoundingBox
  Indexation: time = 0.674s, mem = +-26MB
  Matching x 878,760 ops/sec ±0.45% (93 runs sampled)
  Filters removal: time = 0.095s

> Benchmarking keyword: geoDistance
  Indexation: time = 1.094s, mem = +12MB
  Matching x 727,164 ops/sec ±0.60% (95 runs sampled)
  Filters removal: time = 0.104s

> Benchmarking keyword: geoDistanceRange
  Indexation: time = 1.53s, mem = +-16MB
  Matching x 872,478 ops/sec ±0.50% (96 runs sampled)
  Filters removal: time = 0.095s

> Benchmarking keyword: geoPolygon (10 vertices)
  Indexation: time = 1.039s, mem = +21MB
  Matching x 33,889 ops/sec ±0.34% (96 runs sampled)
  Filters removal: time = 0.105s

> Benchmarking keyword: in (5 random values)
  Indexation: time = 1.089s, mem = +17MB
  Matching x 1,498,878 ops/sec ±0.43% (95 runs sampled)
  Filters removal: time = 0.057s

> Benchmarking keyword: range (random bounds)
  Indexation: time = 0.304s, mem = +14MB
  Matching x 35,926 ops/sec ±0.37% (95 runs sampled)
  Filters removal: time = 0.071s
```

_(results obtained with node v12.12.0)_
