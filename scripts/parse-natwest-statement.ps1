[CmdletBinding()]
param(
  [Parameter(Mandatory = $true)]
  [string]$InputPdf,

  [string]$OutputFile = (Join-Path (Split-Path -Parent $PSScriptRoot) 'natwest-data.js'),

  [int]$Year = 0,

  [string]$PdfToText = 'pdftotext'
)

$resolvedPdf = (Resolve-Path -LiteralPath $InputPdf -ErrorAction Stop).Path
$converter = Get-Command $PdfToText -ErrorAction SilentlyContinue
if (-not $converter) {
  throw 'pdftotext was not found. Install Poppler or pass its executable path with -PdfToText.'
}

$lines = & $converter.Source -layout -enc UTF-8 $resolvedPdf -
if ($LASTEXITCODE -ne 0) {
  throw "pdftotext could not read '$resolvedPdf'."
}

if ($Year -eq 0) {
  $yearMatches = [regex]::Matches(($lines -join "`n"), '\b20\d{2}\b')
  if ($yearMatches.Count -eq 0) {
    throw 'The statement year could not be detected. Pass it explicitly with -Year.'
  }
  $Year = [int]$yearMatches[0].Value
}

$monthNames = @{
  Jan = 'Jan'; Feb = 'Feb'; Mar = 'Mar'; Apr = 'Apr'; May = 'May'; Jun = 'Jun'
  Jul = 'Jul'; Aug = 'Aug'; Sep = 'Sep'; Oct = 'Oct'; Nov = 'Nov'; Dec = 'Dec'
}
$rowPattern = '^\s*(?<day>\d{1,2})\s+(?<month>[A-Z][a-z]{2})\s+(?<merchant>.+?)\s{2,}(?<type>.+?)\s{2,}(?<signed>-?\p{Sc}[\d,]+\.\d{2})\s*$'
$transactions = [System.Collections.Generic.List[object]]::new()
$candidateRows = @($lines | Where-Object { $_ -match '^\s*\d{1,2}\s+[A-Z][a-z]{2}\s+' })

foreach ($line in $candidateRows) {
  if ($line -notmatch $rowPattern) { continue }

  $signedAmount = $Matches.signed
  $direction = if ($signedAmount.StartsWith('-')) { 'out' } else { 'in' }
  $amountText = $signedAmount -replace '[-\p{Sc},]', ''
  $month = $Matches.month

  $transactions.Add([pscustomobject][ordered]@{
    bank = 'Natwest'
    month = $monthNames[$month]
    date = ('{0:D2} {1} {2:D2}' -f ([int]$Matches.day), $month, ($Year % 100))
    description = $Matches.merchant.Trim()
    type = $Matches.type.Trim()
    direction = $direction
    amount = [decimal]::Parse($amountText, [Globalization.CultureInfo]::InvariantCulture)
    year = $Year
  })
}

if ($transactions.Count -eq 0) {
  throw 'No NatWest transaction rows were found. The PDF layout may not be supported.'
}
if ($transactions.Count -ne $candidateRows.Count) {
  throw "Only $($transactions.Count) of $($candidateRows.Count) dated NatWest rows were parsed."
}

$outputPath = [IO.Path]::GetFullPath($OutputFile)
$outputDirectory = Split-Path -Parent $outputPath
if (-not (Test-Path -LiteralPath $outputDirectory)) {
  New-Item -ItemType Directory -Path $outputDirectory | Out-Null
}

$json = $transactions | ConvertTo-Json -Compress -Depth 4
[IO.File]::WriteAllText($outputPath, "window.natwestTransactions = $json;`n", [Text.UTF8Encoding]::new($false))
$moneyIn = [decimal](($transactions | Where-Object direction -eq 'in' | Measure-Object amount -Sum).Sum)
$moneyOut = [decimal](($transactions | Where-Object direction -eq 'out' | Measure-Object amount -Sum).Sum)
Write-Output "Parsed and validated $($transactions.Count) NatWest transactions for $Year (in $moneyIn; out $moneyOut)."
