/**
 * Floor Plan Visualization System
 * 
 * Camera ID Convention:
 * - Each floor has 10 cameras (101-110, 201-210, ..., 701-710)
 * - First digit(s) = floor number
 * - Last digit = camera number (1-10)
 * - Lower camera IDs are positioned more left/down on floor
 * - No cameras in lavatories or prep rooms
 * 
 * Example Floor 4 (4F):
 * - Chemistry Lab (left side) = Camera 401
 * - 6B Classroom at 413 room (right side) = Camera 410
 */

// ============================================
// Configuration
// ============================================
const CONFIG = {
    SUPABASE_URL: 'https://rgkkadtaiivcuuvekwdo.supabase.co',
    SUPABASE_ANON_KEY: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJna2thZHRhaWl2Y3V1dmVrd2RvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjM5NzYyOTUsImV4cCI6MjA3OTU1MjI5NX0.cTAGAOIT_rpnQGNMO9v-o1PIHwyoB3r8xSPaqVccFrI',
    TABLE_NAME: 'detections',
    REFRESH_INTERVAL: 30000,
    THRESHOLDS: {
        LOW: 8,
        MODERATE: 20
    },
    FLOORS: [
        { number: -1, name: 'Playground Floor', hasMap: true, mapFile: 'playground.jpg' },
        { number: 0, name: 'Ground Floor', hasMap: true, mapFile: 'ground_floor.jpg' },
        { number: 1, name: '1st Floor', hasMap: true, mapFile: 'first_floor.jpg' },
        { number: 2, name: '2nd Floor', hasMap: true, mapFile: 'second floor.jpg' },
        { number: 3, name: '3rd Floor', hasMap: true, mapFile: 'third_floor.jpg' },
        { number: 4, name: '4th Floor', hasMap: true, mapFile: 'fourth_floor.jpg' },
        { number: 6, name: '6th Floor', hasMap: false }
    ]
};

// ============================================
// Floor Map Room Positions (for overlay)
// ============================================
// Coordinates are percentages of image dimensions (0-100)
// Note: Positions will need to be adjusted based on actual floor map layouts
const FLOOR_ROOM_POSITIONS = {
    '-1': { // Playground Floor
        'Fitness Centre': { x: 25, y: 50, name: 'Fitness Centre' },
        'Canteen': { x: 75, y: 50, name: 'Canteen' }
    },
    0: { // Ground Floor
        'G7': { x: 30, y: 50, name: 'G7' },
        'VA': { x: 70, y: 50, name: 'VA' }
    },
    1: { // 1st Floor
        '105': { x: 15, y: 30, name: '105' },
        '106': { x: 35, y: 30, name: '106' },
        '107': { x: 55, y: 30, name: '107' },
        'STEM Maker Lab': { x: 75, y: 30, name: 'STEM Maker Lab' },
        'Chinese Academy': { x: 50, y: 70, name: 'Chinese Academy' }
    },
    2: { // 2nd Floor
        '201': { x: 10, y: 25, name: '201' },
        '202': { x: 25, y: 25, name: '202' },
        '203': { x: 40, y: 25, name: '203' },
        '204': { x: 55, y: 25, name: '204' },
        '205': { x: 70, y: 25, name: '205' },
        '209': { x: 85, y: 25, name: '209' },
        'Home Economics Room': { x: 50, y: 70, name: 'Home Economics Room' }
    },
    3: { // 3rd Floor
        'Phy Lab': { x: 30, y: 50, name: 'Physics Lab' },
        'Bio Lab': { x: 70, y: 50, name: 'Biology Lab' }
    },
    4: { // 4th Floor
        'Chem Lab': { x: 50, y: 50, name: 'Chemistry Lab' }
    }
    // 6th Floor (Library) has no map available
};

// ============================================
// Global State
// ============================================
let supabaseClient = null;
let currentFloor = null;
let allRoomData = {};
let isLoading = false;

// DOM Elements
let buildingOverview, floorDetailView, floorGrid;
let connectionStatus, statusText, lastUpdateText;
let loadingIndicator, errorAlert, errorMessage;
let refreshBtn, backToOverviewBtn;
let buildingTotalOccupancy, buildingActiveRooms;
let floorTitle, floorOccupancy, floorActiveRooms, floorMapImage;
let roomOverlays, floorRoomList;

