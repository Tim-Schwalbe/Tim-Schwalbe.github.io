
global.window = {}; // Mock window
const fs = require('fs');
const path = require('path');

// Load stats.js content
const statsPath = path.join(__dirname, '../engine/stats.js');
const statsContent = fs.readFileSync(statsPath, 'utf8');

// Exec
eval(statsContent);

console.log("Checking Stats.random()...");
if (typeof window.Stats.random === 'function') {
    const val = window.Stats.random();
    console.log("✅ Stats.random() exists and returned:", val);
    if (val >= 0 && val < 1) {
        console.log("✅ Value is within [0, 1) range.");
    } else {
        console.error("❌ Value is out of range!");
    }
} else {
    console.error("❌ Stats.random is NOT a function!");
}
