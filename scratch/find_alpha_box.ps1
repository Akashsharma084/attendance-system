Add-Type -AssemblyName System.Drawing
$sourcePath = "C:\Users\hp\.gemini\antigravity-ide\brain\2351ec72-2285-4599-ae43-17cdfa4fa422\.user_uploaded\media_1789981881159.png"
$bmp = [System.Drawing.Bitmap]::FromFile($sourcePath)

$minX = $bmp.Width
$minY = $bmp.Height
$maxX = 0
$maxY = 0

for ($y = 0; $y -lt $bmp.Height; $y += 2) {
    for ($x = 0; $x -lt $bmp.Width; $x += 2) {
        $pixel = $bmp.GetPixel($x, $y)
        if ($pixel.A -gt 20) {
            if ($x -lt $minX) { $minX = $x }
            if ($x -gt $maxX) { $maxX = $x }
            if ($y -lt $minY) { $minY = $y }
            if ($y -gt $maxY) { $maxY = $y }
        }
    }
}

Write-Host "Alpha Bounding Box: minX=$minX, minY=$minY, maxX=$maxX, maxY=$maxY"
$contentWidth = $maxX - $minX
$contentHeight = $maxY - $minY
Write-Host "Content Size: ${contentWidth}x${contentHeight}"

$bmp.Dispose()