// ============================================
// Initialization
// ============================================
function initializeDOMElements() {
    // Views
    buildingOverview = document.getElementById('buildingOverview');
    floorDetailView = document.getElementById('floorDetailView');
    floorGrid = document.getElementById('floorGrid');
    
    // Status
    connectionStatus = document.getElementById('connectionStatus');
    statusText = document.getElementById('statusText');
    lastUpdateText = document.getElementById('lastUpdateText');
    
    // Loading/Error
    loadingIndicator = document.getElementById('loadingIndicator');
    errorAlert = document.getElementById('errorAlert');
    errorMessage = document.getElementById('errorMessage');
    
    // Buttons
    refreshBtn = document.getElementById('refreshBtn');
    backToOverviewBtn = document.getElementById('backToOverviewBtn');
    
    // Building overview
    buildingTotalOccupancy = document.getElementById('buildingTotalOccupancy');
    buildingActiveRooms = document.getElementById('buildingActiveRooms');
    
    // Floor detail
    floorTitle = document.getElementById('floorTitle');
    floorOccupancy = document.getElementById('floorOccupancy');
    floorActiveRooms = document.getElementById('floorActiveRooms');
    floorMapImage = document.getElementById('floorMapImage');
    roomOverlays = document.getElementById('roomOverlays');
    floorRoomList = document.getElementById('floorRoomList');
    
    // Validate critical elements
    const required = {
        buildingOverview, floorDetailView, refreshBtn, statusText
    };
    
    for (const [name, element] of Object.entries(required)) {
        if (!element) {
            throw new Error(`Required DOM element not found: ${name}`);
        }
    }
}

async function initializeApp() {
    try {
        initializeDOMElements();
        initializeSupabase();
        attachEventListeners();
        
        await loadAllRoomData();
        renderBuildingOverview();
        
        updateStatus('Connected', 'success');
    } catch (error) {
        console.error('Initialization error:', error);
        updateStatus('Initialization failed', 'error');
        showError(`Failed to initialize: ${error.message}`);
    }
}

function initializeSupabase() {
    if (window.supabase && window.supabase.createClient) {
        supabaseClient = window.supabase.createClient(
            CONFIG.SUPABASE_URL,
            CONFIG.SUPABASE_ANON_KEY
        );
    } else {
        throw new Error('Supabase SDK not loaded');
    }
}

function attachEventListeners() {
    if (refreshBtn) {
        refreshBtn.addEventListener('click', debounce(async () => {
            await loadAllRoomData();
            if (currentFloor !== null) {
                renderFloorDetail(currentFloor);
            } else {
                renderBuildingOverview();
            }
        }, 500));
    }
    
    if (backToOverviewBtn) {
        backToOverviewBtn.addEventListener('click', () => {
            showBuildingOverview();
        });
    }
}

// ============================================
// Data Fetching
// ============================================
async function loadAllRoomData() {
    if (isLoading) return;
    
    try {
        isLoading = true;
        refreshBtn.disabled = true;
        showLoadingIndicator();
        hideErrorMessage();
        
        const { data, error } = await supabaseClient
            .from(CONFIG.TABLE_NAME)
            .select('room_id, timestamp, person_count')
            .order('timestamp', { ascending: false })
            .limit(1000);
        
        if (error) throw error;
        
        // Parse room_id to extract camera IDs (e.g., "401" from room names)
        allRoomData = {};
        
        for (const record of data) {
            // Extract numeric camera ID from room_id
            // Assumes format like "401", "room-401", "camera_401", etc.
            const match = record.room_id.match(/(\d{3})/);
            if (match) {
                const cameraId = parseInt(match[1]);
                
                // Only keep if not already stored (latest due to ORDER BY)
                if (!allRoomData[cameraId]) {
                    allRoomData[cameraId] = {
                        cameraId: cameraId,
                        room_id: record.room_id,
                        count: Math.max(0, parseInt(record.person_count) || 0),
                        timestamp: record.timestamp,
                        floor: Math.floor(cameraId / 100)
                    };
                }
            }
        }
        
        updateLastUpdateTime();
        updateStatus(`Connected • ${Object.keys(allRoomData).length} cameras`, 'success');
        
    } catch (error) {
        console.error('Error loading data:', error);
        updateStatus('Failed to load data', 'error');
        showError(`Failed to load: ${error.message}`);
    } finally {
        isLoading = false;
        refreshBtn.disabled = false;
        hideLoadingIndicator();
    }
}

