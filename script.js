/**
 * Visitor Counting System - Frontend
 * Static website using Supabase JS SDK to fetch and display room occupancy
 */

// ============================================
// Configuration
// ============================================
// HARDCODED SUPABASE CREDENTIALS
// The anon key is safe to expose in frontend code because:
// 1. Row Level Security (RLS) prevents unauthorized writes/deletes
// 2. RLS restricts reads to public data only
// 3. The project URL is publicly visible anyway
// To configure: Replace these values with your Supabase project credentials
const CONFIG = {
    SUPABASE_URL: 'https://rgkkadtaiivcuuvekwdo.supabase.co', // Replace with your Supabase URL
    SUPABASE_ANON_KEY: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJna2thZHRhaWl2Y3V1dmVrd2RvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjM5NzYyOTUsImV4cCI6MjA3OTU1MjI5NX0.cTAGAOIT_rpnQGNMO9v-o1PIHwyoB3r8xSPaqVccFrI',
    // Replace with your Supabase anon key ^^^^^^^^^^^^^^^^^^^^^^
    TABLE_NAME: 'detections', // Replace with your table name if different
    REFRESH_INTERVAL: 30000, // 30 seconds (auto-refresh interval)
    MAX_RETRIES: 3, // Maximum retry attempts for failed requests
    MAX_CAPACITY_PER_ROOM: 30, // Default maximum capacity per room (for percentage calculation)
    STALENESS_THRESHOLD_MINUTES: 5, // Data older than this is marked as stale
    // Occupancy thresholds for status indicators
    THRESHOLDS: {
        LOW: 8,      // 0-8 people = "Low" (green)
        MODERATE: 20 // 9-20 = "Moderate" (amber), 21+ = "Busy" (red)
    }
};

// ============================================
// Global State
// ============================================
let supabaseClient = null;
let isLoading = false;
let refreshInterval = null;
let currentFilter = 'all';
let allRooms = [];

// ============================================
// DOM Elements
// ============================================
// Cache DOM elements with null checks
let roomGrid, refreshBtn, connectionStatus, statusText, lastUpdateText;
let loadingIndicator, errorAlert, errorMessage, emptyState;
let totalOccupancy, activeRooms, busyRooms, emptyRooms;

/**
 * Initialize DOM element references
 * Throws error if critical elements are missing
 */
function initializeDOMElements() {
    // Get all required DOM elements
    roomGrid = document.getElementById('roomGrid');
    refreshBtn = document.getElementById('refreshBtn');
    connectionStatus = document.getElementById('connectionStatus');
    statusText = document.getElementById('statusText');
    lastUpdateText = document.getElementById('lastUpdateText');
    loadingIndicator = document.getElementById('loadingIndicator');
    errorAlert = document.getElementById('errorAlert');
    errorMessage = document.getElementById('errorMessage');
    emptyState = document.getElementById('emptyState');
    totalOccupancy = document.getElementById('totalOccupancy');
    activeRooms = document.getElementById('activeRooms');
    busyRooms = document.getElementById('busyRooms');
    emptyRooms = document.getElementById('emptyRooms');

    // Validate all critical elements are present
    const elements = {
        roomGrid, refreshBtn, connectionStatus, statusText, lastUpdateText,
        loadingIndicator, errorAlert, errorMessage, emptyState,
        totalOccupancy, activeRooms, busyRooms, emptyRooms
    };

    for (const [name, element] of Object.entries(elements)) {
        if (!element) {
            throw new Error(`Required DOM element not found: ${name}`);
        }
    }
}

// ============================================
// Initialization
// ============================================
async function initializeApp() {
    try {
        // Initialize DOM elements first
        initializeDOMElements();

        // Validate configuration
        if (!CONFIG.SUPABASE_URL || CONFIG.SUPABASE_URL === 'https://your-project.supabase.co') {
            throw new Error('Supabase URL not configured. Please update CONFIG in script.js');
        }
        if (!CONFIG.SUPABASE_ANON_KEY || CONFIG.SUPABASE_ANON_KEY === 'your-anon-key-here') {
            throw new Error('Supabase anon key not configured. Please update CONFIG in script.js');
        }
        if (!CONFIG.TABLE_NAME) {
            throw new Error('TABLE_NAME not configured. Please update CONFIG in script.js');
        }

        // Initialize Supabase client
        initializeSupabase();

        // Attach event listeners
        attachEventListeners();

        // Initial load
        await loadRoomData();

        // Set up auto-refresh (optional)
        // setupAutoRefresh();

        updateStatus('Connected', 'success');
    } catch (error) {
        console.error('Initialization error:', error);
        updateStatus('Initialization failed', 'error');
        showError(`Failed to initialize: ${error.message}`);
    }
}

