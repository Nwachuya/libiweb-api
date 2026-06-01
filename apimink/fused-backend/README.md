# 🚀 Fused Backend: High-Performance Computational APIs

Fused Backend is an enterprise-grade suite of specialized API endpoints built with **FastAPI**. It focuses on solving complex computational problems using mathematical prowess and algorithmic efficiency, bypassing the need for heavy, external, or paid dependencies.

## 🛠 Technology Stack
- **Core**: Python 3.9+
- **Framework**: FastAPI (Asynchronous execution)
- **Validation**: Pydantic v2
- **Processing**: NumPy, SciPy, NetworkX
- **Deployment**: Docker-ready for Coolify

---

## 🚀 Getting Started

### 1. Installation
Ensure you have Python 3.9+ installed.
```bash
pip install -r requirements.txt
```

### 2. Running Locally
Run the development server on the standard testing port (**8001**):
```bash
uvicorn main:app --port 8001 --reload
```

---

## 🛠 API Catalog

### 1. Chrono-Intersection Engine ✅
**Industry**: HR / Remote Work  
**Problem**: Finding meeting overlaps across global timezones and complex DST shifts.  
**Algorithm**: Continuous UTC Epoch Conversion + Sweep-Line Intersection.

#### 📥 Input Parameters (`POST /chrono`)
| Variable | Type | Description |
|:---|:---|:---|
| `participants` | `Array` | A list of participant objects. |
| `participants[].name` | `String` | Name of the participant. |
| `participants[].timezone` | `String` | IANA Timezone string (e.g., `America/New_York`). |
| `participants[].intervals` | `Array` | List of availability windows. |
| `intervals[].start` | `String` | ISO-8601 local start time. |
| `intervals[].end` | `String` | ISO-8601 local end time. |

#### 📤 Output
| Variable | Type | Description |
|:---|:---|:---|
| `intersections` | `Array` | List of common availability windows in UTC ISO-8601. |

#### 🧪 CURL Example
```bash
curl -X POST "http://localhost:8001/v1/chrono" \
-H "Content-Type: application/json" \
-H "X-API-KEY: {{API_KEY}}" \
-d '{
  "participants": [
    {
      "name": "Alice",
      "timezone": "America/New_York",
      "intervals": [{"start": "2024-05-01T09:00:00", "end": "2024-05-01T17:00:00"}]
    },
    {
      "name": "Bob",
      "timezone": "Europe/London",
      "intervals": [{"start": "2024-05-01T08:00:00", "end": "2024-05-01T16:00:00"}]
    }
  ]
}'
```

### 2. Stateful Mock Data ✅
**Industry**: QA / Development  
**Problem**: Generating logically sound, relational synthetic testing data.  
**Algorithm**: Recursive Abstract Syntax Tree (AST) Evaluator with context injection.

#### 📥 Input Parameters (`POST /mock`)
| Variable | Type | Description |
|:---|:---|:---|
| `rows` | `Integer` | Number of rows to generate. |
| `seed` | `Integer` | (Optional) Random seed for deterministic output. |
| `schema_definition` | `Object` | Key-value pairs where value is a formula. |

**Supported Formulas**:
- `increment`: Auto-incrementing integer starting at 1.
- `random_int(min, max)`: Random integer within range.
- `random_name`: Random name from a pre-defined set.
- `if {condition} then {val1} else {val2}`: Conditional logic referencing previous keys in the same row.

#### 🧪 CURL Example
```bash
curl -X POST "http://localhost:8001/v1/mock" \
-H "Content-Type: application/json" \
-H "X-API-KEY: {{YOUR_SECRET_KEY}}" \
-d '{
  "rows": 3,
  "seed": 42,
  "schema_definition": {
    "id": "increment",
    "name": "random_name",
    "age": "random_int(18, 65)",
    "category": "if age > 40 then senior else junior"
  }
}'
```

---

### 3. Fuzzy CRM Deduplication ✅
**Industry**: SalesOps / CRM  
**Problem**: Messy customer lists requiring expensive AI to deduplicate.  
**Algorithm**: Weighted similarity matrix (Levenshtein, Jaro-Winkler, Soundex) + Union-Find Clustering.

#### 📥 Input Parameters (`POST /fuzzy`)
| Variable | Type | Description |
|:---|:---|:---|
| `items` | `Array` | List of strings to deduplicate. |
| `threshold` | `Float` | (Optional) Similarity threshold (0.0 to 1.0, default 0.85). |

#### 📤 Output
| Variable | Type | Description |
|:---|:---|:---|
| `clusters` | `Array` | List of groups (arrays of strings) identified as duplicates. |

#### 🧪 CURL Example
```bash
curl -X POST "http://localhost:8001/v1/fuzzy" \
-H "Content-Type: application/json" \
-H "X-API-KEY: {{API_KEY}}" \
-d '{
  "items": ["Apple Inc.", "apple inc", "Google", "Gogle"],
  "threshold": 0.8
}'
```

### 4. Deterministic Tokenization ✅
**Industry**: Data Privacy / ML  
**Problem**: Masking PII for testing without breaking database relationships or formats.  
**Algorithm**: HMAC-SHA256 with secret salt + Luhn Module for format preservation.

