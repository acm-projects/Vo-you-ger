// Keep the provider grammar small. Zod and itinerary semantic validation still
// enforce all bounds locally; nested limits can make Gemini reject the request.
const LOCAL_CONSTRAINTS = [
  '$schema', 'minLength', 'maxLength', 'minimum', 'maximum',
  'exclusiveMinimum', 'exclusiveMaximum', 'multipleOf',
  'minItems', 'maxItems', 'uniqueItems', 'contains', 'minContains', 'maxContains',
  'minProperties', 'maxProperties',
];

function providerJsonSchema(schema) {
  const result = structuredClone(schema);
  function visit(node) {
    if (!node || typeof node !== 'object') return;
    for (const key of LOCAL_CONSTRAINTS) delete node[key];
    for (const key of ['properties', '$defs', 'definitions', 'patternProperties']) {
      for (const child of Object.values(node[key] || {})) visit(child);
    }
    for (const key of ['items', 'additionalProperties', 'not', 'if', 'then', 'else']) visit(node[key]);
    for (const key of ['anyOf', 'allOf', 'oneOf', 'prefixItems']) {
      for (const child of node[key] || []) visit(child);
    }
  }
  visit(result);
  return result;
}

module.exports = { providerJsonSchema };