// ============================================
// View Rendering
// ============================================
function renderBuildingOverview() {
    // Calculate building stats
    const totalOccupancy = Object.values(allRoomData).reduce((sum, room) => sum + room.count, 0);
    const activeRooms = Object.values(allRoomData).filter(room => room.count > 0).length;
    
    buildingTotalOccupancy.textContent = totalOccupancy;
    buildingActiveRooms.textContent = `${activeRooms} / ${Object.keys(allRoomData).length}`;
    
    // Render floor cards
    floorGrid.innerHTML = '';
    
    CONFIG.FLOORS.forEach(floor => {
        const floorRooms = getFloorRooms(floor.number);
        const floorOccupancy = floorRooms.reduce((sum, room) => sum + room.count, 0);
        const activeCount = floorRooms.filter(room => room.count > 0).length;
        const busyCount = floorRooms.filter(room => room.count > CONFIG.THRESHOLDS.MODERATE).length;
        
        const card = document.createElement('div');
        card.className = 'floor-card';
        card.dataset.floor = floor.number;
        
        const statusClass = busyCount > 0 ? 'busy' : 
                          activeCount > 5 ? 'moderate' : 
                          activeCount > 0 ? 'light' : 'empty';
        
        card.innerHTML = `
            <div class="floor-card-header">
                <div class="floor-number">${floor.number}F</div>
                <div class="floor-status-badge ${statusClass}">
                    ${busyCount > 0 ? '🔴 Busy' : 
                      activeCount > 5 ? '🟡 Active' : 
                      activeCount > 0 ? '🟢 Light' : '⚪ Empty'}
                </div>
            </div>
            <div class="floor-card-body">
                <div class="floor-card-stat">
                    <span class="floor-card-label">Occupancy</span>
                    <span class="floor-card-value">${floorOccupancy} people</span>
                </div>
                <div class="floor-card-stat">
                    <span class="floor-card-label">Active Rooms</span>
                    <span class="floor-card-value">${activeCount} / ${floorRooms.length}</span>
                </div>
            </div>
            <div class="floor-card-footer">
                <button class="btn-view-floor" data-floor="${floor.number}">
                    ${floor.hasMap ? '🗺️ View Map' : '📋 View Details'}
                </button>
            </div>
        `;
        
        floorGrid.appendChild(card);
        
        // Attach event listener
        const btn = card.querySelector('.btn-view-floor');
        btn.addEventListener('click', () => showFloorDetail(floor.number));
    });
}

function showFloorDetail(floorNumber) {
    currentFloor = floorNumber;
    buildingOverview.classList.add('hidden');
    floorDetailView.classList.remove('hidden');
    backToOverviewBtn.classList.remove('hidden');
    
    renderFloorDetail(floorNumber);
}

function showBuildingOverview() {
    currentFloor = null;
    buildingOverview.classList.remove('hidden');
    floorDetailView.classList.add('hidden');
    backToOverviewBtn.classList.add('hidden');
    
    renderBuildingOverview();
}

function renderFloorDetail(floorNumber) {
    const floor = CONFIG.FLOORS.find(f => f.number === floorNumber);
    const floorRooms = getFloorRooms(floorNumber);
    
    // Update header
    floorTitle.textContent = `${floor.name}`;
    
    // Update stats
    const totalOccupancy = floorRooms.reduce((sum, room) => sum + room.count, 0);
    const activeCount = floorRooms.filter(room => room.count > 0).length;
    
    floorOccupancy.textContent = `${totalOccupancy} people`;
    floorActiveRooms.textContent = `${activeCount} / ${floorRooms.length}`;
    
    // Update map image if available
    if (floor.hasMap) {
        floorMapImage.src = `assets/floormaps/${floor.mapFile}`;
        floorMapImage.style.display = 'block';
        renderRoomOverlays(floorNumber, floorRooms);
    } else {
        floorMapImage.style.display = 'none';
        roomOverlays.innerHTML = '<p class="no-map-message">Floor map not available yet. Showing room list below.</p>';
    }
    
    // Render room list
    renderFloorRoomList(floorRooms);
}

function renderRoomOverlays(floorNumber, floorRooms) {
    roomOverlays.innerHTML = '';
    
    const positions = FLOOR_ROOM_POSITIONS[floorNumber];
    if (!positions) {
        roomOverlays.innerHTML = '<p class="no-map-message">Room positions not configured for this floor.</p>';
        return;
    }
    
    floorRooms.forEach(room => {
        const pos = positions[room.cameraId];
        if (!pos) return; // Skip if no position defined
        
        const overlay = document.createElement('div');
        overlay.className = 'room-overlay';
        overlay.style.left = `${pos.x}%`;
        overlay.style.top = `${pos.y}%`;
        
        const status = getOccupancyStatus(room.count);
        overlay.classList.add(`status-${status.status}`);
        
        overlay.innerHTML = `
            <div class="room-overlay-indicator ${status.status}">
                ${room.count}
            </div>
            <div class="room-overlay-label">${pos.name || `Room ${room.cameraId}`}</div>
        `;
        
        // Tooltip on hover
        overlay.title = `${pos.name || `Room ${room.cameraId}`}\n${room.count} people\nUpdated: ${formatTimestamp(room.timestamp)}`;
        
        roomOverlays.appendChild(overlay);
    });
}

