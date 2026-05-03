# Schakel GitHub Pages in: branch main, map / (root).
# Vereist: Personal Access Token met repo-rechten (classic: scope "repo";
# fine-grained: Contents Read, Administration of "Pages" write indien beschikbaar).
#
# Gebruik (PowerShell):
#   $env:GITHUB_TOKEN = "ghp_xxxxxxxx"   # of fine-grained token
#   .\scripts\enable-github-pages.ps1

$ErrorActionPreference = "Stop"
$Owner = "naomibuuren010"
$Repo = "Vacation-Planner"
$Uri = "https://api.github.com/repos/$Owner/$Repo/pages"

$Token = $env:GITHUB_TOKEN
if (-not $Token) {
  Write-Host "Zet eerst je token, bijvoorbeeld:" -ForegroundColor Yellow
  Write-Host '  $env:GITHUB_TOKEN = "ghp_..."' -ForegroundColor Yellow
  Write-Host "Token aanmaken: https://github.com/settings/tokens (classic: vink 'repo' aan)" -ForegroundColor Yellow
  exit 1
}

$Headers = @{
  Authorization        = "Bearer $Token"
  Accept               = "application/vnd.github+json"
  "X-GitHub-Api-Version" = "2022-11-28"
}

$BodyObj = @{
  build_type = "legacy"
  source     = @{
    branch = "main"
    path   = "/"
  }
}
$Body = $BodyObj | ConvertTo-Json -Depth 5 -Compress

try {
  $result = Invoke-RestMethod -Uri $Uri -Method Post -Headers $Headers -Body $Body -ContentType "application/json"
  Write-Host "GitHub Pages aangemaakt." -ForegroundColor Green
  $result | ConvertTo-Json -Depth 5
} catch {
  $code = $null
  if ($_.Exception.Response) { $code = [int]$_.Exception.Response.StatusCode }
  if ($code -eq 409) {
    Write-Host "Pages bestond al; bijwerken naar main / ..." -ForegroundColor Cyan
    Invoke-RestMethod -Uri $Uri -Method Put -Headers $Headers -Body $Body -ContentType "application/json" | Out-Null
    Write-Host "Bijgewerkt. Controleer op GitHub: Settings -> Pages" -ForegroundColor Green
  } else {
    Write-Host "Fout ($code): $($_.Exception.Message)" -ForegroundColor Red
    if ($_.ErrorDetails.Message) { Write-Host $_.ErrorDetails.Message }
    exit 1
  }
}

Write-Host ""
Write-Host "Na een minuut: https://$Owner.github.io/$Repo/" -ForegroundColor Green
