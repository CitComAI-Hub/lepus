"""Validate Lepus keyValues entities against pinned Smart Data Models schemas.

Usage: python -I audit.py <schemas dir> <data dir>
Prints, per type: conformance, failures grouped by attribute and rule,
attributes the SDM schema does not define, and the validation time.
"""
import collections
import json
import pathlib
import sys
import time

from jsonschema.validators import validator_for
from referencing import Registry, Resource

schemas_dir, data_dir = map(pathlib.Path, sys.argv[1:3])

# Every schema the SDM files reference, registered under its public URL.
urls = {
    "common-schema.json": "https://smart-data-models.github.io/data-models/common-schema.json",
    "Environment-schema.json": "https://raw.githubusercontent.com/smart-data-models/dataModel.Environment/master/Environment-schema.json",
}
registry = Registry()
for name, url in urls.items():
    registry = registry.with_resource(url, Resource.from_contents(json.loads((schemas_dir / name).read_text())))


def declared_properties(schema, seen=None):
    """Attribute names a schema declares, following allOf/anyOf/oneOf and $refs."""
    seen = seen if seen is not None else set()
    names = set(schema.get("properties", {}))
    for key in ("allOf", "anyOf", "oneOf"):
        for sub in schema.get(key, []):
            ref = sub.get("$ref")
            if ref and ref not in seen:
                seen.add(ref)
                url, _, frag = ref.partition("#")
                target = registry.contents(url) if url else schema
                for part in filter(None, frag.split("/")):
                    target = target[part]
                names |= declared_properties(target, seen)
            else:
                names |= declared_properties(sub, seen)
    return names


def describe(error):
    attr = error.absolute_path[0] if error.absolute_path else "(entity)"
    if error.validator == "required":
        return attr, "required", error.message.split("'")[1] + " missing"
    if error.validator in ("anyOf", "oneOf") and error.context:
        inner = sorted({e.validator for e in error.context})
        return attr, error.validator, "matches none of: " + ",".join(inner)
    if error.validator == "type":
        return attr, "type", f"is {type(error.instance).__name__}, SDM expects {error.validator_value}"
    if error.validator == "enum":
        return attr, "enum", "value not in SDM list " + str(error.validator_value)[:70]
    if error.validator == "format":
        return attr, "format", f"not a valid {error.validator_value}"
    return attr, error.validator, f"{error.validator} {str(error.validator_value)[:70]}"


for schema_file in sorted(schemas_dir.glob("*.schema.json")):
    type_name = schema_file.name.split(".")[0]
    data_file = data_dir / f"{type_name}.json"
    if not data_file.exists():
        continue
    schema = json.loads(schema_file.read_text())
    cls = validator_for(schema)
    validator = cls(schema, registry=registry, format_checker=cls.FORMAT_CHECKER)
    entities = json.loads(data_file.read_text())
    declared = declared_properties(schema)

    groups = collections.Counter()
    failing = 0
    extra = collections.Counter()
    t0 = time.perf_counter()
    for entity in entities:
        errors = list(validator.iter_errors(entity))
        if errors:
            failing += 1
        for key in {describe(e) for e in errors}:
            groups[key] += 1
        for attr in entity:
            if attr not in declared and attr not in ("id", "type", "@context"):
                extra[attr] += 1
    elapsed = time.perf_counter() - t0

    n = len(entities)
    print(f"\n=== {type_name} (SDM {schema.get('$schemaVersion')}): {n} entities, "
          f"{n - failing} conform ({(n - failing) / n:.0%}); "
          f"validation {elapsed * 1000:.0f} ms total, {elapsed / n * 1000:.2f} ms/entity")
    for (attr, rule, detail), count in groups.most_common():
        print(f"  {count:4d}  {attr:28s} {rule:10s} {detail}")
    if extra:
        print("  attributes not defined by SDM:", ", ".join(f"{a} ({c})" for a, c in extra.most_common()))