#### 📥 Input Parameters (`POST /token`)
| Variable | Type | Description |
|:---|:---|:---|
| `data` | `String` | The raw PII data to tokenize. |
| `salt` | `String` | (Optional) Custom secret salt for deterministic hashing. |
| `format` | `String` | `generic`, `credit_card`, `email`, `ssn`, or `phone`. |

#### 📤 Output
| Variable | Type | Description |
|:---|:---|:---|
| `token` | `String` | The masked/tokenized value (format preserved for CC, SSN, Phone, Email). |

#### 🧪 CURL Examples
**Credit Card**:
```bash
curl -X POST "http://localhost:8001/v1/token" -H "Content-Type: application/json" -H "X-API-KEY: {{API_KEY}}" -d '{"data": "4111222233334444", "format": "credit_card"}'
```

**SSN**:
```bash
curl -X POST "http://localhost:8001/v1/token" -H "Content-Type: application/json" -H "X-API-KEY: {{API_KEY}}" -d '{"data": "123-45-6789", "format": "ssn"}'
```

---

### 5. 3D Combinatorial Bin Packing ✅
**Industry**: Logistics / Cloud  
**Problem**: Packing boxes or VMs efficiently to reduce wasted space/compute.  
**Algorithm**: 3D Guillotine Split heuristic + First-Fit Decreasing (FFD) volume sorting.

#### 📥 Input Parameters (`POST /pack`)
| Variable | Type | Description |
|:---|:---|:---|
| `bin` | `Object` | Dimensions of the container `{w, h, d}`. |
| `items` | `Array` | List of items `{id, w, h, d}` to pack. |

#### 📤 Output
| Variable | Type | Description |
|:---|:---|:---|
| `fit` | `Array` | List of items with their calculated `{x, y, z}` coordinates and orientation. |
| `not_fit` | `Array` | List of item objects that could not fit in the bin. |

#### 🧪 CURL Example
```bash
curl -X POST "http://localhost:8001/v1/pack" \
-H "Content-Type: application/json" \
-H "X-API-KEY: {{API_KEY}}" \
-d '{
  "bin": {"w": 10, "h": 10, "d": 10},
  "items": [
    {"id": "box1", "w": 5, "h": 5, "d": 5},
    {"id": "box2", "w": 5, "h": 5, "d": 5}
  ]
}'
```

#### 📖 How to Read Results
The bin is a 3D coordinate system starting at `(0,0,0)`.
- **`fit`**: Successful items.
  - `x, y, z`: The anchor corner of the item.
  - `w, h, d`: The orientation used (may be rotated).
- **`not_fit`**: Failed items.
  - Contains the original item objects that were too large for any subdivided space.

### 6. Deep Semantic Reconciliation ✅
**Industry**: FinTech / B2B Sync  
**Problem**: Finding true differences in massive payloads while ignoring structural noise (like array ordering).  
**Algorithm**: Structural Hash Normalization + Graph Traversal + RFC 6902 JSONPatch generation.

#### 📥 Input Parameters (`POST /diff`)
| Variable | Type | Description |
|:---|:---|:---|
| `source` | `Object` | The baseline JSON object. |
| `target` | `Object` | The modified JSON object to compare against. |

#### 📤 Output
| Variable | Type | Description |
|:---|:---|:---|
| `patch` | `Array` | List of RFC 6902 compliant operations (`add`, `remove`, `replace`). |

#### 🧪 CURL Example
```bash
curl -X POST "http://localhost:8001/v1/diff" \
-H "Content-Type: application/json" \
-H "X-API-KEY: {{API_KEY}}" \
-d '{
  "source": {"roles": ["admin", "editor"], "active": true},
  "target": {"roles": ["editor", "admin"], "active": false}
}'
```

---

### 7. Self-Healing Schema Cast ✅
**Industry**: Data Engineering  
**Problem**: Upstream API schema drift (renamed keys, type mismatches) crashing ingestion.  
**Algorithm**: Recursive Descent Parser + Fuzzy Key Matching (Jaro-Winkler) + Mathematical Coercion.

#### 📥 Input Parameters (`POST /cast`)
| Variable | Type | Description |
|:---|:---|:---|
| `payload` | `Object` | The raw, potentially "dirty" JSON payload. |
| `schema_definition`| `Object` | The target schema `{key: type}` (e.g., `{"user_id": "int"}`). |
| `fuzzy_threshold` | `Float` | (Optional) Similarity threshold for remapping (default 0.8). |

#### 📤 Output
| Variable | Type | Description |
|:---|:---|:---|
| `healed` | `Object` | The cleaned object matching the target schema. |
| `remaps` | `Object` | Audit trail of which keys were renamed/remapped. |

#### 🧪 CURL Example
```bash
curl -X POST "http://localhost:8001/v1/cast" \
-H "Content-Type: application/json" \
-H "X-API-KEY: {{API_KEY}}" \
-d '{
  "payload": {"cust_id": "1001", "age": "25"},
  "schema_definition": {"customer_id": "int", "age": "int"}
}'
```

