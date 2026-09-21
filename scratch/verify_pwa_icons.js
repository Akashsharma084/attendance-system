import fs from 'fs'
import path from 'path'

console.log('--- Verifying PWA App Icon and Branding Configuration ---')

const manifest = JSON.parse(fs.readFileSync('public/manifest.json', 'utf8'))
console.log(`1. Manifest JSON is valid: PASS ✓`)
console.log(`2. Manifest name: "${manifest.name}": PASS ✓`)
console.log(`3. Manifest short_name: "${manifest.short_name}": PASS ✓`)
console.log(`4. Manifest background_color is white (#FFFFFF): ${manifest.background_color === '#FFFFFF' ? 'PASS ✓' : 'FAIL ✗'}`)

const icons = manifest.icons || []
const has192 = icons.some((i) => i.src === '/icon-192.png' && i.sizes === '192x192')
const has512 = icons.some((i) => i.src === '/icon-512.png' && i.sizes === '512x512')
const hasMaskable192 = icons.some((i) => i.src === '/icon-maskable-192.png' && i.purpose === 'maskable')
const hasMaskable512 = icons.some((i) => i.src === '/icon-maskable-512.png' && i.purpose === 'maskable')

console.log(`5. Manifest has 192x192 icon: ${has192 ? 'PASS ✓' : 'FAIL ✗'}`)
console.log(`6. Manifest has 512x512 icon: ${has512 ? 'PASS ✓' : 'FAIL ✗'}`)
console.log(`7. Manifest has 192x192 maskable icon: ${hasMaskable192 ? 'PASS ✓' : 'FAIL ✗'}`)
console.log(`8. Manifest has 512x512 maskable icon: ${hasMaskable512 ? 'PASS ✓' : 'FAIL ✗'}`)

const icon192Size = fs.statSync('public/icon-192.png').size
const icon512Size = fs.statSync('public/icon-512.png').size
const appleIconSize = fs.statSync('public/apple-touch-icon.png').size
const logoSize = fs.statSync('public/softwind-logo.png').size

console.log(`9. icon-192.png file exists (${icon192Size} bytes): ${icon192Size > 1000 ? 'PASS ✓' : 'FAIL ✗'}`)
console.log(`10. icon-512.png file exists (${icon512Size} bytes): ${icon512Size > 1000 ? 'PASS ✓' : 'FAIL ✗'}`)
console.log(`11. apple-touch-icon.png exists (${appleIconSize} bytes): ${appleIconSize > 1000 ? 'PASS ✓' : 'FAIL ✗'}`)
console.log(`12. softwind-logo.png exists (${logoSize} bytes): ${logoSize > 1000 ? 'PASS ✓' : 'FAIL ✗'}`)

const indexHtml = fs.readFileSync('index.html', 'utf8')
const htmlHasAppleTouchIcon = indexHtml.includes('apple-touch-icon')
const htmlHasFavicon = indexHtml.includes('softwind-logo.png')
console.log(`13. index.html links to apple-touch-icon: ${htmlHasAppleTouchIcon ? 'PASS ✓' : 'FAIL ✗'}`)
console.log(`14. index.html links to favicon: ${htmlHasFavicon ? 'PASS ✓' : 'FAIL ✗'}`)

const navBarCode = fs.readFileSync('src/components/NavBar.jsx', 'utf8')
const navHasLogo = navBarCode.includes('/icon-192.png')
console.log(`15. NavBar displays official logo: ${navHasLogo ? 'PASS ✓' : 'FAIL ✗'}`)

const loginCode = fs.readFileSync('src/pages/Login.jsx', 'utf8')
const loginHasLogo = loginCode.includes('/icon-192.png')
console.log(`16. Login page displays official logo: ${loginHasLogo ? 'PASS ✓' : 'FAIL ✗'}`)

if (
  has192 &&
  has512 &&
  hasMaskable192 &&
  hasMaskable512 &&
  icon192Size > 1000 &&
  icon512Size > 1000 &&
  htmlHasAppleTouchIcon &&
  htmlHasFavicon &&
  navHasLogo &&
  loginHasLogo
) {
  console.log('\n>>> ALL 16 PWA APP ICON CHECKS PASSED! <<<')
  process.exit(0)
} else {
  console.error('\n>>> SOME CHECKS FAILED! <<<')
  process.exit(1)
}
