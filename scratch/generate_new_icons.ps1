Add-Type -AssemblyName System.Drawing

$sourcePath = "C:\Users\hp\.gemini\antigravity-ide\brain\2351ec72-2285-4599-ae43-17cdfa4fa422\.user_uploaded\media_1789982224208.png"
$destDir = "c:\Users\hp\Downloads\attendance-system\attendance-system\public"

$src = [System.Drawing.Image]::FromFile($sourcePath)
Write-Host "Original Image Size: $($src.Width)x$($src.Height)"

# Copy original high-res logo directly
$origDest = Join-Path $destDir "company-logo.png"
[System.IO.File]::Copy($sourcePath, $origDest, $true)
Write-Host "Saved company-logo.png"

function Save-Resized-Icon($targetWidth, $targetHeight, $fileName, $paddingRatio = 0.0) {
    $bmp = New-Object System.Drawing.Bitmap($targetWidth, $targetHeight, [System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
    $g = [System.Drawing.Graphics]::FromImage($bmp)
    $g.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
    $g.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::HighQuality
    $g.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality
    $g.CompositingQuality = [System.Drawing.Drawing2D.CompositingQuality]::HighQuality

    # Crisp pure white background matching the official logo canvas
    $g.Clear([System.Drawing.Color]::White)

    if ($paddingRatio -gt 0) {
        $padX = [int]($targetWidth * $paddingRatio)
        $padY = [int]($targetHeight * $paddingRatio)
        $drawW = $targetWidth - (2 * $padX)
        $drawH = $targetHeight - (2 * $padY)
        $g.DrawImage($src, $padX, $padY, $drawW, $drawH)
    } else {
        $g.DrawImage($src, 0, 0, $targetWidth, $targetHeight)
    }

    $outPath = Join-Path $destDir $fileName
    $bmp.Save($outPath, [System.Drawing.Imaging.ImageFormat]::Png)
    $g.Dispose()
    $bmp.Dispose()
    Write-Host "Generated: $fileName (${targetWidth}x${targetHeight})"
}

# Standard PWA launcher & App icons
Save-Resized-Icon 512 512 "icon-512.png" 0.04
Save-Resized-Icon 192 192 "icon-192.png" 0.04

# Maskable icons (requires 10% safe zone padding so circular/squircle Android launchers never clip logo)
Save-Resized-Icon 512 512 "icon-maskable-512.png" 0.12
Save-Resized-Icon 192 192 "icon-maskable-192.png" 0.12

# Apple Touch Icon (iOS Home Screen)
Save-Resized-Icon 180 180 "apple-touch-icon.png" 0.05

# Favicons
Save-Resized-Icon 64 64 "favicon-64.png" 0.02
Save-Resized-Icon 32 32 "favicon-32.png" 0.02

# Main softwind logo reference
Save-Resized-Icon 512 512 "softwind-logo.png" 0.0

$src.Dispose()
Write-Host "All icons generated successfully from the new logo!"
