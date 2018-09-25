# Technical rundown

## Vocabulary

- a "filter" is the complete set of conditions contained in a subscription request. A "filter" is made of "subfilters", linked by OR operands: if 1 subfilter succeeds, the whole filter succeeds
- a "subfilter" is a subset of conditions linked with AND operands: if 1 condition fails, the whole subfilter fails
- a "condition" is an operand applied on a field, with one or multiple values (e.g. `{equals: { field: "value" } }` )
- a "field-operand" pair is an operand and its associated field (e.g. "field - equals")

## Filter registration

Upon registration, the provided filter is validated and partially rewritten in order to standardize the use of keywords. For instance, `bool` conditions are rewritten using AND/OR/NOT operands, "in" is converted to a succession of "equals" operands linked with OR operands, and so on.

Once a filter is validated, it is converted to its canonical form, a very close approximation of its [disjunctive normal form](https://en.wikipedia.org/wiki/Disjunctive_normal_form).
This allows separating a filter to a set of subfilters, themselves containing conditions.

Then comes the most important part of this engine: the way filters are stored and indexed.

## Storage and indexation

The canonicalized filter is split and its parts are stored in different structures:

- `storage.filters` provides a link between a filter and its associated subfilters
- `storage.subfilters` provides a bidirectional link between a subfilter, its associated filters, and its associated conditions
- `storage.conditions` provides a link between a condition and its associated subfilters. It also contains the condition's value

Once stored, filters are indexed in the `storage.foPairs` structure, regrouping all conditions associated to a field-operand pair.  
It means that, for instance, all "equals" condition on a field "field" are regrouped and stored together. The way these values are stored closely depends on the corresponding operand (for instance, "range" operands use a specific augmented AVL tree, while geospatial operands use a R\* tree)

## Matching

Whenever data is provided to the engine to get the list of matching rooms, the subfilters indexes are duplicated, so that they can be updated without impacting the reference structure.

Then, for a given index/collection, all registered field-operand pairs are tested. For each subfilter reference matching a condition, the index is updated to decrement its number of conditions. If it reaches 0, its associated filter is added to the list of returned filters ID.
Another index is then updated, in order to ensure that IDs returned are unique.

The way each field-operand pair performs its match depends closely on the keyword. Matching mechanisms are described in the corresponding `match/match*` files.

## Deleting a filter

When a filter gets deleted, the filters, subfilters, conditions and field-operand structures are cleaned up.