### 8. Tax-Lot / Cost Basis Engine ✅
**Industry**: FinTech / Crypto  
**Problem**: Calculating exact realized gains/losses across thousands of fragmented trades.  
**Algorithm**: Queue-based lot accounting supporting **FIFO**, **LIFO**, and **HIFO** (Highest-In, First-Out) strategies.

#### 📥 Input Parameters (`POST /tax`)
| Variable | Type | Description |
|:---|:---|:---|
| `method` | `String` | Accounting strategy: `FIFO`, `LIFO`, or `HIFO`. |
| `transactions` | `Array` | List of `{type, qty, price, timestamp}` objects. |

#### 📤 Output
| Variable | Type | Description |
|:---|:---|:---|
| `realized_pnl` | `Float` | The total realized profit or loss. |
| `remaining_lots` | `Array` | List of unsold assets (lots) with their original cost basis. |

#### 🧪 CURL Example
```bash
curl -X POST "http://localhost:8001/v1/tax" \
-H "Content-Type: application/json" \
-H "X-API-KEY: {{API_KEY}}" \
-d '{
  "method": "HIFO",
  "transactions": [
    {"type": "buy", "qty": 10, "price": 100, "timestamp": "2024-01-01T10:00:00"},
    {"type": "buy", "qty": 10, "price": 200, "timestamp": "2024-01-02T10:00:00"},
    {"type": "sell", "qty": 10, "price": 150, "timestamp": "2024-01-03T10:00:00"}
  ]
}'
```

### 9. Stateless Policy Engine (ABAC) ✅
**Industry**: Cybersecurity  
**Problem**: Hardcoding authorization logic makes systems brittle and hard to audit.  
**Algorithm**: Recursive Boolean DAG Evaluator (JSON-Logic style).

#### 📥 Input Parameters (`POST /policy`)
| Variable | Type | Description |
|:---|:---|:---|
| `rules` | `Object` | The logical ruleset (e.g., `{"and": [...]}`). |
| `attributes` | `Object` | The context/subject attributes to evaluate against. |

#### 📤 Output
| Variable | Type | Description |
|:---|:---|:---|
| `result` | `Boolean` | Whether the policy permits the action. |

#### 🧪 CURL Example
```bash
curl -X POST "http://localhost:8001/v1/policy" \
-H "Content-Type: application/json" \
-H "X-API-KEY: {{API_KEY}}" \
-d '{
  "rules": {"and": [{"or": [{"==": [{"var": "role"}, "admin"]}, {">": [{"var": "age"}, 21]}]}, {"==": [{"var": "active"}, true]}]},
  "attributes": {"role": "editor", "age": 25, "active": true}
}'
```

### 10. Zero-Trust Telemetry ✅
**Industry**: Cybersecurity  
**Problem**: Session hijacking and "Impossible Travel" bot attacks.  
**Algorithm**: Haversine Spherical Trigonometry + Shannon Entropy.

#### 📥 Input Parameters (`POST /telemetry`)
| Variable | Type | Description |
|:---|:---|:---|
| `points` | `Array` | List of login/activity events. |
| `points[].lat` | `Float` | Latitude of the event. |
| `points[].lon` | `Float` | Longitude of the event. |
| `points[].timestamp` | `String` | ISO-8601 timestamp. |
| `points[].user_agent` | `String` | The device user agent string. |

#### 📤 Output
| Variable | Type | Description |
|:---|:---|:---|
| `status` | `String` | `secure` or `flagged`. |
| `risk_score` | `Float` | 0.0 to 1.0 (Entropy + Speed calculation). |
| `reason` | `String` | Human-readable explanation if flagged. |

#### 🧪 CURL Example
```bash
curl -X POST "http://localhost:8001/v1/telemetry" \
-H "Content-Type: application/json" \
-H "X-API-KEY: {{API_KEY}}" \
-d '{
  "points": [
    {"lat": 51.5074, "lon": -0.1278, "timestamp": "2024-01-01T10:00:00", "user_agent": "Desktop..."},
    {"lat": 40.7128, "lon": -74.0060, "timestamp": "2024-01-01T10:30:00", "user_agent": "Mobile..."}
  ]
}'
```

---

### 11. Time-Series Interpolation ✅
**Industry**: IoT / Monitoring  
**Problem**: Missing or spiked data ruining analytics dashboards.  
**Algorithm**: Linear Interpolation + Savitzky-Golay Smoothing.

#### 📥 Input Parameters (`POST /series`)
| Variable | Type | Description |
|:---|:---|:---|
| `data` | `Array` | List of `{timestamp, value}` points. |
| `interval_seconds`| `Int` | The target granularity (e.g., 60 for 1-min). |
| `window_size` | `Int` | Smoothing window (must be odd). |

#### 📤 Output
| Variable | Type | Description |
|:---|:---|:---|
| `interpolated` | `Array` | The filled and smoothed time-series data. |
| `anomalies` | `Array` | List of points flagged as Z-Score outliers. |