function renderFloorRoomList(floorRooms) {
    floorRoomList.innerHTML = '';
    
    // Sort by camera ID
    floorRooms.sort((a, b) => a.cameraId - b.cameraId);
    
    floorRooms.forEach(room => {
        const status = getOccupancyStatus(room.count);
        const positions = FLOOR_ROOM_POSITIONS[room.floor];
        const roomName = positions && positions[room.cameraId] 
            ? positions[room.cameraId].name 
            : `Room ${room.cameraId}`;
        
        const card = document.createElement('div');
        card.className = 'room-list-item';
        
        card.innerHTML = `
            <div class="room-list-item-header">
                <span class="room-list-item-name">${escapeHtml(roomName)}</span>
                <span class="room-list-item-badge ${status.status}">${formatStatus(status.status)}</span>
            </div>
            <div class="room-list-item-body">
                <div class="room-list-item-count">${status.icon} ${room.count} people</div>
                <div class="room-list-item-time">${formatTimestamp(room.timestamp)}</div>
            </div>
            <div class="room-list-item-id">Camera ${room.cameraId}</div>
        `;
        
        floorRoomList.appendChild(card);
    });
    
    if (floorRooms.length === 0) {
        floorRoomList.innerHTML = '<p class="no-data-message">No camera data available for this floor.</p>';
    }
}

// ============================================
// Helper Functions
// ============================================
function getFloorRooms(floorNumber) {
    return Object.values(allRoomData).filter(room => room.floor === floorNumber);
}

function getOccupancyStatus(count) {
    if (count === 0) {
        return { status: 'empty', color: '#0ea5e9', icon: '🚪' };
    } else if (count <= CONFIG.THRESHOLDS.LOW) {
        return { status: 'light', color: '#10b981', icon: '✓' };
    } else if (count <= CONFIG.THRESHOLDS.MODERATE) {
        return { status: 'moderate', color: '#f59e0b', icon: '⚠️' };
    } else {
        return { status: 'busy', color: '#ef4444', icon: '🔴' };
    }
}

function formatStatus(status) {
    const statusMap = {
        'empty': 'Empty',
        'light': 'Light',
        'moderate': 'Moderate',
        'busy': 'Busy'
    };
    return statusMap[status] || status;
}

function formatTimestamp(isoString) {
    try {
        const date = new Date(isoString);
        const now = new Date();
        const diffMs = now - date;
        const diffMins = Math.floor(diffMs / 60000);
        const diffSecs = Math.floor(diffMs / 1000);

        if (diffMins < 1) {
            return `${diffSecs}s ago`;
        } else if (diffMins < 60) {
            return `${diffMins}m ago`;
        } else {
            return date.toLocaleTimeString([], {
                hour: '2-digit',
                minute: '2-digit'
            });
        }
    } catch {
        return 'Unknown';
    }
}

function updateLastUpdateTime() {
    const now = new Date();
    if (lastUpdateText) {
        lastUpdateText.textContent = `Last updated: ${now.toLocaleTimeString()}`;
    }
}

function updateStatus(message, type = 'info') {
    const statusMap = {
        success: 'connected',
        error: 'error',
        warning: '',
        info: ''
    };
    
    const status = statusMap[type] || '';
    if (connectionStatus) {
        connectionStatus.className = `connection-status ${status}`;
    }
    if (statusText) {
        statusText.textContent = message;
    }
}

function showLoadingIndicator() {
    if (loadingIndicator) loadingIndicator.classList.remove('hidden');
}

function hideLoadingIndicator() {
    if (loadingIndicator) loadingIndicator.classList.add('hidden');
}

function showError(message) {
    if (errorMessage) errorMessage.textContent = message;
    if (errorAlert) errorAlert.classList.remove('hidden');
}

function hideErrorMessage() {
    if (errorAlert) errorAlert.classList.add('hidden');
}

function escapeHtml(text) {
    if (!text) return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

function debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
        const later = () => {
            clearTimeout(timeout);
            func(...args);
        };
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
    };
}

// ============================================
// Start Application
// ============================================
document.addEventListener('DOMContentLoaded', () => {
    initializeApp();
});
