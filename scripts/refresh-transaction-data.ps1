[CmdletBinding()]
param(
  [string]$LloydsDirectory = (Join-Path (Split-Path -Parent $PSScriptRoot) 'LLoyds'),

  [string]$NatwestPdf = (Join-Path (Split-Path -Parent $PSScriptRoot) 'Natwest\Natwest Bank Statement.pdf'),

  [string]$PdfToText = 'pdftotext'
)

$lloydsParser = Join-Path $PSScriptRoot 'parse-lloyds-statements.ps1'
$natwestParser = Join-Path $PSScriptRoot 'parse-natwest-statement.ps1'

& $lloydsParser -InputDirectory $LloydsDirectory -PdfToText $PdfToText
if (-not $?) { throw 'Lloyds transaction extraction failed.' }

& $natwestParser -InputPdf $NatwestPdf -PdfToText $PdfToText
if (-not $?) { throw 'NatWest transaction extraction failed.' }

Write-Output 'Both transaction datasets were refreshed successfully.'