#### 🧪 CURL Example
```bash
curl -X POST "http://localhost:8001/v1/series" \
-H "Content-Type: application/json" \
-H "X-API-KEY: {{API_KEY}}" \
-d '{
  "interval_seconds": 60,
  "window_size": 3,
  "data": [
    {"timestamp": "2024-01-01T10:00:00", "value": 100.0},
    {"timestamp": "2024-01-01T10:02:00", "value": 105.0},
    {"timestamp": "2024-01-01T10:03:00", "value": 1000.0},
    {"timestamp": "2024-01-01T10:04:00", "value": 102.0}
  ]
}'
```

### 12. Spatial Ray-Casting & Geofence ✅
**Industry**: Drones / Delivery  
**Problem**: Checking if a GPS point falls in polygons without map APIs.  
**Algorithm**: Jordan Curve Theorem + Haversine Boundary Distance.

#### 📥 Input Parameters (`POST /spatial`)
| Variable | Type | Description |
|:---|:---|:---|
| `point` | `Object` | The GPS coordinate `{lat, lng}` to check. |
| `polygon` | `Array` | Ordered list of `{lat, lng}` defining boundaries. |

#### 📤 Output
| Variable | Type | Description |
|:---|:---|:---|
| `is_inside` | `Boolean` | True if the point is within the fence. |
| `distance_to_boundary`| `Float` | Shortest distance to edge in meters. |

#### 🧪 CURL Example
```bash
curl -X POST "http://localhost:8001/v1/spatial" \
-H "Content-Type: application/json" \
-H "X-API-KEY: {{API_KEY}}" \
-d '{
  "point": {"lat": 51.50, "lng": -0.11},
  "polygon": [
    {"lat": 51.52, "lng": -0.15},
    {"lat": 51.52, "lng": -0.10},
    {"lat": 51.49, "lng": -0.10},
    {"lat": 51.49, "lng": -0.12},
    {"lat": 51.51, "lng": -0.12},
    {"lat": 51.51, "lng": -0.15}
  ]
}'
```

---

### 13. Tiered Proration Engine ✅
**Industry**: B2B SaaS / Billing  
**Problem**: Complex mid-cycle billing upgrades with tiered pricing and tax requirements.  
**Algorithm**: Time-Ratio Distribution + Step-Function Tiered Pricing.

#### 📥 Input Parameters (`POST /proration`)
| Variable | Type | Description |
|:---|:---|:---|
| `cycle_start` | `String` | ISO-8601 start of the current billing cycle. |
| `cycle_end` | `String` | ISO-8601 end of the current billing cycle. |
| `change_timestamp`| `String` | When the upgrade/change occurred. |
| `old_tiers` | `Array` | List of `{min_qty, max_qty, unit_price}` for the old plan. |
| `new_tiers` | `Array` | List of `{min_qty, max_qty, unit_price}` for the new plan. |
| `usage` | `Int` | (Optional) Total usage units for consumption-based. |
| `seats` | `Int` | (Optional) Total seat count for seat-based. |
| `tax_rate` | `Float` | (Optional) Percentage tax (e.g., 0.15 for 15%). |

#### 📤 Output
| Variable | Type | Description |
|:---|:---|:---|
| `total_prorated_due`| `Float` | Final amount due (new cost - credit from old). |
| `tax_amount` | `Float` | Total tax calculated on the prorated amount. |
| `audit` | `Object` | Detailed breakdown of costs and durations. |

#### 🧪 Usage Scenarios

**A. Monthly Usage Upgrade (No Tax)**
```bash
curl -X POST "http://localhost:8001/v1/proration" \
-H "Content-Type: application/json" \
-H "X-API-KEY: {{API_KEY}}" \
-d '{
  "cycle_start": "2024-05-01T00:00:00",
  "cycle_end": "2024-05-31T00:00:00",
  "change_timestamp": "2024-05-11T00:00:00",
  "usage": 5000,
  "old_tiers": [{"min_qty": 0, "max_qty": null, "unit_price": 0.01}],
  "new_tiers": [{"min_qty": 0, "max_qty": null, "unit_price": 0.05}]
}'
```

**B. Annual Seat-Based with 15% VAT**
```bash
curl -X POST "http://localhost:8001/v1/proration" \
-H "Content-Type: application/json" \
-H "X-API-KEY: {{API_KEY}}" \
-d '{
  "cycle_start": "2024-01-01T00:00:00",
  "cycle_end": "2024-12-31T23:59:59",
  "change_timestamp": "2024-07-01T00:00:00",
  "seats": 50,
  "tax_rate": 0.15,
  "old_tiers": [
    {"min_qty": 0, "max_qty": 20, "unit_price": 100},
    {"min_qty": 20, "max_qty": null, "unit_price": 80}
  ],
  "new_tiers": [
    {"min_qty": 0, "max_qty": 20, "unit_price": 150},
    {"min_qty": 20, "max_qty": null, "unit_price": 120}
  ]
}'
```

---

### 14. Deterministic APCA Matrix ✅
**Industry**: UI / Accessibility  
**Problem**: Generating legally compliant UI color palettes using the WCAG 3.0 standard.  
**Algorithm**: SAPC (Standard Analytical Perceptual Contrast) + Oklab Color Space.