// ============================================
// Supabase Initialization
// ============================================
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

// ============================================
// Data Fetching
// ============================================
/**
 * Fetch latest occupancy data for all rooms
 */
async function fetchLatestRoomCounts() {
    if (!supabaseClient) {
        throw new Error('Supabase client not initialized');
    }

    try {
        // Try with person_count first (backend uses this), fall back to people_count
        let { data, error } = await supabaseClient
            .from(CONFIG.TABLE_NAME)
            .select('room_id, timestamp, person_count')
            .order('timestamp', { ascending: false })
            .limit(500); // Fetch more to ensure we get one per room

        // If person_count fails, try people_count
        if (error && error.message.includes('person_count')) {
            const response = await supabaseClient
                .from(CONFIG.TABLE_NAME)
                .select('room_id, timestamp, people_count')
                .order('timestamp', { ascending: false })
                .limit(500);
            data = response.data;
            error = response.error;
        }

        if (error) {
            throw error;
        }

        // Normalize column name: convert person_count to people_count for consistency
        const normalizedData = data.map(record => {
            const count = record.people_count || record.person_count || 0;
            return {
                room_id: record.room_id,
                timestamp: record.timestamp,
                // Ensure count is non-negative and a valid number
                people_count: Math.max(0, parseInt(count, 10) || 0)
            };
        });

        // Group by room_id and keep only the latest record per room
        const roomMap = {};
        for (const record of normalizedData) {
            if (!roomMap[record.room_id]) {
                roomMap[record.room_id] = record;
            }
        }

        return Object.values(roomMap);
    } catch (error) {
        console.error('Error fetching room data:', error);
        throw error;
    }
}

// ============================================
// UI Rendering
// ============================================
/**
 * Load and display room data
 */
async function loadRoomData() {
    if (isLoading) return;

    try {
        isLoading = true;
        refreshBtn.disabled = true;
        showLoadingIndicator();
        hideErrorMessage();

        const rooms = await fetchLatestRoomCounts();

        if (rooms.length === 0) {
            showEmptyState();
            updateStatus('No rooms with data', 'warning');
        } else {
            hideEmptyState();
            renderRoomCards(rooms);
            updateStatistics(rooms);
            updateStatus(`Connected • ${rooms.length} room(s)`, 'success');
        }

        updateLastUpdateTime();
    } catch (error) {
        console.error('Error loading room data:', error);
        updateStatus('Failed to load data', 'error');
        
        let errorMsg = error.message;
        
        // Provide helpful guidance based on error type
        if (errorMsg.includes('Could not find the table')) {
            errorMsg += '\n\n🔍 Troubleshooting steps:\n1. Open debug.html to diagnose\n2. Check table name in Supabase\n3. Verify RLS policies allow SELECT';
        } else if (errorMsg.includes('relation') && errorMsg.includes('does not exist')) {
            errorMsg += '\n\n⚠️ Table does not exist. Create it in Supabase SQL Editor (see TROUBLESHOOTING.md)';
        }
        
        showError(`Failed to load room data: ${errorMsg}`);
        showEmptyState();
    } finally {
        isLoading = false;
        refreshBtn.disabled = false;
        hideLoadingIndicator();
    }
}

/**
 * Render room cards to the grid with filtering
 */
function renderRoomCards(rooms) {
    allRooms = rooms;
    
    // Apply current filter
    let filteredRooms = rooms;
    if (currentFilter === 'occupied') {
        filteredRooms = rooms.filter(room => room.people_count > 0);
    } else if (currentFilter === 'empty') {
        filteredRooms = rooms.filter(room => room.people_count === 0);
    }
    
    roomGrid.innerHTML = '';
    
    if (filteredRooms.length === 0) {
        roomGrid.innerHTML = '<p style="grid-column: 1/-1; text-align: center; color: var(--text-muted); padding: 2rem;">No rooms match the current filter.</p>';
        return;
    }

    filteredRooms.forEach((room) => {
        const card = createRoomCard(room);
        roomGrid.appendChild(card);
    });
}

/**
 * Create a single room card element with enhanced design
 */
