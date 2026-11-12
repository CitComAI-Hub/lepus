#!/usr/bin/env bash
# Download the pinned SDM schemas the audit validates against.
# Usage: tools/sdm-audit/fetch.sh <schemas dir>
set -euo pipefail
out=${1:?schemas dir}
mkdir -p "$out"
raw=https://raw.githubusercontent.com/smart-data-models
curl -sf -o "$out/WasteContainer.schema.json"      "$raw/dataModel.WasteManagement/aab339de6c10/WasteContainer/schema.json"
curl -sf -o "$out/AirQualityObserved.schema.json"  "$raw/dataModel.Environment/399f96bd5bc5/AirQualityObserved/schema.json"
curl -sf -o "$out/TrafficFlowObserved.schema.json" "$raw/dataModel.Transportation/1eee77e333c9/TrafficFlowObserved/schema.json"
curl -sf -o "$out/Environment-schema.json"         "$raw/dataModel.Environment/399f96bd5bc5/Environment-schema.json"
curl -sf -o "$out/common-schema.json"              https://smart-data-models.github.io/data-models/common-schema.json
echo "schemas in $out"
