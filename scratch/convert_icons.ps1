Add-Type -AssemblyName System.Drawing

$sourcePath = "C:\Users\hp\.gemini\antigravity-ide\brain\2351ec72-2285-4599-ae43-17cdfa4fa422\.user_uploaded\media_1789979409303.jpg"
$destDir = "c:\Users\hp\Downloads\attendance-system\attendance-system\public"

$src = [System.Drawing.Image]::FromFile($sourcePath)
Write-Output "Original Size: $($src.Width)x$($src.Height)"

function Save-Resized-Icon($targetWidth, $targetHeight, $fileName) {
    $bmp = New-Object System.Drawing.Bitmap($targetWidth, $targetHeight, [System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
    $g = [System.Drawing.Graphics]::FromImage($bmp)
    $g.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
    $g.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::HighQuality
    $g.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality
    $g.CompositingQuality = [System.Drawing.Drawing2D.CompositingQuality]::HighQuality

    # Clear with white background matching logo background
    $g.Clear([System.Drawing.Color]::White)
    $g.DrawImage($src, 0, 0, $targetWidth, $targetHeight)

    $outPath = Join-Path $destDir $fileName
    $bmp.Save($outPath, [System.Drawing.Imaging.ImageFormat]::Png)
    $g.Dispose()
    $bmp.Dispose()
    Write-Output "Generated: $outPath ($($targetWidth)x$($targetHeight))"
}

# Standard PWA and App installation icons
Save-Resized-Icon 512 512 "icon-512.png"
Save-Resized-Icon 192 192 "icon-192.png"
Save-Resized-Icon 512 512 "icon-maskable-512.png"
Save-Resized-Icon 192 192 "icon-maskable-192.png"
Save-Resized-Icon 180 180 "apple-touch-icon.png"
Save-Resized-Icon 64 64 "favicon-64.png"
Save-Resized-Icon 32 32 "favicon-32.png"
Save-Resized-Icon 512 512 "softwind-logo.png"

$src.Dispose()
Write-Output "All icons generated successfully!"