function createRoomCard(room) {
    const card = document.createElement('div');
    card.className = 'room-card';
    card.dataset.roomId = room.room_id;
    card.dataset.count = room.people_count;

    const { status, color, icon, capacityPercent } = getOccupancyStatus(room.people_count);
    const formattedTime = formatTimestamp(room.timestamp);
    const isStale = isDataStale(room.timestamp);
    
    if (isStale) {
        card.classList.add('stale-data');
    }

    card.innerHTML = `
        <div class="room-header">
            <div class="room-title-group">
                <span class="room-icon">${icon}</span>
                <h3 class="room-name">${escapeHtml(formatRoomName(room.room_id))}</h3>
            </div>
            <div class="room-status-badge ${status}">
                <span class="status-dot"></span>
            </div>
        </div>
        
        <div class="room-body">
            <div class="occupancy-display">
                <div class="occupancy-number" style="color: ${color}">
                    ${room.people_count}
                </div>
                <div class="occupancy-label">
                    ${room.people_count === 1 ? 'Person' : 'People'}
                </div>
            </div>
            
            <div class="capacity-bar-container">
                <div class="capacity-bar">
                    <div class="capacity-fill ${status}" style="width: ${capacityPercent}%"></div>
                </div>
                <div class="capacity-label">
                    <span>${capacityPercent}% Capacity</span>
                    <span class="status-text ${status}">${formatStatus(status)}</span>
                </div>
            </div>
        </div>
        
        <div class="room-footer">
            <div class="timestamp ${isStale ? 'stale' : ''}">
                <span class="time-icon">${isStale ? '⚠️' : '🕐'}</span>
                <span>${formattedTime}</span>
                ${isStale ? '<span class="stale-badge">Stale</span>' : ''}
            </div>
        </div>
    `;

    return card;
}

/**
 * Determine occupancy status with 4-tier system and capacity calculation
 * @param {number} count - Number of people in the room
 * @param {number} maxCapacity - Optional custom max capacity (defaults to CONFIG value)
 * @returns {Object} Status object with status, color, icon, and capacityPercent
 */
function getOccupancyStatus(count, maxCapacity = CONFIG.MAX_CAPACITY_PER_ROOM) {
    // Validate inputs
    count = Math.max(0, parseInt(count, 10) || 0);
    maxCapacity = Math.max(1, parseInt(maxCapacity, 10) || CONFIG.MAX_CAPACITY_PER_ROOM);
    
    const capacityPercent = Math.min(Math.round((count / maxCapacity) * 100), 100);
    
    if (count === 0) {
        return { 
            status: 'empty', 
            color: '#0ea5e9', 
            icon: '🚪',
            capacityPercent
        };
    } else if (count <= CONFIG.THRESHOLDS.LOW) {
        return { 
            status: 'low', 
            color: '#10b981', 
            icon: '✓',
            capacityPercent
        };
    } else if (count <= CONFIG.THRESHOLDS.MODERATE) {
        return { 
            status: 'moderate', 
            color: '#f59e0b', 
            icon: '⚠️',
            capacityPercent
        };
    } else {
        return { 
            status: 'high', 
            color: '#ef4444', 
            icon: '🔴',
            capacityPercent
        };
    }
}

/**
 * Check if data is stale (older than configured threshold)
 * @param {string} timestamp - ISO timestamp string
 * @param {number} thresholdMinutes - Optional custom threshold (defaults to CONFIG value)
 * @returns {boolean} True if data is stale
 */
function isDataStale(timestamp, thresholdMinutes = CONFIG.STALENESS_THRESHOLD_MINUTES) {
    try {
        const dataAge = Date.now() - new Date(timestamp).getTime();
        return dataAge > thresholdMinutes * 60 * 1000;
    } catch (error) {
        console.error('Error checking data staleness:', error);
        return true; // Treat invalid timestamps as stale
    }
}

/**
 * Format room name for display
 */
function formatRoomName(roomId) {
    return roomId
        .replace(/_/g, ' ')
        .replace(/-/g, ' ')
        .split(' ')
        .map(word => word.charAt(0).toUpperCase() + word.slice(1))
        .join(' ');
}

/**
 * Format status for display
 */
function formatStatus(status) {
    const statusMap = {
        'empty': 'Available',
        'low': 'Light',
        'moderate': 'Moderate',
        'high': 'Busy'
    };
    return statusMap[status] || status;
}

/**
 * Format timestamp to readable format
 */
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
                minute: '2-digit',
                second: '2-digit',
            });
        }
    } catch {
        return 'Unknown';
    }
}