#### 📥 Input Parameters (`POST /apca`)
| Variable | Type | Description |
|:---|:---|:---|
| `text_color` | `String` | Foreground HEX color (e.g., `#000000`). |
| `bg_color` | `String` | Background HEX color (e.g., `#FFFFFF`). |
| `generate_tonal_range`| `Bool`| If true, returns a range of accessible variations. |

#### 📤 Output
| Variable | Type | Description |
|:---|:---|:---|
| `contrast_score` | `Float` | The Lc (Luminance Contrast) value. |
| `accessibility` | `Object` | Pass/Fail status for Body and Large text. |

#### 🧪 CURL Example
```bash
curl -X POST "http://localhost:8001/v1/apca" \
-H "Content-Type: application/json" \
-H "X-API-KEY: {{API_KEY}}" \
-d '{
  "text_color": "#000000",
  "bg_color": "#FFFFFF",
  "generate_tonal_range": true
}'
```

---

### 15. Topological DAG & Conflict ✅
**Industry**: Legal / Auditing  
**Problem**: Identifying circular ownership and Ultimate Beneficial Owner (UBO) obfuscation.  
**Algorithm**: Tarjan's SCC + Directed Acyclic Graph (DAG) Analysis.

#### 📥 Input Parameters (`POST /dag`)
| Variable | Type | Description |
|:---|:---|:---|
| `relationships` | `Array` | List of `{source, target, ownership_percent}`. |

#### 📤 Output
| Variable | Type | Description |
|:---|:---|:---|
| `audit_status` | `String` | `Clean` or `Flagged`. |
| `conflicts` | `Array` | Detailed breakdown of detected ownership cycles. |
| `conflicts[].risk_level`| `String` | Severity based on circular impact factor. |

#### 🧪 CURL Example
```bash
curl -X POST "http://localhost:8001/v1/dag" \
-H "Content-Type: application/json" \
-H "X-API-KEY: {{API_KEY}}" \
-d '{
  "relationships": [
    {"source": "Holdings Corp", "target": "Subsidary Ltd", "ownership_percent": 51.0},
    {"source": "Subsidary Ltd", "target": "Shell Co", "ownership_percent": 100.0},
    {"source": "Shell Co", "target": "Holdings Corp", "ownership_percent": 10.0}
  ]
}'
```

---

### 16. LLM Output AST Enforcer ✅
**Industry**: AI / DevTools  
**Problem**: LLMs hallucinating invalid JSON or breaking schema constraints.  
**Algorithm**: AST Parsing + Fuzzy Regex Cleaning + Recursive Type Coercion.

#### 📥 Input Parameters (`POST /enforcer`)
| Variable | Type | Description |
|:---|:---|:---|
| `raw_output` | `String` | The raw, potentially "dirty" output from an LLM. |
| `target_schema` | `Object` | Map of `{key: type}` (e.g., `{"age": "int"}`). |

#### 📤 Output
| Variable | Type | Description |
|:---|:---|:---|
| `success` | `Boolean` | True if the structure was successfully healed. |
| `enforced_object` | `Object` | The clean, typed object matching the schema. |
| `audit` | `Array` | List of corrections made (e.g., "Coerced str to int"). |

#### 🧪 CURL Example
```bash
curl -X POST "http://localhost:8001/v1/enforcer" \
-H "Content-Type: application/json" \
-H "X-API-KEY: {{API_KEY}}" \
-d '{
  "raw_output": "```json\n{ '\''name'\'': '\''Margo'\'', '\''age'\'': '\''25'\'', '\''active'\'': '\''true'\'', }\n```",
  "target_schema": {
    "name": "str",
    "age": "int",
    "active": "bool"
  }
}'
```

### 17. Toolpath & G-Code Optimizer ✅
**Industry**: Manufacturing  
**Problem**: Inefficient machine movement (air travel) wasting time in CNC/3D printing.  
**Algorithm**: 2-opt TSP Heuristic (Iterative Path Uncrossing).

#### 📥 Input Parameters (`POST /gcode`)
| Variable | Type | Description |
|:---|:---|:---|
| `points` | `Array` | List of `{x, y, z}` coordinates representing the toolpath. |

#### 📤 Output
| Variable | Type | Description |
|:---|:---|:---|
| `original_total_distance`| `Float` | The distance of the unoptimized path. |
| `optimized_total_distance`| `Float` | The distance after path uncrossing. |
| `efficiency_gain` | `String` | Percentage of travel distance saved. |
| `optimized_points` | `Array` | The reordered list of points for optimal travel. |

#### 🧪 CURL Example
```bash
curl -X POST "http://localhost:8001/v1/gcode" \
-H "Content-Type: application/json" \
-H "X-API-KEY: {{API_KEY}}" \
-d '{
  "points": [
    {"x": 0, "y": 0, "z": 0},
    {"x": 100, "y": 100, "z": 0},
    {"x": 0, "y": 100, "z": 0},
    {"x": 100, "y": 0, "z": 0}
  ]
}'
```

---

