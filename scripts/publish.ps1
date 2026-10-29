[CmdletBinding()]
param(
    [string]$Repository = 'rinbarpen/github-repo-finder',
    [switch]$DryRun
)

$ErrorActionPreference = 'Stop'
if ($Repository -notmatch '^[a-zA-Z0-9_.-]+/[a-zA-Z0-9_.-]+$') {
    throw 'Repository must be owner/name.'
}

function Invoke-Checked {
    param([string]$Program, [string[]]$Arguments)
    & $Program @Arguments
    if ($LASTEXITCODE -ne 0) {
        throw "$Program failed with exit code $LASTEXITCODE. You can rerun this script after fixing the error."
    }
}

function Get-OptionalResult {
    param([string]$Program, [string[]]$Arguments)
    $queryErrorPreference = $ErrorActionPreference
    try {
        # Missing remotes, repositories and Pages sites are expected on a first run.
        $ErrorActionPreference = 'Continue'
        $output = & $Program @Arguments 2>$null
        return [PSCustomObject]@{ ExitCode = $LASTEXITCODE; Output = $output }
    } finally {
        $ErrorActionPreference = $queryErrorPreference
    }
}

$projectRoot = Split-Path -Parent $PSScriptRoot
$previousProxy = $env:HTTPS_PROXY
$previousGhHost = $env:GH_HOST
Push-Location -LiteralPath $projectRoot
try {
    foreach ($branch in @('main', 'dev')) {
        & git show-ref --verify --quiet "refs/heads/$branch"
        if ($LASTEXITCODE -ne 0) { throw "Local branch $branch is missing." }
    }
    $changes = & git status --porcelain
    if ($LASTEXITCODE -ne 0) { throw 'Cannot inspect the local Git repository.' }
    if ($changes) { throw 'Commit local changes before publishing so the reviewed commit is what gets uploaded.' }

    $remoteUrl = "https://github.com/$Repository.git"
    $owner = $Repository.Split('/')[0]
    $name = $Repository.Split('/')[1]
    $pagesUrl = if ($name -ieq "$owner.github.io") { "https://$owner.github.io/" } else { "https://$owner.github.io/$name/" }

    $originResult = Get-OptionalResult 'git' @('remote', 'get-url', 'origin')
    $origin = if ($originResult.ExitCode -eq 0) { [string]$originResult.Output } else { $null }
    if ($origin -and $origin.TrimEnd('/') -ine $remoteUrl -and $origin.TrimEnd('/') -ine "https://github.com/$Repository") {
        throw 'Origin points to a different repository. It will not be changed automatically.'
    }

    if ($DryRun) {
        Write-Output "Plan: create public repository $Repository if it does not exist."
        Write-Output 'Plan: push main and dev without force, and set main as the default branch.'
        Write-Output 'Plan: configure GitHub Pages to use GitHub Actions.'
        Write-Output 'Plan: the main workflow generates and maintains the knowledge branch.'
        Write-Output 'Plan: ensure a matching main workflow run exists after the push.'
        Write-Output "Pages target: $pagesUrl"
        return
    }

    $env:GH_HOST = 'github.com'
    if (-not $env:HTTPS_PROXY) {
        $configuredProxy = & git config --get https.proxy
        if (-not $configuredProxy) { $configuredProxy = & git config --get http.proxy }
        if ($configuredProxy) { $env:HTTPS_PROXY = $configuredProxy.Trim() }
    }
    Invoke-Checked 'gh' @('auth', 'status', '--hostname', 'github.com')

    $repositoryResult = Get-OptionalResult 'gh' @('repo', 'view', $Repository, '--json', 'nameWithOwner', '--jq', '.nameWithOwner')
    if ($repositoryResult.ExitCode -ne 0) {
        Invoke-Checked 'gh' @('repo', 'create', $Repository, '--public', '--disable-wiki', '--description', 'Curated agent repositories, source learning guides, reading notes and trending.', '--homepage', $pagesUrl)
    }

    if (-not $origin) { Invoke-Checked 'git' @('remote', 'add', 'origin', $remoteUrl) }

    # Use the existing gh login for this push without changing global Git credentials.
    Invoke-Checked 'git' @('-c', 'credential.https://github.com.helper=', '-c', 'credential.https://github.com.helper=!gh auth git-credential', 'push', '--set-upstream', 'origin', 'main', 'dev')
    Invoke-Checked 'gh' @('repo', 'edit', $Repository, '--default-branch', 'main', '--homepage', $pagesUrl)

    $pagesResult = Get-OptionalResult 'gh' @('api', "repos/$Repository/pages", '--jq', '.build_type')
    if ($pagesResult.ExitCode -ne 0) {
        Invoke-Checked 'gh' @('api', '--method', 'POST', "repos/$Repository/pages", '-f', 'build_type=workflow', '--silent')
    } elseif ($pagesResult.Output -ne 'workflow') {
        Invoke-Checked 'gh' @('api', '--method', 'PUT', "repos/$Repository/pages", '-f', 'build_type=workflow', '--silent')
    }

    # Some initial pushes do not produce a run immediately. Ensure publication
    # has a run without duplicating a successful or currently running one.
    $mainCommitResult = Get-OptionalResult 'git' @('rev-parse', 'main')
    if ($mainCommitResult.ExitCode -ne 0) { throw 'Cannot resolve the main commit.' }
    $mainCommit = ([string]$mainCommitResult.Output).Trim()
    $runsEndpoint = "repos/$Repository/actions/workflows/refresh-and-deploy.yml/runs?branch=main&head_sha=$mainCommit&per_page=10"
    $runResult = Get-OptionalResult 'gh' @('api', $runsEndpoint, '--jq', '[.workflow_runs[] | select(.conclusion == null or .conclusion == "success")] | length')
    if ($runResult.ExitCode -ne 0 -or [int]$runResult.Output -eq 0) {
        Invoke-Checked 'gh' @('workflow', 'run', 'refresh-and-deploy.yml', '--repo', $Repository, '--ref', 'main')
    }

    Write-Output "Repository: https://github.com/$Repository"
    Write-Output "Actions: https://github.com/$Repository/actions"
    Write-Output "Pages target (available after deployment succeeds): $pagesUrl"
} finally {
    $env:HTTPS_PROXY = $previousProxy
    $env:GH_HOST = $previousGhHost
    Pop-Location
}
