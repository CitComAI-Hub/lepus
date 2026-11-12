# Smart Data Models conformance audit

Checks the entities Lepus returns (keyValues) against the official Smart Data Models
(SDM) schemas, pinned to a commit of each SDM repository. It reads through a running
Lepus, so it sees exactly what data space consumers get.

```bash
python3 -m venv /tmp/sdm-venv && /tmp/sdm-venv/bin/pip install 'jsonschema[format]==4.23.0'
tools/sdm-audit/fetch.sh /tmp/sdm-schemas
mkdir -p /tmp/sdm-data
for t in WasteContainer AirQualityObserved TrafficFlowObserved; do
  curl -s "http://localhost:3000/ngsi-ld/v1/entities?type=$t&options=keyValues&limit=1000" > /tmp/sdm-data/$t.json
done
/tmp/sdm-venv/bin/python -I tools/sdm-audit/audit.py /tmp/sdm-schemas /tmp/sdm-data
```

Pinned schemas: WasteManagement `aab339de6c10` (WasteContainer 0.3.0), Environment
`399f96bd5bc5` (AirQualityObserved 0.1.4), Transportation `1eee77e333c9`
(TrafficFlowObserved 0.0.1).

## Results (2026-11-12, VLCi)

| Type | v1.4 | v1.6 |
|---|---|---|
| AirQualityObserved | 33/33 | 33/33 |
| TrafficFlowObserved | 330/386 | 386/386 |
| WasteContainer | 161/543 | 538/543 |

The adaptations are in `lib/sdmConformance.js` (v1.5, v1.6): null attributes left out
(NGSI-LD has no null values); WasteContainer `refDevice` as an array, `category`
`Superficie` → `ground`, `fillingLevel` number strings (`"0"`) as numbers;
TrafficFlowObserved `intensity` -1 (no measurement) left out.

## Baseline: known deviations in VLCi data

Not fixed by Lepus, because fixing them would mean inventing data. Reported to the
Ajuntament. A new audit should only show these; anything else is new.

| Type | Deviation | Entities |
|---|---|---|
| WasteContainer | `location` missing (null in VLCi; SDM requires it) | 5 |

Attributes VLCi adds and SDM does not define (`TimeInstant`, `height`, `modelName`, the
air-quality `*Flag`/`*Origin` attributes, …) are allowed by SDM and not deviations.
