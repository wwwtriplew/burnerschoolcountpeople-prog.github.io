# Room Configuration Documentation

**Last Updated:** December 4, 2025

## Overview

The Visitor Counting System has been updated to display a **fixed set of 20 predefined rooms** organized by floor. This ensures consistent display and proper ordering of rooms from lowest to highest floors, even when camera data is not yet available.

## System Architecture

### Fixed Room Slots
- The system now displays **exactly 20 room cards** at all times
- Each room has a designated slot that persists even without data
- Rooms are organized by floor hierarchy (Playground → Ground → 1st → 2nd → 3rd → 6th)

### Data Matching Strategy
- **Case-insensitive matching**: "Fitness Centre", "fitness centre", "FITNESS CENTRE" all match
- **Flexible format support**: Backend can use any room_id format (e.g., "105", "room-105", "classroom-105")
- **Latest data priority**: Most recent timestamp is always displayed
- **Graceful degradation**: Rooms without data show "Awaiting first update" status

## Room List by Floor

### Playground Floor (Below Ground)
1. **Fitness Centre**
2. **Canteen**

### Ground Floor
3. **G7**
4. **VA**

### 1st Floor
5. **105**
6. **106**
7. **107**
8. **STEM Maker Lab**
9. **Chinese Academy**

### 2nd Floor
10. **201**
11. **202**
12. **203**
13. **204**
14. **205**
15. **209**
16. **Home Economics Room**

### 3rd Floor
17. **Physics Lab** (room_id: "Phy Lab")
18. **Biology Lab** (room_id: "Bio Lab")

### 4th Floor
19. **Chemistry Lab** (room_id: "Chem Lab")

### 6th Floor
20. **Library**

## Backend Integration

### Camera Configuration

When configuring cameras in the backend, use these **exact room_id values** for proper matching:

```python
# Playground Floor
room_ids = [
    "Fitness Centre",
    "Canteen",
    
    # Ground Floor
    "G7",
    "VA",
    
    # 1st Floor
    "105",
    "106",
    "107",
    "STEM Maker Lab",
    "Chinese Academy",
    
    # 2nd Floor
    "201",
    "202",
    "203",
    "204",
    "205",
    "209",
    "Home Economics Room",
    
    # 3rd Floor
    "Phy Lab",
    "Bio Lab",
    
    # 4th Floor
    "Chem Lab",
    
    # 6th Floor
    "Library"
]
```

### Alternative Formats (Also Supported)

The system will also recognize these alternative formats:
- **Numeric only**: `"105"`, `"201"`, `"209"`
- **With prefix**: `"room-105"`, `"classroom-201"`
- **Descriptive**: `"physics-lab"`, `"biology-lab"`, `"chemistry-lab"`

**Note:** Case is ignored during matching, so `"FITNESS CENTRE"` and `"fitness centre"` are treated as identical.

## Display Features

### Room Cards

#### With Data
- **Status badge** (Empty/Light/Moderate/Busy)
- **People count** with color-coded display
- **Capacity bar** showing percentage
- **Timestamp** with relative time format (e.g., "2m ago")
- **Stale data warning** if older than 5 minutes

#### Without Data
- **Dashed border** to indicate no data state
- **"--" placeholder** for people count
- **"Waiting for data..."** message
- **"Awaiting first update"** timestamp
- **Grayed out appearance** (70% opacity)

