/**
 * Verification Script
 * Checks if key functions are exposed and if KaTeX loaded.
 */
console.log("🔍 Verifying Environment...");
let errors = 0;

// Check 1: Simulator Functions Explosed
if (typeof window.calculateMonthlyStep === 'function') {
    console.log("✅ calculateMonthlyStep is exposed.");
} else {
    console.error("❌ calculateMonthlyStep is NOT defined.");
    errors++;
}

if (typeof window.calcFragilityScore === 'function') {
    console.log("✅ calcFragilityScore is exposed.");
} else {
    console.error("❌ calcFragilityScore is NOT defined.");
    errors++;
}

// Check 2: KaTeX
if (typeof renderMathInElement === 'function' || typeof katex !== 'undefined') {
    console.log("✅ KaTeX appears to be loaded (or at least no crash).");
} else {
    console.log("⚠️ KaTeX object not found (might be async). Checking dominance...");
}

if (errors === 0) {
    console.log("🎉 Verification Passed: No critical errors found.");
} else {
    console.error(`💥 Verification Failed with ${errors} errors.`);
}