### 18. Bio-String Alignment Scorer ✅
**Industry**: Digital Health  
**Problem**: Checking DNA/RNA sequence overlaps and off-target bindings.  
**Algorithm**: Needleman-Wunsch (Global Alignment).

#### 📥 Input Parameters (`POST /bio`)
| Variable | Type | Description |
|:---|:---|:---|
| `seq1` | `String` | First genetic sequence (e.g., "GATTACA"). |
| `seq2` | `String` | Second genetic sequence (e.g., "GCATGCU"). |
| `match_score` | `Int` | Score for matching characters (default 1). |
| `gap_penalty` | `Int` | Penalty for sequence gaps (default -2). |

#### 📤 Output
| Variable | Type | Description |
|:---|:---|:---|
| `alignment_score` | `Int` | The total mathematical alignment score. |
| `alignment` | `Object` | The visual alignment strings with gaps (`-`). |

#### 🧪 CURL Example
```bash
curl -X POST "http://localhost:8001/v1/bio" \
-H "Content-Type: application/json" \
-H "X-API-KEY: {{API_KEY}}" \
-d '{
  "seq1": "GATTACA",
  "seq2": "GCATGCU"
}'
```

---

### 19. Merkle Proof Cryptography ✅
**Industry**: Web3 / Auditing  
**Problem**: Proving supply chain events without exposing the whole database.  
**Algorithm**: Recursive SHA-256 Merkle Tree Construction.

#### 📥 Input Parameters (`POST /merkle/proof`)
| Variable | Type | Description |
|:---|:---|:---|
| `data_blocks` | `Array` | List of raw data strings to hash into the tree. |
| `target_index` | `Int` | The index of the item you want to generate a proof for. |

#### 📤 Output
| Variable | Type | Description |
|:---|:---|:---|
| `merkle_root` | `String` | The top-level hash representing the entire set. |
| `proof_path` | `Array` | List of sibling hashes needed to verify the leaf. |

#### 🧪 CURL Example (Verify)
```bash
curl -X POST "http://localhost:8001/v1/merkle/verify" \
-H "Content-Type: application/json" \
-H "X-API-KEY: {{API_KEY}}" \
-d '{
  "root": "dea829e4aea76a439dbcbea763c39456bf0bb0e4bb7ed8769ae1c23addde21b1",
  "target_data": "Asset_002_Shipped",
  "proof_path": [
    {"position": "left", "hash": "bdb0910133231708f069d3706b35659add5bd0089ab4e44baef8f321cdfaddd4"},
    {"position": "right", "hash": "4905711345710127bb80411fd5ffe1832a2c91aac902529e6ec8fbde1facbe7a"}
  ]
}'
```

---

### 20. LLM-Ready / AEO Markdown ✅
**Industry**: Marketing / SEO  
**Problem**: Traditional SEO is failing; companies need content optimized for AI Overviews (AEO).  
**Algorithm**: DOM-Stripping + Semantic Content Extraction + `llms.txt` Markdown formatting.

#### 📥 Input Parameters (`POST /v1/aeo`)
| Variable | Type | Description |
|:---|:---|:---|
| `html` | `String` | Raw HTML content from a webpage. |
| `include_summary_block`| `Bool` | If true, prepends an LLM-optimized summary (default: true). |

#### 📤 Output
| Variable | Type | Description |
|:---|:---|:---|
| `aeo_markdown` | `String` | Clean, structured Markdown compliant with the `llms.txt` standard. |
| `word_count` | `Integer` | Total count of optimized words. |
| `optimization_status` | `String` | Readiness level for AI citation. |

#### 🧪 CURL Example
```bash
curl -X POST "http://localhost:8001/v1/aeo" \
-H "Content-Type: application/json" \
-H "X-API-KEY: {{API_KEY}}" \
-d '{
  "html": "<html><body><nav>Menu</nav><main><h1>Big News</h1><p>This is the important part.</p></main><footer>Bye</footer></body></html>",
  "include_summary_block": true
}'
```

---

### 21. Constraint-Based Shift Solver ✅
**Industry**: HR / Gig Logistics  
**Problem**: Managing complex workforce schedules without violating labor laws or skill requirements.  
**Algorithm**: Greedy Assignment with Recursive Backtracking (CSP Solver).

#### 📥 Input Parameters (`POST /v1/shifts`)
| Variable | Type | Description |
|:---|:---|:---|
| `employees` | `Array` | List of workers with `skills`, `max_weekly_hours`, and `unavailable_windows`. |
| `shifts` | `Array` | List of required shifts with `start`, `end`, and `required_skill`. |
| `min_rest_hours`| `Float` | Minimum mandatory rest between shifts (default: 11.0). |

#### 📤 Output
| Variable | Type | Description |
|:---|:---|:---|
| `assignments` | `Object` | Map of `shift_id` to `employee_id`. |
| `unfillable_shifts`| `Array` | List of shift IDs that couldn't be staffed within constraints. |
| `status` | `String` | `COMPLETED` or `PARTIALLY_FILLED`. |

