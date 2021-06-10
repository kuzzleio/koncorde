[![Build Status](https://travis-ci.org/kuzzleio/koncorde.svg?branch=master)](https://travis-ci.org/kuzzleio/koncorde)
[![Codecov](http://codecov.io/github/kuzzleio/koncorde/coverage.svg?branch=master)](http://codecov.io/github/kuzzleio/koncorde?branch=master)
[![Code Quality: Javascript](https://img.shields.io/lgtm/grade/javascript/g/kuzzleio/koncorde.svg?logo=lgtm&logoWidth=18)](https://lgtm.com/projects/g/kuzzleio/koncorde/context:javascript)
[![Total Alerts](https://img.shields.io/lgtm/alerts/g/kuzzleio/koncorde.svg?logo=lgtm&logoWidth=18)](https://lgtm.com/projects/g/kuzzleio/koncorde/alerts)

# Koncorde

Supersonic reverse-matching engine.

**Table of Contents**

- [Koncorde](#koncorde)
  - [Introduction](#introduction)
  - [Install](#install)
  - [Filter unique identifier](#filter-unique-identifier)
  - [Indexes](#indexes)
  - [Field syntax](#field-syntax)
    - [Nested properties](#nested-properties)
    - [Array values](#array-values)
  - [Filter operands](#filter-operands)
    - [and](#and)
    - [bool](#bool)
    - [not](#not)
    - [or](#or)
  - [Filter terms](#filter-terms)
    - [equals](#equals)
    - [exists](#exists)
    - [geoBoundingBox](#geoboundingbox)
    - [geoDistance](#geodistance)
    - [geoDistanceRange](#geodistancerange)
    - [geoPolygon](#geopolygon)
    - [in](#in)
    - [missing](#missing)
    - [range](#range)
    - [regexp](#regexp)
  - [API](#api)
    - [`constructor`](#constructor)
    - [`convertDistance`](#convertdistance)
    - [`convertGeopoint`](#convertgeopoint)
    - [`getFilterIds`](#getfilterids)
    - [`getIndexes`](#getindexes)
    - [`hasFilterId`](#hasfilterid)
    - [`normalize`](#normalize)
    - [`register`](#register)
    - [`remove`](#remove)
    - [`store`](#store)
    - [`test`](#test)
    - [`validate`](#validate)
  - [Benchmarks](#benchmarks)


## Introduction

This module is a reverse-matching engine.

Instead of indexing data and searching for them using filters, Koncorde does the opposite: it indexes search filters, and returns the corresponding ones when presented with data.

* an arbitrary large number of filters can be registered and indexed;
* whenever data are submitted to Koncorde, it returns the list of indexed filters matching them.

Koncorde can be used in a variety of ways. For instance:

* as a base of a notification system, where indexed filters are used as user subscriptions: Koncorde tells which JSON objects verify what subscriptions, making it easy to send events to listening users; 
* to verify if JSON objects comply to filters used as validation rules.

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

// The filter identifier depends on a random seed (see below)
// For now, let's pretend its value is 5db7052792b18cb2
console.log(`Filter identifier: ${filterId}`);

// *** Now, let's test data with our engine ***

// Returns: [] (distance is greater than 500m)
console.log(engine.test({ position: { lat: 43.6073913, lon: 5.7 } }));

// Returns: ['5db7052792b18cb2']
console.log(engine.test({ position: { lat: 43.608, lon: 3.905 } }));


// Returns: [] (the geopoint is not stored in a "position" field)
console.log(engine.test({ point: { lat: 43.608, lon: 3.905 } }));
```

## Install

This library can only be used with NodeJS version 12.x or higher.
Both a C and a C++ compilers are needed to install its dependencies: Koncorde cannot be used in a browser.

To install:

```
npm install --save koncorde
```

Koncorde is compatible with either Javascript or Typescript projects.

## Filter unique identifier

Filter identifiers are unique hashes, dependant on the following:

* filters in their [canonicalized form](https://en.wikipedia.org/wiki/Canonicalization)
* a seed (see the engine's [constructor](#constructor) documentation)
* (OPTIONAL) the index scope (see [Indexes](#indexes))

This means that:

* filter identifiers are predictable, as long that the same random seed is supplied to each new Koncorde instance
* since filters are transformed into a canonical form before a filter identifier is calculated, equivalent yet differently written filters will produce the same identifier

**Example:**

In the following example, we provide a fixed random seed. Replaying this example will always generate the same result:

```js
import { Koncorde } from 'koncorde';

const seed = Buffer.from(
  'ac1bb751a1e5b3dce4a5d58e3e5e317677f780f57f8ca27b624345808b3e0e86', 
  'hex');
const engine = new Koncorde({ seed });

// filter1 and filter2 are equivalent
const filterId1 = engine.register({
  and: [
    { equals: { firstname: 'Grace' } },
    { exists: { field: 'hobby' } },
  ]
});

const filterId2 = engine.register({
  not: {
    bool: {
      should_not: [
        { in: { firstname: [ 'Grace' ] } },
        { exists: { field: 'hobby' } },
      ],
    },
  },
});

// Prints:
// Filter ID 1: 9505a284900033238b609b77e575c51f, Filter ID 2: 9505a284900033238b609b77e575c51f, Equals: true
console.log(`Filter ID 1: ${filterId1}, Filter ID 2: ${filterId2}, Equals: ${filterId1 === filterId2}`);
```

## Indexes

By default, Koncorde stores filters in an unnamed index.

Multiple indexes can be used to store and match filters in an independant way, using the `index` option.  

This option can be used to organize filters in different, independant search scopes.


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

![Illustration of geoBoundingBox](https://docs.kuzzle.io/geolocation/geoBoundingBox.png)

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

![Illustration of geoDistance](https://docs.kuzzle.io/geolocation/geoDistance.png)

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

![Illustration of geoDistanceRange](https://docs.kuzzle.io/geolocation/geoDistanceRange.png)

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

![Illustration of geoPolygon](https://docs.kuzzle.io/geolocation/geoPolygon.png)

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

```ts
constructor(options: KoncordeOptions = null)
```

#### Arguments

| Name | Type | Description                      |
|------|------|----------------------------------|
|`options`|`KoncordeOptions`| Optional parameters |

#### Options

`KoncordeOptions` is an interface exposed by the Koncorde module, with the following properties:

| Name | Type | Default |Description                      |
|------|------|---------|---------------------------------|
|`maxConditions`| `Number` | `50` | The maximum number of conditions a filter can hold. It is advised to test performances and memory consumption impacts before increasing this value. If set to 0, no limit is applied. |
|`seed`|`Buffer`| fixed | 32 bytes buffer containing a fixed random seed. |
| `regExpEngine` | `String` | `re2` | Set the engine to either [re2](https://github.com/google/re2) or [js](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/RegExp). The former is not fully compatible with PCREs, while the latter is vulnerable to [catastrophic backtracking](https://www.regular-expressions.info/catastrophic.html), making it unsafe if regular expressions are provided by end-users. |

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

```typescript
import { Koncorde } from 'koncorde';

// Prints: 4.88442
console.log(Koncorde.convertDistance('192.3in'));

// Prints: 3456580
console.log(Koncorde.convertDistance('3 456,58 kilometers'));
```

```ts
convertDistance(distance: string): number
```

#### Arguments

| Name | Type | Description                      |
|------|------|----------------------------------|
|`distance`|`string`| Distance to convert |

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

```ts
import { Koncorde } from 'koncorde';

// Prints: Coordinate { lat: 43.6021299, lon: 3.8989713 }
console.log(Koncorde.convertGeopoint('spfb09x0ud5s'));
```

```ts
convertGeopoint(point: string|JSONObject): { lat: number; lon: number; }
```

#### Arguments

| Name | Type | Description                      |
|------|------|----------------------------------|
|`point`|`object`| Geopoint to convert |

#### Returns

An object containing the following properties: `lat` (latitude, type: number), `lon` (longitude, type: number)

---

### `getFilterIds`

Returns the list of registered filter identifiers.

```ts
getFilterIds (index: string = null): string[]
```


#### Arguments

| Name | Type | Description                      |
|------|------|----------------------------------|
|`index`|`string`| (OPTIONAL) Index name. Uses the default one if none is provided  |

#### Returns

An `array` of filter unique identifiers corresponding to filters registered on the provided index-collection pair.

---

### `getIndexes`

Returns the list of named indexes registered in this Koncorde instance

```ts
getIndexes (): string[]
```

#### Returns

An `array` of index names.

---

### `hasFilterId`

Tells whether a filter identifier is known by Koncorde.

```ts
hasFilterId (filterId: string, index: string = null): boolean
```

| Name | Type | Description                      |
|------|------|----------------------------------|
|`filterId`|`string`| Filter unique identifier |
|`index`|`string`| (OPTIONAL) Index name. Uses the default one if none is provided  |


---

### `normalize`

Verifies and normalizes a search filter.

This method does not modify the internal storage. To save a filter, the [store](#store) method must be called afterward.

If you do not need the filter unique identifier prior to save a filter in the engine, then consider using the all-in-one [register](#register) method instead.

```ts
normalize(filter: JSONObject, index: string = null): NormalizedFilter
```

#### Arguments

| Name | Type | Description                      |
|------|------|----------------------------------|
|`filter`|`object`| Search filters in Koncorde format |
|`index`|`string`| (OPTIONAL) Index name. Uses the default one if none is provided  |

#### Returns

An object containing the following attributes:

* `id`: filter unique identifier
* `index`: index name
* `filter`: a complex structure containing the canonical form of the supplied filter

---

### `register`

Registers a search filter in Koncorde. This method is equivalent to executing [normalize](#normalize) + [store](#store).

```ts
register (filter: JSONObject, index: string = null): string
```

#### Arguments

| Name | Type | Description                      |
|------|------|----------------------------------|
|`filter`|`object`| Search filters in Koncorde format |
|`index`|`string`| (OPTIONAL) Index name. Uses the default one if none is provided |

#### Returns

A string representing the filter identifier.

---

### `remove`

Removes a filter from an index.

```ts
remove (filterId: string, index: string = null): void
```

#### Arguments

| Name | Type | Description                      |
|------|------|----------------------------------|
|`filterId`|`string`| Filter unique ID. Obtained by using `register`|
|`index` | `string` | (OPTIONAL) Index name. Uses the default one if none is provided |

---

### `store`

Stores a normalized filter (obtained with [normalize](#normalize)).

```ts
store (normalized: NormalizedFilter): string
```

#### Arguments

| Name | Type | Description                      |
|------|------|----------------------------------|
|`normalized`|`Object`| Normalized filter, obtained with [normalize](#normalize) |

#### Returns

A string representing the filter identifier.

---

### `test`

Test data against filters registered in the engine, returning matching filter identifiers, if any.

This method only tests filters in the targeted index: if no index name is provided, only filters pertaining to the default index will be tested.

```ts
test (data: JSONObject, index: string = null): string[]
```

#### Arguments

| Name | Type | Description                      |
|------|------|----------------------------------|
|`data`|`object`| Data to test against filters |
|`index`|`string`| (OPTIONAL) Index name. Uses the default one if none is provided |


#### Returns

An array of filter identifiers matching the provided data (and/or documentId, if any).

---

### `validate`

Tests the provided filter without storing it in the engine, to check whether it is well-formed or not.

```ts
validate (filter: JSONObject): void
```

#### Arguments

| Name | Type | Description                      |
|------|------|----------------------------------|
|`filter`|`object`| A filter in Koncorde format |

#### Returns

Throws with an appropriate error if the provided filter is invalid.

---

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
