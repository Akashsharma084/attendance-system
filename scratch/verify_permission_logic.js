// Verify CheckIn permission flow and HTML/bundle structure
import fs from 'fs';
import path from 'path';

console.log('--- Verifying CheckIn.jsx implementation ---');

const checkInPath = path.resolve('src/pages/CheckIn.jsx');
const checkInCode = fs.readFileSync(checkInPath, 'utf-8');

// 1. Check for the two options
const hasAlwaysAllow = checkInCode.includes("Always Allow");
const hasAllowOnce = checkInCode.includes("Allow Once");
const hasNeverAllow = checkInCode.toLowerCase().includes("never allow");

console.log('1. Shows "Always Allow":', hasAlwaysAllow ? 'PASS ✓' : 'FAIL ✗');
console.log('2. Shows "Allow Once":', hasAllowOnce ? 'PASS ✓' : 'FAIL ✗');
console.log('3. Does NOT show "Never Allow":', !hasNeverAllow ? 'PASS ✓' : 'FAIL ✗');

// 2. Check for concurrent GPS fetching and caching
const hasConcurrentLocation = checkInCode.includes("locationPromiseRef.current = fetchAndLockLocation()");
const hasCachedLocation = checkInCode.includes("if (locationRef.current) return locationRef.current");
const hasFallback = checkInCode.includes("enableHighAccuracy: false");

console.log('4. Pre-fetches GPS location concurrently with camera:', hasConcurrentLocation ? 'PASS ✓' : 'FAIL ✗');
console.log('5. Caches and reuses location for fast punch save:', hasCachedLocation ? 'PASS ✓' : 'FAIL ✗');
console.log('6. Has dual-tier fallback so location fetches properly:', hasFallback ? 'PASS ✓' : 'FAIL ✗');

// 3. Check for permission blocked unblock guidance
const hasBlockedCard = checkInCode.includes("sw-perm-blocked-card") && checkInCode.includes("Lock icon");
console.log('7. Has browser permission blocked guidance card:', hasBlockedCard ? 'PASS ✓' : 'FAIL ✗');

// 4. Check for Hero punch button calling handleInitiatePunch
const hasHeroPunchBtn = checkInCode.includes("onClick={handleInitiatePunch}");
console.log('8. Hero Punch button triggers handleInitiatePunch:', hasHeroPunchBtn ? 'PASS ✓' : 'FAIL ✗');

// 5. Verify index.css has the permission modal styling
const cssPath = path.resolve('src/index.css');
const cssContent = fs.readFileSync(cssPath, 'utf-8');
const hasCss = cssContent.includes('.sw-perm-modal') && cssContent.includes('.sw-perm-btn-always') && cssContent.includes('.sw-perm-btn-once');
console.log('9. CSS styles for permission modal & buttons present:', hasCss ? 'PASS ✓' : 'FAIL ✗');

if (hasAlwaysAllow && hasAllowOnce && !hasNeverAllow && hasConcurrentLocation && hasCachedLocation && hasFallback && hasBlockedCard && hasHeroPunchBtn && hasCss) {
  console.log('\n>>> ALL 9 VERIFICATION CHECKS PASSED! <<<');
  process.exit(0);
} else {
  console.error('\n>>> SOME CHECKS FAILED! <<<');
  process.exit(1);
}
