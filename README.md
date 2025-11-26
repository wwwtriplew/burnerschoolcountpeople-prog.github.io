# Room Occupancy Monitor - Frontend

A lightweight, fast, and maintainable static website that displays live room occupancy using data from Supabase. Fetches the latest occupancy data per room and renders a responsive, interactive grid. Built with vanilla HTML/CSS/JavaScript + Supabase JS SDK.

## 🎯 Overview

This frontend displays real-time visitor distribution across rooms by fetching data from a Supabase PostgreSQL database. The backend (YOLO-based image processing system) continuously updates room occupancy counts, which are displayed here with a clean, modern UI.

**Data Flow:**
```
Backend (YOLO Processing) → Supabase Database → Frontend (This App) → Display
```

## ✨ Features

- **Live Occupancy Display**: Shows current people count per room
- **Responsive Grid Layout**: Adapts to desktop, tablet, and mobile
- **Real-time Status Badges**: Visual indicators for empty, moderate, and full rooms
- **Manual Refresh Button**: Update data on demand
- **Auto-refresh Capability**: Optional 30-second auto-refresh (can be enabled)
- **Relative Timestamps**: Shows "2m ago" format for last update
- **Error Handling**: Graceful error messages and connection status
- **Fast & Lightweight**: Pure JavaScript, no build tools required
- **GitHub Pages Ready**: Deploy directly to GitHub Pages

## 🔐 Security

### Why Hardcoded Credentials are Safe

The Supabase **anon key** is safe to expose in frontend code because:

1. **Row Level Security (RLS)**: Supabase RLS policies restrict database access
   - Anon key can **only read** from the `room_stats` table
   - Cannot write, update, or delete data
   - Backend uses service role key (kept secret) for writes

2. **Public Information**: Both the project URL and anon key are intended to be public
   - Similar to API keys in public SDKs (Google Maps, etc.)
   - Protected by RLS, not by secrecy

3. **No Sensitive Data**: The `room_stats` table contains only non-sensitive occupancy data
   - Room IDs, people counts, timestamps
   - No personal information or private details

### RLS Configuration Example

```sql
-- Enable RLS on room_stats table
ALTER TABLE room_stats ENABLE ROW LEVEL SECURITY;

-- Allow anonymous users to read all data
CREATE POLICY "Allow public read access"
  ON room_stats
  FOR SELECT
  TO anon
  USING (true);
```

## 📋 Setup Instructions

### 1. Prerequisites

- A Supabase project with a `room_stats` table
- Supabase credentials: **Project URL** and **Anon Key**
- Backend system running and inserting data into Supabase

### 2. Get Your Supabase Credentials

1. Go to [supabase.com](https://supabase.com) and open your project
2. Click **Settings** → **API**
3. Copy:
   - **Project URL** (e.g., `https://xxxxx.supabase.co`)
   - **Anon Key** (the public key)

### 3. Configure the Frontend

Edit `script.js` and update the `CONFIG` object:

```javascript
const CONFIG = {
    SUPABASE_URL: 'https://your-project.supabase.co', // Your Supabase URL
    SUPABASE_ANON_KEY: 'your-anon-key-here',          // Your anon key
    TABLE_NAME: 'room_stats',
    REFRESH_INTERVAL: 30000, // 30 seconds
    MAX_RETRIES: 3,
};
```

### 4. Deploy

**Option A: GitHub Pages (Recommended)**
```bash
# Push to main branch
git add .
git commit -m "Configure Supabase credentials"
git push origin main

# Your site will be live at: https://burnerschoolcountpeople-prog.github.io
```

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