#### 🧪 CURL Example
```bash
curl -X POST "http://localhost:8001/v1/shifts" \
-H "Content-Type: application/json" \
-H "X-API-KEY: {{API_KEY}}" \
-d '{
  "employees": [
    {"id": "E1", "skills": ["barista"], "max_weekly_hours": 40},
    {"id": "E2", "skills": ["barista", "manager"], "max_weekly_hours": 40}
  ],
  "shifts": [
    {"id": "S1", "start": "2024-05-01T08:00:00", "end": "2024-05-01T16:00:00", "required_skill": "barista"},
    {"id": "S2", "start": "2024-05-01T17:00:00", "end": "2024-05-02T01:00:00", "required_skill": "manager"}
  ]
}'
```

---

### 22. Web Crawler Engine ✅
**Industry**: Intelligence / Research  
**Problem**: Programmatically exploring web pages to extract structured link and content data.  
**Algorithm**: Asynchronous BFS Crawler + Recursive Link Normalization.

#### 📥 Input Parameters (`POST /v1/crawl`)
| Variable | Type | Description |
|:---|:---|:---|
| `url` | `String` | Target URL to crawl. |
| `include_html` | `Bool` | Whether to return raw HTML in response (default: false). |

#### 📤 Output
| Variable | Type | Description |
|:---|:---|:---|
| `title` | `String` | Page title. |
| `links` | `Array` | List of unique absolute URLs found on the page. |
| `word_count` | `Int` | Rough count of words on the page. |

#### 🧪 CURL Example
```bash
curl -X POST "http://localhost:8001/v1/crawl" \
-H "Content-Type: application/json" \
-H "X-API-KEY: {{API_KEY}}" \
-d '{"url": "https://example.com"}'
```

---

### 23. SEO Audit Engine ✅
**Industry**: Marketing / SEO  
**Problem**: Identifying technical SEO weaknesses without expensive monthly tools.  
**Algorithm**: Structural HTML Analysis + WCAG/SEO Scoring Heuristics.

#### 📥 Input Parameters (`POST /v1/seo`)
| Variable | Type | Description |
|:---|:---|:---|
| `url` | `String` | Target URL to analyze. |

#### 📤 Output
| Variable | Type | Description |
|:---|:---|:---|
| `score` | `Float` | Overall SEO health score (0.0 to 100.0). |
| `issues` | `Array` | List of identified SEO improvements. |
| `heading_structure`| `Object` | Count of H1, H2, H3 tags. |

#### 🧪 CURL Example
```bash
curl -X POST "http://localhost:8001/v1/seo" \
-H "Content-Type: application/json" \
-H "X-API-KEY: {{API_KEY}}" \
-d '{"url": "https://example.com"}'
```

---

### 24. Computational Email Scraper ✅
**Industry**: LeadGen / Sales  
**Problem**: Extracting contact info from pages that use anti-bot obfuscation.  
**Algorithm**: Regex Extraction + De-obfuscation ([at], (dot)) + Shannon Entropy Filtering.

#### 📥 Input Parameters (`POST /v1/emails`)
| Variable | Type | Description |
|:---|:---|:---|
| `url` | `String` | Target URL to scrape. |

#### 📤 Output
| Variable | Type | Description |
|:---|:---|:---|
| `emails` | `Array` | List of unique, validated email addresses. |
| `count` | `Int` | Number of unique emails found. |
| `obfuscation_detected`| `Bool` | True if anti-spam patterns were detected and bypassed. |

#### 🧪 CURL Example
```bash
curl -X POST "http://localhost:8001/v1/emails" \
-H "Content-Type: application/json" \
-H "X-API-KEY: {{API_KEY}}" \
-d '{"url": "https://example.com/contact"}'
```

---

### 25. Perceptual Asset Extractor ✅
**Industry**: Content Marketing / Social  
**Problem**: Identifying the most important media assets (Hero images, videos) on a page.  
**Algorithm**: Asset Weighting (Resolution, Metadata, Keywords) + URL Normalization.

#### 📥 Input Parameters (`POST /v1/media`)
| Variable | Type | Description |
|:---|:---|:---|
| `url` | `String` | Target URL to analyze. |

#### 📤 Output
| Variable | Type | Description |
|:---|:---|:---|
| `assets` | `Array` | List of media assets ranked by "Asset Score". |
| `total_count`| `Int` | Total number of media items found. |

#### 🧪 CURL Example
```bash
curl -X POST "http://localhost:8001/v1/media" \
-H "Content-Type: application/json" \
-H "X-API-KEY: {{API_KEY}}" \
-d '{"url": "https://example.com"}'
```

---

### 26. Plain Text Extraction Engine ✅
**Industry**: AI / NLP  
**Problem**: Cleaning messy HTML to get pure semantic text for LLM training or analysis.  
**Algorithm**: DOM Pruning (Script/Style/Nav removal) + Whitespace Normalization.

#### 📥 Input Parameters (`POST /v1/text`)
| Variable | Type | Description |
|:---|:---|:---|
| `url` | `String` | Target URL to extract text from. |

#### 📤 Output
| Variable | Type | Description |
|:---|:---|:---|
| `text` | `String` | Cleaned, plain-text content. |
| `char_count` | `Int` | Total character count. |

