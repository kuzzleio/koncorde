/*
 * Kuzzle, a backend software, self-hostable and ready to use
 * to power modern apps
 *
 * Copyright 2015-2017 Kuzzle
 * mailto: support AT kuzzle.io
 * website: http://kuzzle.io
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * https://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

class CacheStorage {
  constructor(ItemConstructor) {
    this._cache = new Map();
    this._ItemConstructor = ItemConstructor;
  }

  add (index, collection) {
    const collections = this._cache.get(index);
    let items;

    if (!collections) {
      items = new this._ItemConstructor();
      this._cache.set(index, new Map([[collection, items]]));
    }
    else {
      items = collections.get(collection);

      if (!items) {
        items = new this._ItemConstructor();
        collections.set(collection, items);
      }
    }

    return items;
  }

  has (index, collection, key) {
    const collections = this._cache.get(index);

    if (collections) {
      const items = collections.get(collection);

      return items !== undefined && (!key || items.has(key));
    }

    return false;
  }

  getIndexes () {
    return Array.from(this._cache.keys());
  }

  getCollections (index) {
    const collections = this._cache.get(index);

    return collections ? Array.from(collections.keys()) : [];
  }

  getValues (index, collection) {
    const collections = this._cache.get(index);

    if (collections) {
      const items = collections.get(collection);

      if (items) {
        return Array.from(items.keys());
      }
    }

    return [];
  }

  remove (index, collection, key) {
    const collections = this._cache.get(index);

    if (!collections) {
      return;
    }

    const items = collections.get(collection);

    if (!items) {
      return;
    }

    if (items.size === 1) {
      if (collections.size === 1) {
        this._cache.delete(index);
      }
      else {
        collections.delete(collection);
      }
    }
    else {
      items.delete(key);
    }
  }
}

class CacheSet extends CacheStorage {
  constructor() {
    super(Set);
  }

  /** @override */
  add (index, collection, value) {
    const items = super.add(index, collection);

    items.add(value);
  }
}

class CacheMap extends CacheStorage {
  constructor() {
    super(Map);
  }

  /** @override */
  add (index, collection, key, value) {
    const items = super.add(index, collection);

    items.set(key, value);
  }


  get (index, collection, key) {
    const collections = this._cache.get(index);

    if (collections) {
      const items = collections.get(collection);

      if (items) {
        return items.get(key);
      }
    }

    return undefined;
  }
}

module.exports = { CacheMap, CacheSet };
