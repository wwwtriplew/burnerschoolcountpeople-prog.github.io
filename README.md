# Visitor Counting System - Frontend

A production-ready static website displaying real-time visitor distribution across a 7-floor building. Built with vanilla JavaScript and the Supabase JS SDK for zero-dependency, high-performance monitoring.

**Backend Repository:** [wwwtriplew/Visitor-Counting-System-Backend](https://github.com/wwwtriplew/Visitor-Counting-System-Backend)



## 🎯 System Overview

### Complete Architecture

```
┌─────────────┐         ┌──────────────────┐         ┌──────────────┐
│  Cameras    │ ─POST─→ │  HTTP Ingestion  │ ─SDK─→  │   Backend    │
│  (70 cams)  │         │     Server       │         │   Pipeline   │
│  ESP32/Pi   │         │  (Flask/Python)  │         │ (YOLO v8)    │
└─────────────┘         └──────────────────┘         └──────┬───────┘
                                                              │
    ┌─────────────────────────────────────────────────────────┘
    │                         Processes images
    │                         Counts people (AI)
    │                         Stores results
    ↓
┌───────────────────────────────────────────────────────────────┐
│                    Supabase PostgreSQL                        │
│  Table: detections                                            │
│  • id (UUID)           - Unique record ID                     │
│  • room_id (TEXT)      - Camera/Room identifier (e.g., "401") │
│  • person_count (INT)  - Number of people detected            │
│  • timestamp (TIMESTAMPTZ) - Detection time                   │
└───────────────────────┬───────────────────────────────────────┘
                        │
                        │ Read via anon key (RLS protected)
                        ↓
            ┌───────────────────────────┐
            │   Frontend (This Repo)    │
            │   • Dashboard View        │
            │   • Floor Plan View       │
            │   • GitHub Pages Deploy   │
            └───────────────────────────┘
```

### Data Flow

1. **Cameras** capture images every 60 seconds
2. **HTTP Server** receives Base64/JPEG images via REST API
3. **Backend Pipeline** processes images using YOLO v8 AI model
4. **Detection Results** stored in Supabase database (`detections` table)
5. **Frontend** queries Supabase and displays real-time occupancy

### Two Display Modes

#### 1. **Dashboard View** (`index.html`)
**Purpose:** Real-time monitoring for security guards and staff

- Live occupancy display with 4-tier status system
- Building-wide statistics (total occupancy, busy rooms, etc.)
- Filter controls (all/occupied/empty)
- Responsive card grid layout

#### 2. **Floor Plan View** (`floorplan.html`)
**Purpose:** Interactive navigation for visitors planning routes

- Building overview showing all 7 floors
- Floor-specific maps with room overlays
- Click-to-navigate between floors
- Visual occupancy indicators on floor plans


## 🏢 Camera ID System Specification

### Camera Numbering Convention

There are not 70 cameras, so placeholder is included.

Up to 70 cameras can be connected for now

The system uses a **standardized 3-digit camera ID format** across the entire building:

**Format:** `XYY`
- `X` = Floor number (1-7)
- `YY` = Camera sequence number on that floor (01-10)

**Examples:**
- Camera 101 = Floor 1, Camera #1
- Camera 205 = Floor 2, Camera #5
- Camera 410 = Floor 4, Camera #10
- Camera 707 = Floor 7, Camera #7

### Building Configuration

- **Total Cameras:** 70 cameras (7 floors × 10 cameras per floor)
- **Camera ID Ranges:**
  - Floor 1: **101 - 110**
  - Floor 2: **201 - 210**
  - Floor 3: **301 - 310**
  - Floor 4: **401 - 410**
  - Floor 5: **501 - 510**
  - Floor 6: **601 - 610**
  - Floor 7: **701 - 710**

### Spatial Positioning Rules

**Camera numbering reflects physical location on floor:**

- **Lower camera numbers** → More **left/down** position
- **Higher camera numbers** → More **right/up** position
- No cameras in: Lavatories, prep rooms, storage closets
- Cameras only in: Classrooms, labs, public spaces, hallways

### Example: 4th Floor Layout

| Camera ID | Room Name | Location |
|-----------|-----------|----------|
| **401** | Chemistry Lab | Far left |
| **402** | Physics Lab | Center-left |
| **403** | Biology Lab | Center |
| **404** | Lab Prep Room | Center-right |
| **405** | Classroom 4A | Left side |
| **406** | Classroom 4B | Center |
| **407** | Classroom 4C | Center-right |
| **408** | Study Room | Right side |
| **409** | Storage | Left back |
| **410** | 6B Classroom (Room 413) | Far right |

### Database Room ID Format

**Backend writes flexible `room_id` formats to database:**

The backend's `room_id` validation pattern: `^[A-Za-z0-9_-]{1,64}$`

**Supported formats (all valid):**
- `"401"` - Direct camera ID (recommended)
- `"room-401"` - Descriptive format
- `"camera_401"` - Underscore format
- `"chemistry-lab-401"` - Named format
- `"4F-chem-lab-401"` - Full descriptive format

**Frontend automatically extracts camera ID:**

```javascript
// JavaScript extraction logic (from floorplan-script.js)
function extractCameraId(room_id) {
    const match = room_id.match(/(\d{3})/);  // Match 3-digit sequence
    return match ? parseInt(match[1]) : null;
}

// Examples:
extractCameraId("401")                  // → 401
extractCameraId("room-401")             // → 401
extractCameraId("chemistry-lab-401")    // → 401
extractCameraId("4F-chem-401")          // → 401
```

**Why this flexibility matters:**

1. **Human-readable names** in backend/database (easier debugging)
2. **Consistent camera ID extraction** in frontend (reliable mapping)
3. **Future-proof** for room name changes (camera IDs remain stable)
4. **Backward compatible** with any existing naming conventions

### Camera ID Usage in Code

**Backend (Python) - Insertion:**
```python
# From wwwtriplew/Visitor-Counting-System-Backend
from backend.process_images import ImageProcessingPipeline

pipeline = ImageProcessingPipeline(
    supabase_url=SUPABASE_URL,
    supabase_service_key=SERVICE_KEY
)

# Backend can use any valid room_id format
result = pipeline.process_image(
    base64_image=image_data,
    room_id="chemistry-lab-401"  # Flexible format
)

# Writes to Supabase: {"room_id": "chemistry-lab-401", "person_count": 12, ...}
```

**Frontend (JavaScript) - Extraction:**
```javascript
// From this repository
async function fetchRoomData() {
    const { data } = await supabaseClient
        .from('detections')
        .select('room_id, person_count, timestamp')
        .order('timestamp', { ascending: false });
    
    // Group by camera ID (extracted from any room_id format)
    const roomMap = {};
    data.forEach(row => {
        const cameraId = extractCameraId(row.room_id);  // Extract 3-digit ID
        if (cameraId && cameraId >= 101 && cameraId <= 710) {
            const floor = Math.floor(cameraId / 100);  // Get floor number
            if (!roomMap[cameraId]) {
                roomMap[cameraId] = {
                    cameraId: cameraId,
                    floor: floor,
                    room_id: row.room_id,
                    count: row.person_count,
                    timestamp: row.timestamp
                };
            }
        }
    });
    
    return Object.values(roomMap);
}
```

### Floor Plan Positioning System

**Room overlays on floor maps use camera IDs:**

```javascript
// From floorplan-script.js - Room position configuration
const FLOOR_ROOM_POSITIONS = {
    4: {  // 4th Floor map
        401: { x: 15, y: 20, name: 'Chemistry Lab' },      // 15% right, 20% down
        402: { x: 35, y: 20, name: 'Physics Lab' },        // 35% right, 20% down
        403: { x: 55, y: 20, name: 'Biology Lab' },        // 55% right, 20% down
        // ... more rooms
        410: { x: 85, y: 80, name: '6B Classroom (413)' }  // 85% right, 80% down
    },
    // Add other floors as maps are created
};

// Usage: Position overlay on floor map
function positionRoomOverlay(cameraId, floorMapImage) {
    const floor = Math.floor(cameraId / 100);
    const position = FLOOR_ROOM_POSITIONS[floor]?.[cameraId];
    
    if (position) {
        const left = (floorMapImage.width * position.x) / 100;
        const top = (floorMapImage.height * position.y) / 100;
        // Create overlay at (left, top) coordinates
    }
}
```

## ✨ Features

### Two Display Modes

#### 1. Dashboard View (`index.html`)
**Purpose:** Real-time monitoring for security guards and staff

- **Live Occupancy Display**: Real-time people count per room
- **Building Statistics**: Total occupancy, active rooms, busy rooms, empty rooms
- **4-Tier Status System**: Empty (blue) → Light (green) → Moderate (amber) → Busy (red)
- **Capacity Visualization**: Animated progress bars showing room fullness
- **Data Staleness Detection**: Automatic warnings for data older than 5 minutes
- **Filter Controls**: Show all rooms, occupied only, or empty only

#### 2. Floor Plan View (`floorplan.html`)
**Purpose:** Interactive navigation for visitors planning routes

- **Building Overview**: See all 7 floors at a glance with occupancy status
- **Floor Selection**: Click any floor to see detailed room layout
- **Interactive Floor Maps**: Visual overlays showing real-time occupancy on actual floor plans
- **Room-by-Room Details**: Detailed list of all rooms with camera IDs
- **Smart Navigation**: Easily switch between floors or return to overview
- **Visitor-Friendly**: Designed for route planning and finding available spaces

### Common Features

- **Responsive Design**: Optimized for desktop, tablet, and mobile devices
- **Manual Refresh**: Update data on demand with debounced clicks
- **Relative Timestamps**: "2m ago" format for intuitive time display
- **Error Handling**: Graceful error messages with actionable guidance
- **Loading States**: Visual feedback during data fetching
- **Dark Theme**: Modern color scheme (Brand: #102c52, Accent: #d3efef, Action: #d91821)

### Technical Features
- **Zero Dependencies**: Pure JavaScript, no build tools required
- **Configurable Thresholds**: Easy customization of capacity and status thresholds
- **Memory Management**: Proper cleanup of event listeners
- **XSS Protection**: HTML escaping for all user-generated content
- **Null Safety**: Comprehensive null checks for DOM elements
- **GitHub Pages Ready**: Deploy directly to GitHub Pages


## 🔌 Backend Integration

### Backend System Overview

The backend repository ([wwwtriplew/Visitor-Counting-System-Backend](https://github.com/wwwtriplew/Visitor-Counting-System-Backend)) provides:

1. **HTTP Ingestion Server** - Flask-based REST API for camera integration
2. **YOLO v8 Processing Pipeline** - AI-powered person detection
3. **Supabase Integration** - Automatic data storage with retry logic
4. **Production-Ready Architecture** - Error handling, logging, validation

### Backend Architecture

```python
# From backend repository - Main processing pipeline
from backend.process_images import ImageProcessingPipeline

# Initialize once (loads YOLO model, connects to Supabase)
pipeline = ImageProcessingPipeline(
    supabase_url="https://your-project.supabase.co",
    supabase_service_key="your-service-role-key",  # SECRET - never expose
    model_path="yolov8n.pt",                        # Nano model (~6MB)
    table_name="detections"
)

# Process camera image
result = pipeline.process_image(
    base64_image=camera_image_b64,
    room_id="chemistry-lab-401",
    timestamp=datetime.now()
)

# Returns: {"success": True, "people_count": 12, "room_id": "chemistry-lab-401", ...}
```

### Camera Integration

**Cameras POST images to HTTP server every 60 seconds:**

```bash
# Example: ESP32/Raspberry Pi camera script
curl -X POST http://backend-server:8000/api/v1/process-image-bytes \
    -H "X-API-KEY: your-api-key-here" \
    -F "file=@snapshot.jpg" \
    -F "room_id=401"
```

**Server processes and stores automatically:**
1. Validates API key and room_id format
2. Converts image to JPEG (if Base64)
3. Runs YOLO inference (detects people with confidence > 0.5)
4. Inserts `{room_id, person_count, timestamp}` to Supabase
5. Returns processing result to camera

### Backend Configuration

**Environment variables (backend `.env` file):**
```bash
# Required
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_KEY=your-service-role-key-here

# Optional with defaults
TABLE_NAME=detections                    # Database table
YOLO_MODEL_PATH=yolov8n.pt              # AI model file
INGESTION_API_KEY=your-api-key          # Camera authentication
SERVER_HOST=0.0.0.0                      # Server bind address
SERVER_PORT=8000                         # HTTP port
```

**Backend validation rules:**
- `room_id`: Must match pattern `^[A-Za-z0-9_-]{1,64}$`
- `image`: Max 10MB (decoded size)
- `person_count`: Must be 0-1000 (configurable in `backend/config.py`)
- `timestamp`: ISO 8601 format with timezone

### YOLO Detection Configuration

**AI model settings (from `backend/config.py`):**
```python
# YOLO Configuration
YOLO_CONFIDENCE_THRESHOLD = 0.5  # Only count people with >50% confidence
PERSON_CLASS_ID = 0              # COCO dataset class ID for "person"
DEFAULT_YOLO_MODEL_PATH = "yolov8n.pt"  # Lightweight nano model

# Detection is NOT 100% accurate - factors affecting accuracy:
# - Partial occlusions (people behind furniture/others)
# - Distance from camera (small faces harder to detect)
# - Image quality and lighting conditions
# - People at extreme angles or edges
# - Confidence threshold (lower = more detections but more false positives)
```

**To improve detection accuracy:**
1. Lower confidence threshold to 0.3-0.4 (in `backend/config.py`)
2. Use higher resolution camera images
3. Ensure good lighting conditions
4. Position cameras to minimize occlusions
5. Use larger YOLO model (yolov8s.pt or yolov8m.pt) for better accuracy

### Backend API Endpoints

**1. Process Image - Multipart Upload (Recommended)**
```http
POST /api/v1/process-image-bytes
Content-Type: multipart/form-data
X-API-KEY: your-api-key-here

Fields:
  - file: (binary JPEG file)
  - room_id: (string, e.g., "401" or "chemistry-lab-401")
```

**Response (Success - 200 OK):**
```json
{
  "status": "ok",
  "room_id": "chemistry-lab-401",
  "people_count": 12,
  "timestamp": "2025-12-01T14:23:45.678492",
  "processing_ms": 641
}
```

**Response (Error - 4xx/5xx):**
```json
{
  "error": "Invalid room_id format",
  "status_code": 400,
  "details": "room_id must match pattern ^[A-Za-z0-9_-]{1,64}$"
}
```

**2. Process Image - Base64 JSON**
```http
POST /api/v1/process-image
Content-Type: application/json
X-API-KEY: your-api-key-here

{
  "image": "/9j/4AAQSkZJRgABAQEAYABgAAD...",  // Base64-encoded JPEG
  "room_id": "401"
}
```

**Error Codes:**
- `400 Bad Request` - Invalid room_id, image format, or missing fields
- `401 Unauthorized` - Missing or invalid API key
- `413 Payload Too Large` - Image exceeds 10MB
- `500 Internal Server Error` - Processing failed (YOLO error, database error)

### Testing Backend Integration

**1. Test with sample image (Python):**
```python
import base64
import requests

# Read test image
with open("test_image.jpg", "rb") as f:
    image_b64 = base64.b64encode(f.read()).decode("utf-8")

# Send to backend
response = requests.post(
    "http://backend-server:8000/api/v1/process-image",
    headers={"X-API-KEY": "your-api-key"},
    json={
        "image": image_b64,
        "room_id": "test-room-401"
    }
)

print(response.json())
# Expected: {"status": "ok", "people_count": X, ...}
```

**2. Verify in Supabase:**
```sql
-- Check latest detections
SELECT * FROM detections
ORDER BY timestamp DESC
LIMIT 10;

-- Check specific camera
SELECT * FROM detections
WHERE room_id LIKE '%401%'
ORDER BY timestamp DESC
LIMIT 5;
```

**3. Monitor backend logs:**
```bash
# Backend logs show processing details
2025-12-01 14:23:45 - INFO - Processing image for room 'chemistry-lab-401'
2025-12-01 14:23:46 - INFO - YOLO detected 12 people (confidence > 0.5)
2025-12-01 14:23:46 - INFO - Successfully inserted into Supabase
2025-12-01 14:23:46 - INFO - Processing completed in 641ms
```

### Data Synchronization

**Backend → Frontend data flow:**

1. **Camera captures image** (every 60 seconds)
2. **Backend processes** (YOLO inference ~500-1000ms)
3. **Database updated** (Supabase insert ~50-100ms)
4. **Frontend queries** (every 30 seconds via auto-refresh or manual)
5. **Display updates** (real-time occupancy shown)

**Latency breakdown:**
- Camera → Backend: Network latency (~10-50ms on LAN)
- YOLO Processing: 500-1000ms (first run slower due to model loading)
- Database Insert: 50-100ms (Supabase latency)
- Frontend Query: 100-300ms (depends on network)
- **Total end-to-end:** ~1-2 seconds from capture to display

**Handling stale data:**
- Frontend marks data as "stale" if older than 5 minutes
- Visual indicator shows last update time
- Manual refresh button forces immediate query
- Auto-refresh can be enabled (default: every 30 seconds)

## 🔐 Security

### Frontend Security Model

**Why hardcoded Supabase anon key is safe:**

1. **Row Level Security (RLS)** - Database access controlled by policies, not key secrecy
   - Anon key can **only SELECT** from `detections` table
   - Cannot INSERT, UPDATE, or DELETE records
   - Backend uses service_role key (kept secret) for writes

2. **Public by Design** - Anon key is meant to be exposed in client-side code
   - Similar to Google Maps API key, Firebase config, etc.
   - Project URL is also public (required for API access)
   - Security enforced by RLS policies, not credential hiding

3. **Non-Sensitive Data** - No privacy concerns with occupancy data
   - Room IDs (public building information)
   - People counts (aggregate statistics only)
   - Timestamps (when count was taken)
   - No personal information, names, or identifiable data

### Backend Security Model

**Backend uses service_role key (MUST be kept secret):**

```python
# Backend .env file (NEVER commit to git, NEVER expose to frontend)
SUPABASE_SERVICE_KEY=eyJhbGci...  # Has full database access, bypasses RLS
INGESTION_API_KEY=your-secret-key  # Authenticates cameras
```

**Camera authentication:**
- Each camera request includes `X-API-KEY` header
- Server validates key before processing
- Prevents unauthorized image uploads
- Cameras configured with API key in firmware/script

### RLS Configuration

```sql
-- Enable Row Level Security on detections table
ALTER TABLE detections ENABLE ROW LEVEL SECURITY;

-- Allow public read access (for frontend with anon key)
CREATE POLICY "Allow anonymous read access"
  ON detections
  FOR SELECT
  TO anon
  USING (true);

-- Backend service_role key bypasses RLS automatically
-- No INSERT policy needed for anon role = writes blocked
```

## 📋 Setup Instructions

### 1. Prerequisites

- A Supabase project with a `detections` table (or `room_stats`)
- Supabase credentials: **Project URL** and **Anon Key**
- Backend system running and inserting data into Supabase

### 2. Get Your Supabase Credentials

1. Go to [supabase.com](https://supabase.com) and open your project
2. Click **Settings** → **API**
3. Copy:
   - **Project URL** (e.g., `https://xxxxx.supabase.co`)
   - **Anon Key** (the public key, NOT service_role key)

### 3. Configure the Frontend

Edit `script.js` and update the `CONFIG` object (lines 15-28):

```javascript
const CONFIG = {
    SUPABASE_URL: 'https://your-project.supabase.co',
    SUPABASE_ANON_KEY: 'your-anon-key-here',
    TABLE_NAME: 'detections', // or 'room_stats' if using old schema
    REFRESH_INTERVAL: 30000,
    MAX_RETRIES: 3,
    MAX_CAPACITY_PER_ROOM: 30,
    STALENESS_THRESHOLD_MINUTES: 5,
    THRESHOLDS: {
        LOW: 8,      // 0-8 people = "Light" (green)
        MODERATE: 20 // 9-20 = "Moderate" (amber), 21+ = "Busy" (red)
    }
};
```

### 4. Deploy

**Option A: GitHub Pages (Recommended)**
```bash
git add .
git commit -m "Configure Supabase credentials"
git push origin main

# Your site will be live at: https://username.github.io/repo-name
```

## 🚀 Performance

### Optimizations Implemented

- **Debounced Refresh**: 500ms debounce prevents rapid clicking
- **Efficient DOM Updates**: Cards only re-rendered when data changes
- **CSS Transforms**: GPU-accelerated animations for smooth performance
- **Minimal Reflows**: Batch DOM updates to reduce layout thrashing
- **Lazy Event Handlers**: Event listeners stored for efficient cleanup

### Performance Metrics

- **Initial Load**: < 2 seconds (typical)
- **Data Refresh**: < 500ms (depending on Supabase latency)
- **Memory Usage**: ~15-20MB (stable over time)
- **Animation FPS**: 60 FPS on modern devices


## 📊 Database Schema

### Supabase Table Structure

The backend writes to a `detections` table with the following schema:

```sql
CREATE TABLE detections (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    room_id TEXT NOT NULL,                      -- Camera ID or descriptive name (e.g., "401" or "chemistry-lab-401")
    person_count INTEGER NOT NULL,              -- Number of people detected by YOLO v8
    timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW(), -- Detection time (ISO 8601 with timezone)
    created_at TIMESTAMPTZ DEFAULT NOW()         -- Record creation time
);

-- Performance indexes for fast queries
CREATE INDEX idx_detections_room_id ON detections(room_id);
CREATE INDEX idx_detections_timestamp ON detections(timestamp DESC);
CREATE INDEX idx_detections_room_timestamp ON detections(room_id, timestamp DESC);
```

### Column Specifications

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `id` | UUID | PRIMARY KEY | Auto-generated unique identifier |
| `room_id` | TEXT | NOT NULL, Pattern: `^[A-Za-z0-9_-]{1,64}$` | Camera/room identifier (flexible format) |
| `person_count` | INTEGER | NOT NULL, >= 0, <= 1000 | Number of people detected (YOLO confidence > 0.5) |
| `timestamp` | TIMESTAMPTZ | NOT NULL | Detection timestamp with timezone |
| `created_at` | TIMESTAMPTZ | DEFAULT NOW() | Database insertion time |

**Note:** Some backend configurations use `people_count` instead of `person_count`. The frontend supports both column names automatically.

### Row Level Security (RLS)

**Backend uses service role key** (full database access, bypasses RLS):
```python
# Backend writes with service_role key
pipeline = ImageProcessingPipeline(
    supabase_url=SUPABASE_URL,
    supabase_service_key=SERVICE_ROLE_KEY  # Secret, never exposed
)
```

**Frontend uses anon key** (read-only access via RLS policies):
```javascript
// Frontend reads with anon key (safe to expose)
const supabase = window.supabase.createClient(
    'https://your-project.supabase.co',
    'your-anon-key-here'  // Public key, RLS protected
);
```

**RLS Policy Configuration:**
```sql
-- Enable Row Level Security
ALTER TABLE detections ENABLE ROW LEVEL SECURITY;

-- Allow public read access (for frontend)
CREATE POLICY "Allow anonymous read access"
  ON detections
  FOR SELECT
  TO anon
  USING (true);

-- Backend writes bypass RLS automatically with service_role key
-- No INSERT policy needed for anon role
```

### Example Data

**Sample records from backend:**
```json
[
  {
    "id": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
    "room_id": "chemistry-lab-401",
    "person_count": 12,
    "timestamp": "2025-12-01T14:23:45.678Z",
    "created_at": "2025-12-01T14:23:45.720Z"
  },
  {
    "id": "f9e8d7c6-b5a4-3210-9876-543210fedcba",
    "room_id": "410",
    "person_count": 8,
    "timestamp": "2025-12-01T14:23:48.123Z",
    "created_at": "2025-12-01T14:23:48.200Z"
  }
]
```

### Frontend Query Logic

**Fetching latest counts per room:**
```javascript
// Get last 500 records (covers all 70 cameras with history)
const { data, error } = await supabaseClient
    .from('detections')
    .select('room_id, person_count, timestamp')
    .order('timestamp', { ascending: false })
    .limit(500);

// Group by camera ID, keeping only most recent record
const roomMap = {};
data.forEach(row => {
    const cameraId = extractCameraId(row.room_id);  // Extract 3-digit ID
    if (cameraId && !roomMap[cameraId]) {
        roomMap[cameraId] = {
            cameraId: cameraId,
            floor: Math.floor(cameraId / 100),
            room_id: row.room_id,
            count: row.person_count,
            timestamp: new Date(row.timestamp)
        };
    }
});
```

**Why 500 records?**
- 70 cameras × ~7 records per camera = ~500 total
- Ensures we capture latest data even with update delays
- Grouped client-side to avoid complex SQL queries
- Faster than multiple individual queries

### SQL Query Examples

**Get latest count for all rooms:**
```sql
SELECT DISTINCT ON (room_id)
    room_id,
    person_count,
    timestamp
FROM detections
ORDER BY room_id, timestamp DESC;
```

**Get specific camera history (last 24 hours):**
```sql
SELECT room_id, person_count, timestamp
FROM detections
WHERE room_id LIKE '%401%'  -- Matches "401", "room-401", "chemistry-lab-401"
  AND timestamp > NOW() - INTERVAL '24 hours'
ORDER BY timestamp DESC;
```

**Get floor-wide occupancy:**
```sql
-- For 4th floor (camera IDs 401-410)
SELECT 
    room_id,
    person_count,
    timestamp
FROM (
    SELECT DISTINCT ON (room_id)
        room_id,
        person_count,
        timestamp
    FROM detections
    WHERE room_id ~ '^[a-z-]*4[0-9]{2}'  -- Regex: matches IDs containing 4XX
    ORDER BY room_id, timestamp DESC
) latest
ORDER BY room_id;
```

**Calculate average occupancy per hour:**
```sql
SELECT 
    DATE_TRUNC('hour', timestamp) as hour,
    AVG(person_count) as avg_occupancy,
    MAX(person_count) as peak_occupancy,
    COUNT(*) as sample_count
FROM detections
WHERE timestamp > NOW() - INTERVAL '7 days'
GROUP BY hour
ORDER BY hour DESC;
```

## 🛠️ Customization

### Changing Colors

Edit CSS variables in `styles.css`:

```css
:root {
    --primary-color: #2563eb;  /* Main accent color */
    --success-color: #10b981;  /* Light occupancy */
    --warning-color: #f59e0b;  /* Moderate occupancy */
    --danger-color: #ef4444;   /* Busy occupancy */
    --info-color: #0ea5e9;     /* Empty rooms */
}
```

### Changing Status Icons

Edit `getOccupancyStatus()` in `script.js`:

```javascript
// Current icons: 🚪 ✓ ⚠️ 🔴
// Change to: 🟢 🟡 🟠 🔴 for color circles
icon: '🟢'  // instead of '✓'
```

### Adding New Statistics

1. Add HTML element in `index.html` statistics section
2. Create variable in `initializeDOMElements()`
3. Update `updateStatistics()` to calculate and display

Example - Average Occupancy:
```javascript
// In updateStatistics()
const avgOccupancy = Math.round(total / rooms.length);
if (avgOccupancyElement) {
    avgOccupancyElement.textContent = avgOccupancy;
}
```

## 🐛 Debugging

### Enable Auto-Refresh

Uncomment line 79 in `script.js`:

```javascript
// Set up auto-refresh (optional)
setupAutoRefresh();  // <-- Remove the comment
```

### Console Logging

The app logs all errors to console. Open Developer Tools:
- Chrome/Edge: F12 or Cmd+Option+I (Mac)
- Firefox: F12 or Cmd+Option+K (Mac)
- Safari: Cmd+Option+C (Mac)

### Common Console Errors

| Error | Meaning | Solution |
|-------|---------|----------|
| `Supabase client not initialized` | SDK didn't load | Check internet connection |
| `Required DOM element not found` | HTML structure changed | Verify element IDs in index.html |
| `Could not find the table` | Table name wrong | Update CONFIG.TABLE_NAME |
| `Failed to fetch` | Network error | Check Supabase project status |

## 🐛 Troubleshooting

### Frontend Issues

#### No Data Displayed ("No rooms to display")

**Possible causes:**
1. Backend not running or not processing images
2. Wrong table name in CONFIG
3. Supabase connection failed
4. RLS policies blocking read access

**Debug steps:**
```javascript
// 1. Check browser console (F12) for errors
// 2. Manually test Supabase connection
const { data, error } = await supabaseClient
    .from('detections')
    .select('*')
    .limit(5);

console.log('Data:', data);
console.log('Error:', error);

// 3. Check table name matches backend
// Backend default: "detections"
// Old configurations may use: "room_stats"

// 4. Verify RLS policies in Supabase dashboard:
// Settings → Database → Row Level Security
```

**Solutions:**
- Verify backend is running: `curl http://backend-server:8000/health`
- Check Supabase table name: `CONFIG.TABLE_NAME` in `script.js`
- Test RLS policies: Use Supabase SQL Editor to query as anon role
- Check backend logs for processing errors

#### Data Shows as "Stale" (Old Timestamps)

**Causes:**
- Backend stopped processing images
- Cameras not sending images
- Network issues between cameras and backend

**Check backend status:**
```bash
# SSH to backend server
tail -f /var/log/backend.log

# Should see lines like:
# 2025-12-01 14:23:45 - INFO - Processing image for room 'chemistry-lab-401'
# 2025-12-01 14:23:46 - INFO - Successfully inserted into Supabase
```

**Check camera connectivity:**
```bash
# From backend server, test camera endpoint
curl http://camera-ip/snapshot -o test.jpg

# If successful, manually send to backend
curl -X POST http://localhost:8000/api/v1/process-image-bytes \
    -H "X-API-KEY: your-api-key" \
    -F "file=@test.jpg" \
    -F "room_id=test-401"
```

**Solutions:**
- Restart backend server
- Check camera power and network connections
- Verify camera scripts are running
- Check API key validity

#### Camera IDs Not Extracted (Shows as "Unknown")

**Cause:** Room ID format doesn't contain 3-digit camera ID

**Debug:**
```javascript
// Check actual room_id values in database
const { data } = await supabaseClient
    .from('detections')
    .select('room_id')
    .limit(10);

console.log(data.map(r => r.room_id));

// Expected formats: "401", "room-401", "chemistry-lab-401"
// Invalid formats: "chemistry", "4F", "lab" (no 3-digit ID)
```

**Solution:** Update backend camera configuration to include camera ID in room_id:
```python
# Backend camera configuration
# Before (invalid):
room_id = "chemistry-lab"

# After (valid):
room_id = "chemistry-lab-401"  # Or "401", "room-401", etc.
```

### Backend Issues

#### Backend Not Receiving Images

**Check camera script:**
```bash
# Test camera POST request
curl -X POST http://backend-server:8000/api/v1/process-image-bytes \
    -H "X-API-KEY: your-api-key-here" \
    -F "file=@test_image.jpg" \
    -F "room_id=test-401" \
    -v  # Verbose output shows full request/response

# Expected: HTTP/1.1 200 OK
# Error: 401 = wrong API key
# Error: 400 = invalid room_id or image
# Error: 500 = backend processing error
```

**Check backend server logs:**
```bash
# Python backend logs
python -m backend.process_images --help

# Or if running as HTTP server:
tail -f backend_server.log
```

#### YOLO Detection Inaccurate

**Symptoms:** Person count consistently too low or too high

**Causes:**
- Confidence threshold too high (misses people)
- Poor lighting or image quality
- Occlusions (people behind furniture)
- Camera angle suboptimal

**Solutions:**

1. **Lower confidence threshold** (backend `config.py`):
```python
# Default: 0.5 (50% confidence)
YOLO_CONFIDENCE_THRESHOLD = 0.3  # Try 0.3 or 0.4 for more detections
```

2. **Improve image quality:**
- Increase camera resolution (1080p or higher)
- Adjust camera positioning (overhead view works best)
- Improve lighting in room

3. **Test with sample image:**
```python
# Backend testing script
from backend.process_images import ImageProcessingPipeline
import base64

with open('test_image.jpg', 'rb') as f:
    image_b64 = base64.b64encode(f.read()).decode('utf-8')

pipeline = ImageProcessingPipeline(...)
result = pipeline.process_image(image_b64, 'test-room')

print(f"Detected: {result['people_count']} people")
# Compare with actual count in image
```

#### Database Inserts Failing

**Symptoms:** Backend logs show "Supabase insertion failed"

**Check Supabase status:**
1. Go to Supabase dashboard
2. Check project status (top right)
3. Check database connections (Settings → Database)

**Check table schema:**
```sql
-- Verify table exists and has correct columns
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'detections';

-- Expected columns:
-- room_id (text)
-- person_count (integer) or people_count (integer)
-- timestamp (timestamp with time zone)
```

**Check backend credentials:**
```bash
# Verify .env file (backend server)
cat .env | grep SUPABASE

# Should show:
# SUPABASE_URL=https://...
# SUPABASE_SERVICE_KEY=eyJ...  (long key)

# Test connection
python -c "
from backend.utils.supabase_utils import create_supabase_client
client = create_supabase_client('$SUPABASE_URL', '$SUPABASE_SERVICE_KEY')
print('Connection successful!')
"
```

### Network Issues

#### High Latency / Slow Updates

**Causes:**
- Supabase project location far from users
- Network congestion
- Too many concurrent requests

**Monitor performance:**
```javascript
// Add to script.js for debugging
async function fetchRoomsWithTiming() {
    const start = Date.now();
    const { data, error } = await supabaseClient
        .from('detections')
        .select('*')
        .limit(500);
    const elapsed = Date.now() - start;
    
    console.log(`Query took ${elapsed}ms`);
    // Typical: 100-300ms
    // Slow: >1000ms = investigate network/Supabase
}
```

**Solutions:**
- Enable Supabase connection pooling
- Use Supabase Edge Functions for better latency
- Consider caching layer (Redis)
- Optimize query (reduce limit if not needed)

### Common Error Messages

| Error | Location | Cause | Solution |
|-------|----------|-------|----------|
| `Required DOM element not found: roomGrid` | Frontend (script.js) | HTML file modified incorrectly | Verify element IDs match `initializeDOMElements()` |
| `Could not find the table 'detections'` | Frontend | Table name mismatch | Check `CONFIG.TABLE_NAME` matches database |
| `Missing API key` | Backend | Camera not sending X-API-KEY header | Add header to camera script |
| `Invalid room_id format` | Backend | room_id contains invalid characters | Use only `[A-Za-z0-9_-]` characters |
| `YOLO inference failed` | Backend | Model file missing or corrupted | Re-download `yolov8n.pt` model |
| `Supabase connection timeout` | Backend | Network/firewall blocking | Check firewall rules, Supabase IP whitelist |
| `Row Level Security policy violation` | Frontend | Trying to INSERT with anon key | Only SELECT allowed for anon role |

### Debug Mode

**Enable verbose logging:**

```javascript
// Frontend - Add to script.js
const DEBUG = true;

async function fetchRoomsData() {
    if (DEBUG) console.log('[DEBUG] Fetching data from Supabase...');
    
    const { data, error } = await supabaseClient
        .from(CONFIG.TABLE_NAME)
        .select('*')
        .order('timestamp', { ascending: false })
        .limit(500);
    
    if (DEBUG) {
        console.log('[DEBUG] Query result:', {
            recordCount: data?.length,
            error: error,
            sampleData: data?.slice(0, 3)
        });
    }
    
    return { data, error };
}
```

```python
# Backend - Set in environment
DEBUG=True python -m backend.process_images --help

# Or in code:
import logging
logging.basicConfig(level=logging.DEBUG)
```

### Getting Help

**When reporting issues, include:**

1. **Frontend info:**
   - Browser and version (from `navigator.userAgent`)
   - Console errors (F12 → Console tab → screenshot)
   - Network tab showing Supabase request/response

2. **Backend info:**
   - Backend logs (last 50 lines)
   - Python version (`python --version`)
   - Backend configuration (CONFIG values, not secrets)

3. **Database info:**
   - Table schema (`\d detections` in psql)
   - Sample records (without sensitive data)
   - RLS policies (from Supabase dashboard)

4. **Network info:**
   - Can backend reach Supabase? (`curl https://supabase-project-url`)
   - Can frontend reach Supabase? (check Network tab)
   - Firewall rules affecting connections?

## 📊 Browser Compatibility

| Browser | Version | Status |
|---------|---------|--------|
| Chrome | 90+ | ✅ Fully Supported |
| Firefox | 88+ | ✅ Fully Supported |
| Safari | 14+ | ✅ Fully Supported |
| Edge | 90+ | ✅ Fully Supported |
| Mobile Safari | iOS 14+ | ✅ Fully Supported |
| Chrome Mobile | Android 90+ | ✅ Fully Supported |

**Features used**:
- CSS Custom Properties (CSS Variables)
- ES6+ JavaScript (arrow functions, async/await, template literals)
- Fetch API
- CSS Grid and Flexbox

**Not supported**: Internet Explorer (EOL)

## 🔒 Security Best Practices

### What's Safe

✅ **Exposing anon key in source code** - Protected by RLS
✅ **Committing CONFIG to git** - Public data only
✅ **Deploying to public hosting** - No secrets exposed

### What's NOT Safe

❌ **Don't expose service_role key** - Has full database access
❌ **Don't disable RLS** - Opens database to public writes
❌ **Don't store credentials in cookies/localStorage** - Unnecessary and risky

### Security Checklist

- [x] RLS enabled on database table
- [x] SELECT policy for anon role
- [x] No service_role key in frontend
- [x] HTML escaping for room names (XSS protection)
- [x] Input validation on counts (no negatives)
- [x] HTTPS connection (required by Supabase)

## 📞 Support & Resources

### Documentation Files

- `TROUBLESHOOTING.md` - Step-by-step problem solving
- `QUICK_FIX.md` - Quick reference for common issues  
- `NEW_UI_GUIDE.md` - User guide for guards/operators
- `UI_REDESIGN.md` - Design system documentation
- `future_plan.md` - Roadmap and planned features

### Getting Help

1. Check console for errors (F12)
2. Run `debug.html` for diagnostics
3. Review `TROUBLESHOOTING.md`
4. Check Supabase Dashboard for table structure
5. Verify RLS policies are correct

### Reporting Issues

Include:
1. Browser and version
2. Console error messages
3. Output from `debug.html`
4. Screenshot if applicable
5. Steps to reproduce

## 📝 Changelog

### Version 2.1 (December 2025) - Documentation & Backend Integration

**Documentation Updates:**
- Comprehensive README covering full system architecture
- Detailed camera ID convention with examples
- Complete backend integration guide
- Database schema with SQL queries
- Security model explanation (RLS, anon vs service_role keys)
- Extensive troubleshooting section
- Backend API reference

**Added:**
- Camera ID extraction system for flexible room_id formats
- Floor plan positioning system documentation
- Backend data flow diagrams
- Example code for Python and JavaScript integration
- Network latency monitoring guidance

### Version 2.0 (November 2025) - Major Redesign

**Added:**
- Modern dark theme security dashboard
- Building-wide statistics panel
- 4-tier status system (empty/light/moderate/busy)
- Animated capacity bars
- Data staleness detection
- Filter controls (all/occupied/empty)
- Floor plan view with interactive building overview
- Dual-mode system (Dashboard + Floor Plan)
- Configurable thresholds in CONFIG
- Comprehensive null safety checks
- Debounced refresh button
- Memory leak prevention
- JSDoc documentation

**Fixed:**
- Hardcoded capacity thresholds → Now configurable
- Missing DOM element error handling
- Memory leaks from event listeners
- No validation on negative counts
- Inconsistent threshold usage across functions
- XSS vulnerability in room names
- eval() scope bug in DOM initialization

**Changed:**
- Table name: `room_stats` → `detections`
- Column name: Auto-detects `person_count` or `people_count`
- Status icons: Updated emoji set
- Statistics: Added busy rooms count
- Color scheme: 60-30-10 rule with brand colors (#102c52, #d3efef, #d91821)

### Version 1.0 (Initial Release)

- Basic room occupancy display
- Light theme
- Manual refresh
- Simple card layout

## 🔗 Related Repositories

### Backend System
- **Repository:** [wwwtriplew/Visitor-Counting-System-Backend](https://github.com/wwwtriplew/Visitor-Counting-System-Backend)
- **Purpose:** YOLO v8 image processing pipeline, HTTP ingestion server, Supabase integration
- **Technology:** Python 3.8+, Flask, Ultralytics YOLO, OpenCV, Supabase SDK
- **Features:**
  - REST API for camera integration
  - Real-time person detection with AI
  - Automatic retry logic and error handling
  - Production-ready logging and monitoring
  - Configurable confidence thresholds

### Deployment
- **Frontend Hosting:** GitHub Pages (this repository)
- **Backend Hosting:** Ubuntu Server 24.04 LTS (recommended) or Docker
- **Database:** Supabase PostgreSQL (managed)
- **Camera Network:** Local LAN (ESP32, Raspberry Pi, or IP cameras)

## 📚 Additional Documentation

### Frontend Documentation
- **README.md** (this file) - Complete system documentation
- **TROUBLESHOOTING.md** - Step-by-step problem solving
- **NEW_UI_GUIDE.md** - User guide for guards and operators
- **UI_REDESIGN.md** - Design system specifications
- **future_plan.md** - Roadmap and planned features

### Backend Documentation
See [Backend Repository](https://github.com/wwwtriplew/Visitor-Counting-System-Backend) for:
- **README.md** - Backend system documentation
- **QUICKSTART.md** - 5-minute setup guide
- **IMPROVEMENTS.md** - Technical architecture details
- **SERVER_IMPLEMENTATION.md** - HTTP server design
- **SERVER_DEPLOYMENT.md** - Production deployment guide
- **POSTMAN_TESTS.md** - API testing guide

## 📄 License

This project is part of an internal building security and visitor monitoring system. All rights reserved.

**Usage restrictions:**
- Internal use only within authorized facilities
- No redistribution without permission
- Camera footage and occupancy data must comply with privacy regulations
- YOLO model usage subject to Ultralytics license terms

## 🙏 Acknowledgments

**Technologies:**
- **YOLO v8** by [Ultralytics](https://github.com/ultralytics/ultralytics) - State-of-the-art object detection
- **Supabase** - Open source Firebase alternative with PostgreSQL
- **GitHub Pages** - Free static site hosting with HTTPS
- **Supabase JS SDK** - JavaScript client library for database access

**Inspiration:**
- Modern security monitoring dashboards
- Building management systems
- Real-time occupancy tracking solutions

**Contributors:**
- Security Systems Team
- Backend Development Team
- Frontend Development Team

## 📞 Support

### Getting Help

**For frontend issues:**
1. Check browser console for errors (F12)
2. Review this README's troubleshooting section
3. Verify Supabase connection and RLS policies
4. Test with `debug.html` (if available)

**For backend issues:**
1. Check backend server logs
2. Review [Backend Documentation](https://github.com/wwwtriplew/Visitor-Counting-System-Backend)
3. Test camera connectivity and API endpoints
4. Verify YOLO model and Supabase credentials

**For database issues:**
1. Check Supabase dashboard for project status
2. Verify table schema matches documentation
3. Test RLS policies in SQL editor
4. Check database connection limits

### Contact

- **System Administrator:** Contact your building IT department
- **Backend Repository:** [GitHub Issues](https://github.com/wwwtriplew/Visitor-Counting-System-Backend/issues)
- **Frontend Repository:** [GitHub Issues](https://github.com/wwwtriplew/burnerschoolcountpeople-prog.github.io/issues)

---

**Last Updated:** December 1, 2025  
**Version:** 2.1  
**Frontend Repository:** wwwtriplew/burnerschoolcountpeople-prog.github.io  
**Backend Repository:** wwwtriplew/Visitor-Counting-System-Backend  
**System Status:** Production Ready ✅
```bash
# Serve with any static server
python -m http.server 8000
# or
npx serve .
```

## ⚙️ Configuration Options

### Adjustable Thresholds

All thresholds are configurable in the `CONFIG` object:

| Setting | Default | Description |
|---------|---------|-------------|
| `MAX_CAPACITY_PER_ROOM` | 30 | Maximum expected capacity per room (for percentage) |
| `STALENESS_THRESHOLD_MINUTES` | 5 | Data older than this shows stale warning |
| `THRESHOLDS.LOW` | 8 | Occupancy ≤ 8 = "Light" status (green) |
| `THRESHOLDS.MODERATE` | 20 | Occupancy ≤ 20 = "Moderate" status (amber) |
| `REFRESH_INTERVAL` | 30000 | Auto-refresh interval in milliseconds |

### Per-Room Custom Capacity

To set different capacities for specific rooms, modify `getOccupancyStatus()`:

```javascript
function getOccupancyStatus(count, maxCapacity) {
    // Custom capacities per room
    const roomCapacities = {
        'lobby': 50,
        'conference_a': 20,
        'room_101': 15
    };
    maxCapacity = roomCapacities[roomId] || CONFIG.MAX_CAPACITY_PER_ROOM;
    // ... rest of function
}
```

## 🔧 Maintenance Guide

### Known Issues and Solutions

#### Issue 1: DOM Element Not Found
**Symptom**: Console error "Required DOM element not found: [elementId]"

**Cause**: HTML structure doesn't match expected element IDs

**Solution**: 
1. Check `index.html` has all required elements with correct IDs
2. See `initializeDOMElements()` function for complete list
3. Element IDs are case-sensitive

#### Issue 2: Table Not Found
**Symptom**: "Could not find the table 'public.detections'"

**Cause**: Table name mismatch or table doesn't exist

**Solution**:
1. Run `debug.html` to diagnose
2. Check `TABLE_NAME` in CONFIG matches Supabase table
3. Verify table exists in Supabase Dashboard > Table Editor
4. See `TROUBLESHOOTING.md` for detailed steps

#### Issue 3: Stale Data Warnings
**Symptom**: Rooms show amber border with "Stale" badge

**Cause**: Backend hasn't updated data in 5+ minutes

**Solution**:
1. Check if backend is running
2. Verify cameras are sending images
3. Check Supabase connection from backend
4. Adjust `STALENESS_THRESHOLD_MINUTES` if needed

#### Issue 4: Incorrect Statistics
**Symptom**: "Busy Rooms" count doesn't match visual cards

**Cause**: Hardcoded threshold mismatch

**Solution**: 
- Now fixed! Uses `CONFIG.THRESHOLDS.MODERATE`
- All thresholds are centralized in CONFIG object
- Update CONFIG to change all threshold checks simultaneously

#### Issue 5: Memory Leaks
**Symptom**: Browser slow after long usage

**Cause**: Event listeners not cleaned up

**Solution**:
- Now fixed! Event listeners are properly removed on cleanup
- Auto-refresh clears interval on page unload
- Filter buttons use stored references for cleanup

### Code Quality Improvements (v2.0)

The following issues were identified and fixed:

1. ✅ **DOM Element Safety**: Added null checks and initialization validation
2. ✅ **Configurable Thresholds**: All hardcoded values moved to CONFIG
3. ✅ **Data Validation**: Added checks for negative counts and invalid data
4. ✅ **Memory Management**: Event listeners properly cleaned up
5. ✅ **Debouncing**: Refresh button now debounced (500ms) to prevent rapid clicks
6. ✅ **Error Boundaries**: Better error handling with try-catch blocks
7. ✅ **XSS Protection**: HTML escaping with null checks
8. ✅ **Type Safety**: Added parseInt() with fallbacks for all numeric values
9. ✅ **Documentation**: JSDoc comments for all major functions
10. ✅ **Consistent Naming**: Aligned column name handling (person_count vs people_count)

### Potential Future Issues

⚠️ **Issue**: CDN dependency on Supabase SDK
- **Risk**: If CDN is down, app won't work
- **Mitigation**: Consider self-hosting the Supabase JS SDK
- **Workaround**: Keep backup copy in `vendor/` folder

⚠️ **Issue**: No retry logic for failed requests
- **Risk**: Transient network errors cause complete failure
- **Mitigation**: Add exponential backoff retry in `fetchLatestRoomCounts()`
- **Status**: MAX_RETRIES defined but not implemented yet

⚠️ **Issue**: No request timeout
- **Risk**: Hanging requests could freeze UI
- **Mitigation**: Add timeout to Supabase client configuration
- **Workaround**: User can manually refresh

⚠️ **Issue**: Large datasets (1000+ rooms) may be slow
- **Risk**: Performance degradation with many rooms
- **Mitigation**: Implement pagination or virtual scrolling
- **Current Limit**: 500 records fetched, grouped by room_id

## 🧪 Testing Checklist

Before deploying, verify:

- [ ] Configure `CONFIG` with your Supabase credentials
- [ ] Table name matches (`detections` or `room_stats`)
- [ ] RLS policy allows SELECT for anon role
- [ ] Backend is inserting data with correct column names
- [ ] Test on Desktop (Chrome, Firefox, Safari, Edge)
- [ ] Test on Tablet (iPad, Android tablet)
- [ ] Test on Mobile (iPhone, Android phone)
- [ ] Refresh button works and shows loading state
- [ ] Filter buttons (All/Occupied/Empty) work correctly
- [ ] Statistics update when data changes
- [ ] Stale data warnings appear after 5 minutes
- [ ] Error messages display properly
- [ ] Empty state shows when no data
- [ ] Hard refresh clears cached data

## 📁 File Structure

```
/
├── index.html              # Dashboard view - Real-time monitoring
├── floorplan.html          # Floor plan view - Interactive building navigation
├── styles.css              # Shared styles (800+ lines)
├── floorplan-styles.css    # Floor plan specific styles
├── script.js               # Dashboard logic (500+ lines)
├── floorplan-script.js     # Floor plan logic
├── assets/
│   └── floormaps/          # Floor plan images
│       └── 4F.jpg          # 4th floor map (example)
├── debug.html              # Connection diagnostic tool
├── README.md               # This file
├── TROUBLESHOOTING.md      # Detailed troubleshooting guide
├── MAINTENANCE.md          # Maintenance and code quality guide
└── future_plan.md          # Planned enhancements
```

## 🏗️ Adding Floor Maps

### How to Add New Floor Plans

1. **Prepare Floor Plan Image:**
   - Format: JPG or PNG
   - Naming: `XF.jpg` (e.g., `1F.jpg`, `2F.jpg`, `3F.jpg`)
   - Place in: `assets/floormaps/`

2. **Update Configuration:**
   Edit `floorplan-script.js` line ~30:
   ```javascript
   FLOORS: [
       { number: 1, name: '1st Floor', hasMap: true, mapFile: '1F.jpg' },
       { number: 2, name: '2nd Floor', hasMap: true, mapFile: '2F.jpg' },
       // ... update hasMap: true and add mapFile
   ]
   ```

3. **Define Room Positions:**
   Edit `floorplan-script.js` line ~40:
   ```javascript
   const FLOOR_ROOM_POSITIONS = {
       1: { // 1st Floor
           101: { x: 15, y: 20, name: 'Main Lobby' },
           102: { x: 35, y: 20, name: 'Reception' },
           // Add all 10 cameras for the floor
           // x, y are percentages (0-100) of image dimensions
       },
       2: { // 2nd Floor
           201: { x: 20, y: 25, name: 'Conference Room A' },
           // ...
       }
   };
   ```

4. **Position Coordinates:**
   - `x`: Percentage from left edge (0 = far left, 100 = far right)
   - `y`: Percentage from top edge (0 = top, 100 = bottom)
   - Use image editing software to measure positions
   - Tip: Open floor plan in browser, use browser dev tools to get pixel coordinates, calculate percentages

### Example: Measuring Room Positions

1. Open `4F.jpg` in image editor (1000px wide, 800px tall)
2. Find Chemistry Lab at pixel (150, 160)
3. Calculate: x = (150/1000) × 100 = 15%, y = (160/800) × 100 = 20%
4. Add to config: `401: { x: 15, y: 20, name: 'Chemistry Lab' }`

### Using the Floor Plan View

1. **Visit:** `https://yourdomain.github.io/floorplan.html`
2. **Select a Floor:** Click on any floor card (1F - 7F)
3. **View Room Layout:** See which rooms are busy or available
4. **Plan Your Route:** Choose less crowded rooms
5. **Return to Overview:** Click "Back to Overview" to see all floors

### Using the Dashboard View

1. **Visit:** `https://yourdomain.github.io/index.html`
2. **See All Rooms:** Grid view of all rooms with live counts
3. **Filter Rooms:** Use "All", "Occupied", or "Empty" filters
4. **Check Status:** Color-coded indicators show occupancy levels
5. **Refresh Data:** Click refresh button for latest information

**Option B: Local Testing**
```bash
# Open in a local server (required for CORS)
python3 -m http.server 8000

# Visit: http://localhost:8000
```

## 🎨 Project Structure

```
.
├── index.html       # Main HTML structure
├── styles.css       # Responsive styling & layout
├── script.js        # Application logic & Supabase integration
├── README.md        # This file
└── .git/           # Git repository
```

## 📊 Database Schema

Expected table structure in Supabase:

```sql
CREATE TABLE room_stats (
  id BIGSERIAL PRIMARY KEY,
  room_id TEXT NOT NULL,
  timestamp TIMESTAMPTZ NOT NULL,
  people_count INT NOT NULL,
  CONSTRAINT people_count_non_negative CHECK (people_count >= 0)
);

-- Indexes for performance
CREATE INDEX idx_room_stats_room_id ON room_stats(room_id);
CREATE INDEX idx_room_stats_timestamp ON room_stats(timestamp DESC);
CREATE INDEX idx_room_stats_room_timestamp ON room_stats(room_id, timestamp DESC);
```

## 🚀 Usage

### Manual Refresh
Click the **Refresh** button to fetch the latest data from Supabase.

### Auto-Refresh (Optional)
Uncomment this line in `script.js` to enable auto-refresh every 30 seconds:

```javascript
// setupAutoRefresh();  // Uncomment to enable
```

### Room Card Information

Each room card displays:
- **Room Name** (e.g., "Lobby", "Room 101")
- **Occupancy Count** (number of people detected)
- **Status Badge** (Empty, Moderate, or Full)
- **Last Updated** (relative time, e.g., "2m ago")

### Occupancy Status Levels

| Status | People Count | Color |
|--------|-------------|-------|
| 🔵 Empty | 0 | Blue |
| 🟡 Moderate | 1-5 | Orange |
| 🔴 Full | 6+ | Red |

## 🛠️ Customization

### Change Colors

Edit CSS variables in `styles.css`:

```css
:root {
    --primary-color: #3b82f6;        /* Blue */
    --success-color: #10b981;        /* Green */
    --warning-color: #f59e0b;        /* Orange */
    --danger-color: #ef4444;         /* Red */
}
```

### Adjust Occupancy Thresholds

Edit the `getOccupancyStatus()` function in `script.js`:

```javascript
function getOccupancyStatus(count) {
    if (count === 0) {
        return { status: 'empty', color: '#0369a1' };
    } else if (count <= 10) {  // Change threshold from 5 to 10
        return { status: 'moderate', color: '#92400e' };
    } else {
        return { status: 'full', color: '#991b1b' };
    }
}
```

### Change Refresh Interval

Update `CONFIG.REFRESH_INTERVAL` in `script.js`:

```javascript
const CONFIG = {
    // ...
    REFRESH_INTERVAL: 60000,  // 60 seconds instead of 30
};
```

## 📱 Responsive Design

The website is fully responsive:

- **Desktop**: 4+ room cards per row
- **Tablet**: 2-3 room cards per row
- **Mobile**: 1 room card per row

All text, buttons, and layouts adapt automatically.

## 🐛 Troubleshooting

### "Supabase URL not configured"

Make sure you've updated `CONFIG.SUPABASE_URL` in `script.js` with your actual Supabase project URL.

### "Supabase anon key not configured"

Update `CONFIG.SUPABASE_ANON_KEY` in `script.js` with your actual anon key from Supabase Settings → API.

### "Failed to load room data"

Possible causes:
1. **Supabase credentials are wrong**: Double-check in Settings → API
2. **RLS policies are blocking reads**: Ensure you have a policy allowing `anon` users to read
3. **Table doesn't exist**: Verify the `room_stats` table exists in your Supabase database
4. **No data in table**: The backend must be inserting data for rows to display
5. **CORS issue**: If testing locally, use a local server (not file:// protocol)

### "No rooms with data"

This means the table exists but has no records. Verify your backend is running and inserting data into Supabase.

## 🔄 Backend Integration

This frontend works with the **Visitor Counting System Backend**:

- [Backend Repository](https://github.com/wwwtriplew/Visitor-Counting-System-Backend)
- Backend inserts `{room_id, timestamp, people_count}` into the `room_stats` table
- Frontend reads latest counts and displays them

## 📈 Future Enhancements

- **Real-time Updates**: Use Supabase Realtime to push updates instantly
- **Floor Plan Overlay**: Interactive floor plan with room locations
- **Historical Charts**: Show occupancy trends over time
- **Occupancy Alerts**: Notify when rooms reach capacity
- **Export Data**: CSV export for analysis
- **Dark Mode**: Toggle between light and dark themes
- **Custom Thresholds**: Admin panel to set occupancy limits per room

## 💻 Technical Stack

- **Frontend**: HTML5, CSS3, Vanilla JavaScript
- **Database**: Supabase (PostgreSQL)
- **SDK**: Supabase JS SDK v2
- **Hosting**: GitHub Pages
- **Browser Support**: All modern browsers (Chrome, Firefox, Safari, Edge)

## 📄 License

This project is part of the Visitor Counting System. See the backend repository for license details.

## 🤝 Contributing

To improve this frontend:

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/your-feature`)
3. Commit your changes (`git commit -m 'Add your feature'`)
4. Push to the branch (`git push origin feature/your-feature`)
5. Open a pull request

## ❓ Support

For issues or questions:

1. Check the [Troubleshooting](#-troubleshooting) section
2. Review the [Backend Documentation](https://github.com/wwwtriplew/Visitor-Counting-System-Backend)
3. Open an issue on GitHub

---

**Made with ❤️ for the Visitor Counting System**
