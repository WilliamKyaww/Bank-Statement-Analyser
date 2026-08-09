[CmdletBinding()]
param(
  [string]$InputDirectory = (Join-Path (Split-Path -Parent $PSScriptRoot) 'LLoyds'),

  [string]$OutputFile = (Join-Path (Split-Path -Parent $PSScriptRoot) 'transactions-data.js'),

  [string]$PdfToText = 'pdftotext'
)

$resolvedDirectory = (Resolve-Path -LiteralPath $InputDirectory -ErrorAction Stop).Path
$converter = Get-Command $PdfToText -ErrorAction SilentlyContinue
if (-not $converter) {
  throw 'pdftotext was not found. Install Poppler or pass its executable path with -PdfToText.'
}

$monthNumbers = @{
  January = 1; February = 2; March = 3; April = 4; May = 5; June = 6
  July = 7; August = 8; September = 9; October = 10; November = 11; December = 12
}
$monthNames = @{
  Jan = 'January'; Feb = 'February'; Mar = 'March'; Apr = 'April'; May = 'May'; Jun = 'June'
  Jul = 'July'; Aug = 'August'; Sep = 'September'; Oct = 'October'; Nov = 'November'; Dec = 'December'
}
$outgoingTypes = @('DD', 'DEB', 'FPO')
$transactions = [System.Collections.Generic.List[object]]::new()
$validation = [System.Collections.Generic.List[object]]::new()

$statementFiles = Get-ChildItem -LiteralPath $resolvedDirectory -Filter '*.pdf' -File | ForEach-Object {
  if ($_.BaseName -notmatch '^(?<year>20\d{2})_(?<month>[A-Za-z]+)_Statement$') {
    throw "Lloyds statement filename '$($_.Name)' must use YYYY_Month_Statement.pdf."
  }
  $monthName = $Matches.month
  if (-not $monthNumbers.ContainsKey($monthName)) {
    throw "Lloyds statement filename '$($_.Name)' contains an unknown month."
  }
  [pscustomobject]@{ File = $_; Year = [int]$Matches.year; Month = $monthName; MonthNumber = $monthNumbers[$monthName] }
} | Sort-Object Year, MonthNumber

if (-not $statementFiles) {
  throw "No Lloyds PDF statements were found in '$resolvedDirectory'."
}

foreach ($statement in $statementFiles) {
  $lines = & $converter.Source -layout -enc UTF-8 $statement.File.FullName -
  if ($LASTEXITCODE -ne 0) {
    throw "pdftotext could not read '$($statement.File.FullName)'."
  }

  $statementTransactions = [System.Collections.Generic.List[object]]::new()
  foreach ($line in $lines) {
    if ($line -notmatch '^\s*\d{2}\s+[A-Z][a-z]{2}\s+\d{2}\s+') { continue }

    $parts = @($line.Trim() -split '\s{2,}')
    if ($parts.Count -lt 4) {
      throw "Could not split a transaction row in '$($statement.File.Name)': $line"
    }

    $date = $parts[0]
    if ($date -notmatch '^(?<day>\d{2})\s+(?<month>[A-Z][a-z]{2})\s+(?<shortYear>\d{2})$') {
      throw "Could not parse transaction date '$date' in '$($statement.File.Name)'."
    }
    $shortMonth = $Matches.month
    $rowMonth = $monthNames[$shortMonth]
    if (-not $rowMonth) {
      throw "Unknown transaction month '$shortMonth' in '$($statement.File.Name)'."
    }

    if ($parts.Count -eq 4) {
      $description = $parts[1].Trim()
      $type = 'RETURNED'
      $direction = 'in'
    } else {
      $descriptionParts = @($parts[1..($parts.Count - 4)])
      $description = ($descriptionParts -join ' ').Trim()
      $type = $parts[-3].Trim()
      if ($type -eq 'FPI') {
        $direction = 'in'
      } elseif ($outgoingTypes -contains $type) {
        $direction = 'out'
      } else {
        throw "Unknown Lloyds transaction type '$type' in '$($statement.File.Name)'."
      }
    }

    $amountText = $parts[-2] -replace ',', ''
    $amount = [decimal]::Parse($amountText, [Globalization.CultureInfo]::InvariantCulture)
    $transaction = [pscustomobject][ordered]@{
      bank = 'Lloyds'
      month = $rowMonth
      date = $date
      description = $description
      type = $type
      direction = $direction
      amount = $amount
      year = $statement.Year
    }
    $statementTransactions.Add($transaction)
    $transactions.Add($transaction)
  }

  $summaryInLine = $lines | Where-Object { $_ -match '^\s*Money In\s+.*?\p{Sc}[\d,]+\.\d{2}' } | Select-Object -First 1
  $summaryOutLine = $lines | Where-Object { $_ -match '^\s*Money Out\s+.*?\p{Sc}[\d,]+\.\d{2}' } | Select-Object -First 1
  if (-not $summaryInLine -or -not $summaryOutLine) {
    throw "Could not read summary totals from '$($statement.File.Name)'."
  }

  $null = $summaryInLine -match '^\s*Money In\s+.*?\p{Sc}(?<total>[\d,]+\.\d{2})'
  $expectedIn = [decimal]::Parse(($Matches.total -replace ',', ''), [Globalization.CultureInfo]::InvariantCulture)
  $null = $summaryOutLine -match '^\s*Money Out\s+.*?\p{Sc}(?<total>[\d,]+\.\d{2})'
  $expectedOut = [decimal]::Parse(($Matches.total -replace ',', ''), [Globalization.CultureInfo]::InvariantCulture)
  $actualIn = [decimal](($statementTransactions | Where-Object direction -eq 'in' | Measure-Object amount -Sum).Sum)
  $actualOut = [decimal](($statementTransactions | Where-Object direction -eq 'out' | Measure-Object amount -Sum).Sum)

  if ($actualIn -ne $expectedIn -or $actualOut -ne $expectedOut) {
    throw "Totals do not match '$($statement.File.Name)': parsed in $actualIn/out $actualOut; PDF in $expectedIn/out $expectedOut."
  }

  $validation.Add([pscustomobject]@{
    Statement = $statement.File.Name
    Rows = $statementTransactions.Count
    MoneyIn = $actualIn
    MoneyOut = $actualOut
  })
}

$outputPath = [IO.Path]::GetFullPath($OutputFile)
$outputDirectory = Split-Path -Parent $outputPath
if (-not (Test-Path -LiteralPath $outputDirectory)) {
  New-Item -ItemType Directory -Path $outputDirectory | Out-Null
}

$json = $transactions | ConvertTo-Json -Compress -Depth 4
[IO.File]::WriteAllText($outputPath, "window.transactionData = $json;`n", [Text.UTF8Encoding]::new($false))
$validation | Format-Table -AutoSize
Write-Output "Parsed and validated $($transactions.Count) Lloyds transactions."
