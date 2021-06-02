import { JSONObject } from './types/JSONObject';
declare class NormalizedFilter {
    filter: any;
    id: string;
    index: string | null;
    constructor(normalized: any, id: string, index: string | null);
}
export interface KoncordeOptions {
    maxMinTerms: number;
    regExpEngine: string;
    seed: ArrayBuffer;
}
export declare class Koncorde {
    private engines;
    private config;
    private transformer;
    /**
     * @param {Object} config   */
    constructor(config?: KoncordeOptions);
    /**
     * Checks if the provided filter is valid
     *
     * @param {Object} filter
     * @throws
     */
    validate(filter: JSONObject): void;
    /**
     * Subscribes an unoptimized filter to the real-time engine.
     * Identical to a call to normalize() + store()
     *
     * Returns the filter unique identifier
     *
     * @param {Object} filter
     * @param {String} [index] - Index name
     * @return {String}
     */
    register(filter: JSONObject, index?: string): string;
    /**
     * Returns an optimized version of the provided filter, with
     * its associated filter unique ID.
     * Does not store anything in the filters structures.
     * The returned object can either be used with store(), or discarded.
     *
     * @param  {Object} filter
     * @param  {String} [index] name
     * @return {NormalizedFilter}
     */
    normalize(filter: JSONObject, index?: string): NormalizedFilter;
    /**
     * Stores a normalized filter.
     * A normalized filter is obtained using a call to normalize()
     *
     * Returns the filter unique identifer
     *
     * @param  {NormalizedFilter} normalized - Obtained with a call to normalize()
     * @return {String}
     */
    store(normalized: NormalizedFilter): string;
    /**
     * Returns all indexed filter IDs
     *
     * @param {String} [index] name
     * @returns {Array.<String>} Array of matching filter IDs
     */
    getFilterIds(index?: string): string[];
    /**
     * Returns the list of named indexes
     *
     * @return {Array.<String>}
     */
    getIndexes(): string[];
    /**
     * Check if a filter identifier is known by Koncorde
     *
     * @param {String} filterId
     * @param {String} [index] name
     * @returns {Boolean}
     */
    hasFilterId(filterId: string, index?: string): boolean;
    /**
     * Test data against filters in the filters tree to get the matching
     * filters ID, if any
     *
     * @param {Object} data to test filters on
     * @param {String} [index] name
     * @return {Array} list of matching filters
     */
    test(data: JSONObject, index?: string): string[];
    /**
     * Removes all references to a given filter from the real-time engine
     *
     * @param {String} filterId - ID of the filter to remove
     * @param {String} [index] name
     */
    remove(filterId: string, index?: string): void;
    /**
     * Converts a distance string value to a number of meters
     * @param {string} distance - client-provided distance
     * @returns {number} converted distance
     */
    static convertDistance(distance: string): number;
    /**
     * Converts one of the accepted geopoint format into
     * a standardized version
     *
     * @param {Object} obj - object containing a geopoint
     * @returns {Coordinate} or null if no accepted format is found
     */
    static convertGeopoint(point: string | JSONObject): {
        lat: number;
        lon: number;
    };
}
export {};