#### 🧪 CURL Example
```bash
curl -X POST "http://localhost:8001/v1/text" \
-H "Content-Type: application/json" \
-H "X-API-KEY: {{API_KEY}}" \
-d '{"url": "https://example.com"}'
```

---

### 27. Site Map Discovery Engine ✅
**Industry**: Intelligence / Research  
**Problem**: Mapping the architecture of a website without deep, recursive crawling.  
**Algorithm**: Domain-Restricted BFS Link Discovery + URL Normalization.

#### 📥 Input Parameters (`POST /v1/map`)
| Variable | Type | Description |
|:---|:---|:---|
| `url` | `String` | Root URL to start mapping from. |

#### 📤 Output
| Variable | Type | Description |
|:---|:---|:---|
| `internal_links`| `Array` | List of all discovered internal links. |
| `count` | `Int` | Total number of internal links found. |

#### 🧪 CURL Example
```bash
curl -X POST "http://localhost:8001/v1/map" \
-H "Content-Type: application/json" \
-H "X-API-KEY: {{API_KEY}}" \
-d '{"url": "https://example.com"}'
```

---

### 28. Structured Data Extraction Engine ✅
**Industry**: Intelligence / Research  
**Problem**: Parsing complex JSON-LD and Microdata schemas for knowledge graph construction.  
**Algorithm**: Recursive JSON-LD Parser + Schema.org Type Mapping.

#### 📥 Input Parameters (`POST /v1/extract`)
| Variable | Type | Description |
|:---|:---|:---|
| `url` | `String` | Target URL to extract structured data from. |

#### 📤 Output
| Variable | Type | Description |
|:---|:---|:---|
| `json_ld` | `Array` | List of parsed JSON-LD objects. |
| `schema_org_types`| `Array` | List of unique Schema.org types identified. |

#### 🧪 CURL Example
```bash
curl -X POST "http://localhost:8001/v1/extract" \
-H "Content-Type: application/json" \
-H "X-API-KEY: {{API_KEY}}" \
-d '{"url": "https://example.com"}'
```

---

### 29. Universal Webhook Listener ✅
**Industry**: Systems Integration  
**Problem**: Standardizing the receipt and validation of asynchronous webhooks.  
**Algorithm**: Request-Logging + Payload Validation + Signature Header Auditing.

#### 📥 Input Parameters (`POST /v1/webhook`)
Accepts any JSON payload via `POST`.

#### 📤 Output
| Variable | Type | Description |
|:---|:---|:---|
| `webhook_id` | `String` | Unique ID generated for the receipt. |
| `status` | `String` | Acknowledgement status. |

#### 🧪 CURL Example
```bash
curl -X POST "http://localhost:8001/v1/webhook" \
-H "Content-Type: application/json" \
-H "X-API-KEY: {{API_KEY}}" \
-d '{"event": "user.created", "data": {"id": 123}}'
```

---

### 30. Bulk Intelligence Orchestrator ✅
**Industry**: Data Engineering  
**Problem**: Orchestrating multiple intelligence tasks across thousands of URLs in parallel.  
**Algorithm**: Async IO Gathering + Dynamic Engine Mapping.

#### 📥 Input Parameters (`POST /v1/bulk`)
| Variable | Type | Description |
|:---|:---|:---|
| `tasks` | `Array` | List of `{url, engine}` objects. |

#### 📤 Output
| Variable | Type | Description |
|:---|:---|:---|
| `results` | `Array` | Aggregated results from each individual task. |
| `success_count` | `Int` | Number of tasks that completed without error. |

#### 🧪 CURL Example
```bash
curl -X POST "http://localhost:8001/v1/bulk" \
-H "Content-Type: application/json" \
-H "X-API-KEY: {{API_KEY}}" \
-d '{
  "tasks": [
    {"url": "https://google.com", "engine": "seo"},
    {"url": "https://example.com", "engine": "crawl"}
  ]
}'
```

---

### 31. Privacy-First Web Search Engine ✅
**Industry**: Intelligence / Research  
**Problem**: Programmatically gathering search results without tracking or heavy API fees.  
**Algorithm**: DuckDuckGo Search Scraper + Result Normalization.

#### 📥 Input Parameters (`POST /v1/search`)
| Variable | Type | Description |
|:---|:---|:---|
| `query` | `String` | Search query. |
| `limit` | `Int` | Max results to return. |

#### 📤 Output
| Variable | Type | Description |
|:---|:---|:---|
| `results` | `Array` | List of `{title, url, content}` objects. |
| `count` | `Int` | Number of results found. |

#### 🧪 CURL Example
```bash
curl -X POST "http://localhost:8001/v1/search" \
-H "Content-Type: application/json" \
-H "X-API-KEY: {{API_KEY}}" \
-d '{"query": "Open Source AI News", "limit": 5}'
```

---

### 🚀 Roadmap Status
- [x] 31/31 Intelligence Engines Implemented
- [x] Global API Security Layer
- [x] Full Pydantic Validation
- [x] Modular Documentation

---

## 🐳 Deployment
Optimized for deployment on **Coolify** via Docker. Ensure environmental variables for security-sensitive endpoints are set in the Coolify dashboard.
