import { JSONObject } from '../types/JSONObject';
/**
 * Exposes a sets of methods meant to store operands in
 * the Koncorde keyword-specific part of a field-operand  object
 *
 * @class OperandsStorage
 * */
export declare class OperandsStorage {
    config: JSONObject;
    constructor(config: any);
    /**
     * Stores an empty filter in the <f,o> pairs structure
     * There can never be more than 1 filter and subfilter for an
     * all-matching filter
     *
     * @param {FieldOperand} operand
     * @param {object} subfilter
     */
    everything(operand: any, subfilter: any): void;
    /**
     * Stores a "equals" condition into the field-operand structure
     *
     * @param {FieldOperand} operand
     * @param {object} subfilter
     * @param {object} condition
     */
    equals(operand: any, subfilter: any, condition: any): void;
    /**
     * Stores a "not equals" condition into the field-operand structure
     *
     * @param {FieldOperand} operand
     * @param {object} subfilter
     * @param {object} condition
     */
    notequals(operand: any, subfilter: any, condition: any): void;
    /**
     * Stores a "exists" condition into the field-operand structure
     *
     * @param {FieldOperand} operand
     * @param {object} subfilter
     * @param {object} condition
     */
    exists(operand: any, subfilter: any, condition: any): void;
    /**
     * Stores a "not exists" condition into the field-operand structure
     *
     * @param {FieldOperand} operand
     * @param {object} subfilter
     * @param {object} condition
     */
    notexists(operand: any, subfilter: any, condition: any): void;
    nothing(operand: any, subfilter: any): void;
    /**
     * Stores a "range" condition into the field-operand structure
     *
     * Stores the range in interval trees for searches in O(log n + m)
     *
     * @param {FieldOperand} operand
     * @param {object} subfilter
     * @param {object} condition
     */
    range(operand: any, subfilter: any, condition: any): void;
    /**
     * Stores a "not range" condition into the field-operand structure
     *
     * "not range" conditions are stored as an inverted range,
     * meaning that if a user subscribes to the following range:
     *      [min, max]
     * Then we register the following ranges in the tree:
     *      ]-Infinity, min[
     *      ]max, +Infinity[
     *
     * (boundaries are also reversed: inclusive boundaries become
     * exclusive, and vice-versa)
     *
     * @param {FieldOperand} operand
     * @param {object} subfilter
     * @param {object} condition
     */
    notrange(operand: any, subfilter: any, condition: any): void;
    /**
     * Stores a "regexp" condition into the field-operand structure
     *
     * @param {FieldOperand} operand
     * @param {object} subfilter
     * @param {object} condition
     */
    regexp(operand: any, subfilter: any, condition: any): void;
    /**
     * Stores a "not regexp" condition into the field-operand structure
     *
     * @param {FieldOperand} operand
     * @param {object} subfilter
     * @param {object} condition
     */
    notregexp(operand: any, subfilter: any, condition: any): void;
    /**
     * Stores a "geospatial" condition into the field-operand structure
     *
     * @param {FieldOperand} operand
     * @param {object} subfilter
     * @param {object} condition
     */
    geospatial(operand: any, subfilter: any, condition: any): void;
    /**
     * Stores a "not geospatial" condition into the field-operand structure
     *
     * @param {FieldOperand} operand
     * @param {object} subfilter
     * @param {object} condition
     */
    notgeospatial(operand: any, subfilter: any, condition: any): void;
}