/**
 * Update last update timestamp
 */
function updateLastUpdateTime() {
    const now = new Date();
    lastUpdateText.textContent = now.toLocaleTimeString();
}

/**
 * Update building statistics
 * @param {Array} rooms - Array of room objects
 */
function updateStatistics(rooms) {
    if (!rooms || !Array.isArray(rooms)) {
        console.error('Invalid rooms data provided to updateStatistics');
        return;
    }

    const total = rooms.reduce((sum, room) => sum + (room.people_count || 0), 0);
    const occupied = rooms.filter(room => room.people_count > 0).length;
    const busy = rooms.filter(room => room.people_count > CONFIG.THRESHOLDS.MODERATE).length;
    const empty = rooms.filter(room => room.people_count === 0).length;
    
    if (totalOccupancy) totalOccupancy.textContent = total;
    if (activeRooms) activeRooms.textContent = occupied;
    if (busyRooms) busyRooms.textContent = busy;
    if (emptyRooms) emptyRooms.textContent = empty;
}

/**
 * Update connection status indicator
 */
function updateConnectionStatus(status, message) {
    connectionStatus.className = `connection-status ${status}`;
    statusText.textContent = message;
}

/**
 * Update status text (for backward compatibility)
 */
function updateStatus(message, type = 'info') {
    const statusMap = {
        success: { status: 'connected', msg: message },
        error: { status: 'error', msg: message },
        warning: { status: '', msg: message },
        info: { status: '', msg: message }
    };
    
    const { status, msg } = statusMap[type] || { status: '', msg: message };
    updateConnectionStatus(status, msg);
}

// ============================================
// UI State Management
// ============================================
function showLoadingIndicator() {
    loadingIndicator.classList.remove('hidden');
}

function hideLoadingIndicator() {
    loadingIndicator.classList.add('hidden');
}

function showError(message) {
    errorMessage.textContent = message;
    errorAlert.classList.remove('hidden');
}

function hideErrorMessage() {
    errorAlert.classList.add('hidden');
}

function showEmptyState() {
    emptyState.classList.remove('hidden');
    roomGrid.innerHTML = '';
}

function hideEmptyState() {
    emptyState.classList.add('hidden');
}

// ============================================
// Event Listeners
// ============================================
// Store references to event handlers for cleanup
const eventHandlers = {
    refresh: null,
    filters: []
};

function attachEventListeners() {
    // Refresh button with debounce
    eventHandlers.refresh = debounce(() => {
        loadRoomData();
    }, 500);
    
    if (refreshBtn) {
        refreshBtn.addEventListener('click', eventHandlers.refresh);
    }
    
    // Filter buttons
    const filterButtons = document.querySelectorAll('.filter-btn');
    filterButtons.forEach(btn => {
        const handler = () => {
            // Update active button
            filterButtons.forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            
            // Apply filter
            currentFilter = btn.dataset.filter;
            if (allRooms.length > 0) {
                renderRoomCards(allRooms);
            }
        };
        eventHandlers.filters.push({ element: btn, handler });
        btn.addEventListener('click', handler);
    });
}

/**
 * Clean up event listeners to prevent memory leaks
 */
function removeEventListeners() {
    if (refreshBtn && eventHandlers.refresh) {
        refreshBtn.removeEventListener('click', eventHandlers.refresh);
    }
    
    eventHandlers.filters.forEach(({ element, handler }) => {
        element.removeEventListener('click', handler);
    });
    eventHandlers.filters = [];
}

function setupAutoRefresh() {
    // Auto-refresh every 30 seconds
    refreshInterval = setInterval(() => {
        loadRoomData();
    }, CONFIG.REFRESH_INTERVAL);
}

// ============================================
// Utilities
// ============================================
/**
 * Debounce function to limit rapid calls
 * @param {Function} func - Function to debounce
 * @param {number} wait - Milliseconds to wait
 * @returns {Function} Debounced function
 */
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

/**
 * Escape HTML special characters to prevent XSS
 * @param {string} text - Text to escape
 * @returns {string} Escaped text
 */
function escapeHtml(text) {
    if (!text) return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

// ============================================
// Start Application
// ============================================
document.addEventListener('DOMContentLoaded', () => {
    initializeApp();
});

// Cleanup on page unload
window.addEventListener('beforeunload', () => {
    if (refreshInterval) {
        clearInterval(refreshInterval);
        refreshInterval = null;
    }
    removeEventListeners();
});
