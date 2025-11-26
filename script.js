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
    TABLE_NAME: 'room_stats',
    REFRESH_INTERVAL: 30000, // 30 seconds
    MAX_RETRIES: 3,
};

// ============================================
// Global State
// ============================================
let supabaseClient = null;
let isLoading = false;
let refreshInterval = null;

// ============================================
// DOM Elements
// ============================================
const roomGrid = document.getElementById('roomGrid');
const refreshBtn = document.getElementById('refreshBtn');
const statusText = document.getElementById('status');
const lastUpdateText = document.getElementById('lastUpdate');
const loadingIndicator = document.getElementById('loadingIndicator');
const errorMessage = document.getElementById('errorMessage');
const emptyState = document.getElementById('emptyState');

// ============================================
// Initialization
// ============================================
async function initializeApp() {
    try {
        // Validate configuration
        if (!CONFIG.SUPABASE_URL || CONFIG.SUPABASE_URL === 'https://your-project.supabase.co') {
            throw new Error('Supabase URL not configured. Please update CONFIG in script.js');
        }
        if (!CONFIG.SUPABASE_ANON_KEY || CONFIG.SUPABASE_ANON_KEY === 'your-anon-key-here') {
            throw new Error('Supabase anon key not configured. Please update CONFIG in script.js');
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
        const { data, error } = await supabaseClient
            .from(CONFIG.TABLE_NAME)
            .select('room_id, timestamp, people_count')
            .order('timestamp', { ascending: false })
            .limit(500); // Fetch more to ensure we get one per room

        if (error) {
            throw error;
        }

        // Group by room_id and keep only the latest record per room
        const roomMap = {};
        for (const record of data) {
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
            updateStatus(`Connected • ${rooms.length} room(s)`, 'success');
        }

        updateLastUpdateTime();
    } catch (error) {
        console.error('Error loading room data:', error);
        updateStatus('Failed to load data', 'error');
        showError(`Failed to load room data: ${error.message}`);
        showEmptyState();
    } finally {
        isLoading = false;
        refreshBtn.disabled = false;
        hideLoadingIndicator();
    }
}

/**
 * Render room cards to the grid
 */
function renderRoomCards(rooms) {
    roomGrid.innerHTML = '';

    rooms.forEach((room) => {
        const card = createRoomCard(room);
        roomGrid.appendChild(card);
    });
}

/**
 * Create a single room card element
 */
function createRoomCard(room) {
    const card = document.createElement('div');
    card.className = 'room-card';

    const { status, color } = getOccupancyStatus(room.people_count);
    const formattedTime = formatTimestamp(room.timestamp);

    card.innerHTML = `
        <h2 class="room-name">${escapeHtml(room.room_id)}</h2>
        <div class="room-stats">
            <div class="stat-row">
                <span class="stat-label">Occupancy</span>
                <span class="stat-value" style="color: ${color}">
                    ${room.people_count} ${room.people_count === 1 ? 'person' : 'people'}
                </span>
            </div>
            <div class="stat-row">
                <span class="stat-label">Status</span>
                <span class="occupancy-badge ${status}">
                    <span class="occupancy-dot"></span>
                    ${status.charAt(0).toUpperCase() + status.slice(1)}
                </span>
            </div>
        </div>
        <div class="timestamp">Last updated: ${formattedTime}</div>
    `;

    return card;
}

/**
 * Determine occupancy status based on people count
 */
function getOccupancyStatus(count) {
    if (count === 0) {
        return { status: 'empty', color: '#0369a1' };
    } else if (count <= 5) {
        return { status: 'moderate', color: '#92400e' };
    } else {
        return { status: 'full', color: '#991b1b' };
    }
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
    lastUpdateText.textContent = `Last updated: ${now.toLocaleTimeString()}`;
}

/**
 * Update status text
 */
function updateStatus(message, type = 'info') {
    statusText.textContent = message;
    statusText.style.color = getStatusColor(type);
}

function getStatusColor(type) {
    const colors = {
        success: '#10b981',
        error: '#ef4444',
        warning: '#f59e0b',
        info: '#6b7280',
    };
    return colors[type] || colors.info;
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
    errorMessage.classList.remove('hidden');
}

function hideErrorMessage() {
    errorMessage.classList.add('hidden');
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
function attachEventListeners() {
    refreshBtn.addEventListener('click', () => {
        loadRoomData();
    });
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
 * Escape HTML special characters
 */
function escapeHtml(text) {
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
    }
});
