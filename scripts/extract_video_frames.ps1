param(
  [Parameter(Mandatory = $true)]
  [string]$InputPath,
  [Parameter(Mandatory = $true)]
  [string]$OutputDirectory,
  [int]$FrameCount = 16,
  [double]$StartSeconds = 0,
  [double]$EndSeconds = -1
)

$ErrorActionPreference = 'Stop'
Set-StrictMode -Version Latest

Add-Type -AssemblyName PresentationCore
Add-Type -AssemblyName WindowsBase

$resolvedInput = (Resolve-Path -LiteralPath $InputPath).Path
$resolvedOutput = [System.IO.Path]::GetFullPath($OutputDirectory)
[System.IO.Directory]::CreateDirectory($resolvedOutput) | Out-Null

$player = [System.Windows.Media.MediaPlayer]::new()
$player.Volume = 0
$player.ScrubbingEnabled = $true
$script:mediaOpened = $false
$script:mediaFailed = $null

$openedHandler = [System.EventHandler]{
  param($sender, $eventArgs)
  $script:mediaOpened = $true
}
$failedHandler = [System.EventHandler[System.Windows.Media.ExceptionEventArgs]]{
  param($sender, $eventArgs)
  $script:mediaFailed = $eventArgs.ErrorException
}
$player.add_MediaOpened($openedHandler)
$player.add_MediaFailed($failedHandler)

try {
  $player.Open([System.Uri]::new($resolvedInput))
  $deadline = [DateTime]::UtcNow.AddSeconds(15)
  while (-not $script:mediaOpened -and $null -eq $script:mediaFailed -and [DateTime]::UtcNow -lt $deadline) {
    [System.Windows.Threading.Dispatcher]::CurrentDispatcher.Invoke(
      [System.Windows.Threading.DispatcherPriority]::Background,
      [System.Action]{}
    )
    Start-Sleep -Milliseconds 40
  }

  if ($null -ne $script:mediaFailed) {
    throw $script:mediaFailed
  }
  if (-not $script:mediaOpened) {
    throw 'Timed out while opening the video.'
  }
  if (-not $player.NaturalDuration.HasTimeSpan) {
    throw 'The video duration is unavailable.'
  }

  $width = $player.NaturalVideoWidth
  $height = $player.NaturalVideoHeight
  $durationSeconds = $player.NaturalDuration.TimeSpan.TotalSeconds
  if ($width -le 0 -or $height -le 0 -or $durationSeconds -le 0) {
    throw "Invalid video metadata: ${width}x${height}, duration ${durationSeconds}s."
  }

  $player.Play()
  Start-Sleep -Milliseconds 160
  $player.Pause()

  $rangeStart = [Math]::Min([Math]::Max(0.0, [double]$StartSeconds), [Math]::Max(0.0, [double]$durationSeconds - 0.04))
  $rangeEnd = if ($EndSeconds -lt 0) { $durationSeconds } else { $EndSeconds }
  $rangeEnd = [Math]::Min([Math]::Max([double]$rangeStart, [double]$rangeEnd), [double]$durationSeconds)
  for ($index = 0; $index -lt $FrameCount; $index++) {
    $fraction = if ($FrameCount -eq 1) { 0.5 } else { [double]$index / [double]($FrameCount - 1) }
    $seconds = [Math]::Min([Math]::Max(0.0, [double]$rangeStart + ([double]$rangeEnd - [double]$rangeStart) * $fraction), [Math]::Max(0.0, [double]$durationSeconds - 0.04))
    $player.Position = [TimeSpan]::FromSeconds($seconds)
    $player.Play()
    Start-Sleep -Milliseconds 110
    $player.Pause()
    Start-Sleep -Milliseconds 70

    $visual = [System.Windows.Media.DrawingVisual]::new()
    $context = $visual.RenderOpen()
    try {
      $context.DrawVideo($player, [System.Windows.Rect]::new(0, 0, $width, $height))
    } finally {
      $context.Close()
    }

    $bitmap = [System.Windows.Media.Imaging.RenderTargetBitmap]::new(
      $width,
      $height,
      96,
      96,
      [System.Windows.Media.PixelFormats]::Pbgra32
    )
    $bitmap.Render($visual)
    $encoder = [System.Windows.Media.Imaging.PngBitmapEncoder]::new()
    $encoder.Frames.Add([System.Windows.Media.Imaging.BitmapFrame]::Create($bitmap))
    $filename = "frame-{0:D3}-{1:F2}s.png" -f $index, $seconds
    $stream = [System.IO.File]::Open(
      [System.IO.Path]::Combine($resolvedOutput, $filename),
      [System.IO.FileMode]::Create,
      [System.IO.FileAccess]::Write
    )
    try {
      $encoder.Save($stream)
    } finally {
      $stream.Dispose()
    }
  }

  Write-Output ("duration={0:F3}" -f $durationSeconds)
  Write-Output ("size={0}x{1}" -f $width, $height)
  Write-Output ("frames={0}" -f $FrameCount)
} finally {
  $player.Stop()
  $player.Close()
  $player.remove_MediaOpened($openedHandler)
  $player.remove_MediaFailed($failedHandler)
}
