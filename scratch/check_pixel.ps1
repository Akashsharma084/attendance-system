Add-Type -AssemblyName System.Drawing
$sourcePath = "C:\Users\hp\.gemini\antigravity-ide\brain\2351ec72-2285-4599-ae43-17cdfa4fa422\.user_uploaded\media_1789981881159.png"
$bmp = [System.Drawing.Bitmap]::FromFile($sourcePath)
$corner = $bmp.GetPixel(0, 0)
Write-Host "Corner (0,0): A=$($corner.A), R=$($corner.R), G=$($corner.G), B=$($corner.B)"
$center = $bmp.GetPixel(512, 512)
Write-Host "Center (512,512): A=$($center.A), R=$($center.R), G=$($center.G), B=$($center.B)"
$bmp.Dispose()