### Floor Organization
- **Floor headers** automatically inserted between floors
- **Consistent ordering** (Playground → Ground → 1st → 2nd → 3rd → 6th)
- **Visual hierarchy** with floor titles in brand color (#d3efef)

### Statistics Panel
Shows real-time building metrics:
- **Total Occupancy**: Sum of all people across rooms with data
- **Active Rooms**: `X/20` format showing how many rooms are reporting
- **Busy Rooms**: Count of rooms exceeding 20 people
- **Empty Rooms**: Count of rooms with 0 people

## Technical Implementation

### Key Code Changes

#### 1. Fixed Room Definitions (`script.js`)
```javascript
const FIXED_ROOMS = [
    { room_id: 'Fitness Centre', display_name: 'Fitness Centre', floor: 'Playground', floor_order: -1 },
    { room_id: 'Canteen', display_name: 'Canteen', floor: 'Playground', floor_order: -1 },
    // ... 18 more rooms
];
```

#### 2. Data Fetching Strategy
```javascript
async function fetchLatestRoomCounts() {
    // 1. Fetch all data from Supabase
    // 2. Create map with case-insensitive keys
    // 3. Merge with FIXED_ROOMS
    // 4. Return all rooms (with or without data)
}
```

#### 3. Room Card Rendering
```javascript
function createRoomCard(room) {
    if (!room.hasData || !room.timestamp) {
        // Render "no data" card with dashed border
    } else {
        // Render normal card with live data
    }
}
```

### CSS Enhancements

#### Floor Headers
```css
.floor-header {
    grid-column: 1 / -1;
    margin-top: 1.5rem;
}

.floor-title {
    font-size: 1.5rem;
    color: var(--brand-secondary);
    border-bottom: 2px solid var(--brand-action);
}
```

#### No-Data Cards
```css
.room-card.no-data {
    opacity: 0.7;
    border-style: dashed;
    border-color: var(--border-light);
}
```

## Floor Maps

### Available Maps
The following floor plan images are available in `assets/floormaps/`:
- `playground.jpg` - Playground floor
- `ground_floor.jpg` - Ground floor
- `first_floor.jpg` - 1st floor
- `second floor.jpg` - 2nd floor
- `third_floor.jpg` - 3rd floor
- `fourth_floor.jpg` - 4th floor (Chemistry Lab)

### Map Integration
To integrate floor plans with the floor plan view (`floorplan.html`):

1. Update `floorplan-script.js` CONFIG.FLOORS:
```javascript
{ number: -1, name: 'Playground Floor', hasMap: true, mapFile: 'playground.jpg' },
{ number: 0, name: 'Ground Floor', hasMap: true, mapFile: 'ground_floor.jpg' },
{ number: 1, name: '1st Floor', hasMap: true, mapFile: 'first_floor.jpg' },
{ number: 2, name: '2nd Floor', hasMap: true, mapFile: 'second floor.jpg' },
{ number: 3, name: '3rd Floor', hasMap: true, mapFile: 'third_floor.jpg' },
{ number: 4, name: '4th Floor', hasMap: true, mapFile: 'fourth_floor.jpg' },
{ number: 6, name: '6th Floor', hasMap: false }
```

2. Define room positions in FLOOR_ROOM_POSITIONS:
```javascript
const FLOOR_ROOM_POSITIONS = {
    '-1': { // Playground
        'Fitness Centre': { x: 25, y: 50, name: 'Fitness Centre' },
        'Canteen': { x: 75, y: 50, name: 'Canteen' }
    },
    0: { // Ground Floor
        'G7': { x: 30, y: 50, name: 'G7' },
        'VA': { x: 70, y: 50, name: 'VA' }
    },
    // ... positions for other floors (1st, 2nd, 3rd, 4th)
};
```

## Testing Checklist

### Before Deployment
- [ ] All 20 rooms display correctly in floor order
- [ ] Floor headers appear between different floors
- [ ] Rooms without data show dashed borders
- [ ] Statistics panel shows "X/20" format for Active Rooms
- [ ] Case-insensitive matching works (test with different cases)
- [ ] Filters work correctly (All/Occupied/Empty)
- [ ] Stale data warning appears for old timestamps
- [ ] Refresh button updates all room data

### Backend Verification
- [ ] Cameras configured with correct room_id values
- [ ] All 20 cameras sending data to Supabase
- [ ] Data timestamps are current (< 5 minutes old)
- [ ] person_count values are reasonable (0-100)

## Troubleshooting

### Issue: Room Not Showing Data

**Possible Causes:**
1. **room_id mismatch** - Check backend camera configuration
2. **Case sensitivity** - Should be handled automatically, but verify exact spelling
3. **Network issues** - Camera not sending data to backend
4. **Backend not processing** - Check backend server logs

**Solution:**
```sql
-- Check actual room_id values in database
SELECT DISTINCT room_id FROM detections 
ORDER BY room_id;

-- Compare with FIXED_ROOMS list
-- Adjust either backend camera config or FIXED_ROOMS array
```

### Issue: Wrong Room Order

**Cause:** floor_order values in FIXED_ROOMS are incorrect

**Solution:** 
Update floor_order in script.js:
- Playground: -1
- Ground: 0
- 1st: 1
- 2nd: 2
- 3rd: 3
- 4th: 4
- 6th: 6

### Issue: Statistics Showing Wrong Count

**Cause:** Filtering logic issue in updateStatistics()

**Check:**
```javascript
// Should only count rooms with hasData: true
const roomsWithData = rooms.filter(room => room.hasData);
```

## Future Enhancements

### Recommended Additions
1. **Floor-specific filtering** - Toggle to show only one floor
2. **Room groups** - Categorize by type (labs, classrooms, facilities)
3. **Historical charts** - Show occupancy trends over time
4. **Capacity management** - Different max_capacity per room type
5. **Alert thresholds** - Notify when rooms exceed capacity
6. **QR codes** - Generate codes for each room for easy access

### Integration Opportunities
- **Building management system** - Connect to HVAC, lighting controls
- **Booking system** - Show real-time availability for reservations
- **Mobile app** - Native iOS/Android apps with push notifications
- **Digital signage** - Display on TV screens throughout building

## Maintenance

### Adding New Rooms
1. Add entry to FIXED_ROOMS array in script.js
2. Configure backend camera with matching room_id
3. Update floor map positions if using floor plan view
4. Test data matching with new room

### Removing Rooms
1. Remove entry from FIXED_ROOMS array
2. Disable corresponding camera in backend
3. Update floor map positions
4. Clear old data from database if needed

### Changing Display Names
Update `display_name` field in FIXED_ROOMS (keep `room_id` unchanged for backend compatibility):
```javascript
{ room_id: 'Phy Lab', display_name: 'Physics Laboratory', ... }
```

## Support

For issues or questions:
- Check browser console (F12) for error messages
- Verify Supabase connection in Network tab
- Review backend logs for camera data ingestion
- Consult main README.md for detailed troubleshooting

---

**System Version:** 2.1  
**Configuration Date:** December 4, 2025  
**Total Rooms:** 20 across 5 floors (+ Playground)
