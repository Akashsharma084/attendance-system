import fs from 'fs';
import path from 'path';

console.log('--- Verifying Sunday calendar text and absence of "Weekend" word ---');

const empDashboard = fs.readFileSync(path.resolve('src/pages/EmployeeDashboard.jsx'), 'utf-8');
const adminDashboard = fs.readFileSync(path.resolve('src/pages/AdminDashboard.jsx'), 'utf-8');
const dateHelpers = fs.readFileSync(path.resolve('src/utils/dateHelpers.js'), 'utf-8');

// 1. Check for "Weekend" in user-facing text
const empHasWeekend = empDashboard.includes('>Weekend<') || empDashboard.includes('"Weekend"') || empDashboard.includes("'Weekend'");
const adminHasWeekend = adminDashboard.includes('>Weekend<') || adminDashboard.includes('"Weekend"') || adminDashboard.includes("'Weekend'") || adminDashboard.includes("Weekend Off");

console.log('1. Employee Dashboard has no user-facing "Weekend":', !empHasWeekend ? 'PASS ✓' : 'FAIL ✗');
console.log('2. Admin Dashboard has no user-facing "Weekend":', !adminHasWeekend ? 'PASS ✓' : 'FAIL ✗');

// 2. Check for "Sunday" pill and legend
const empHasSundayPill = empDashboard.includes('>Sunday<') && empDashboard.includes('sw-legend-dot weekend" /> Sunday');
const adminHasSundayPill = adminDashboard.includes('>Sunday<') && adminDashboard.includes('sw-legend-dot weekend" /> Sunday') && adminDashboard.includes('>Sunday Off<');

console.log('3. Employee Dashboard has "Sunday" legend and pill:', empHasSundayPill ? 'PASS ✓' : 'FAIL ✗');
console.log('4. Admin Dashboard has "Sunday" legend, pill, and "Sunday Off":', adminHasSundayPill ? 'PASS ✓' : 'FAIL ✗');

// 3. Check that headers highlight only Sun
const empSunOnly = empDashboard.includes("day === 'Sun' ? 'weekend' : ''");
const adminSunOnly = adminDashboard.includes("day === 'Sun' ? 'weekend' : ''");

console.log('5. Employee calendar header highlights only Sun:', empSunOnly ? 'PASS ✓' : 'FAIL ✗');
console.log('6. Admin calendar header highlights only Sun:', adminSunOnly ? 'PASS ✓' : 'FAIL ✗');

// 4. Check that Monday to Saturday are working days
const hasMonToSat = dateHelpers.includes('dayOfWeek >= 1 && dayOfWeek <= 6');
console.log('7. Monday to Saturday are counted as working days:', hasMonToSat ? 'PASS ✓' : 'FAIL ✗');

if (!empHasWeekend && !adminHasWeekend && empHasSundayPill && adminHasSundayPill && empSunOnly && adminSunOnly && hasMonToSat) {
  console.log('\n>>> ALL SUNDAY LOGIC CHECKS PASSED! <<<');
  process.exit(0);
} else {
  console.error('\n>>> SOME CHECKS FAILED! <<<');
  process.exit(1);
}
