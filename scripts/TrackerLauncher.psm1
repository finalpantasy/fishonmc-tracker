function Get-TrackerPathFingerprint {
    param([Parameter(Mandatory)][string]$Path)
    $canonical = [IO.Path]::GetFullPath($Path).Replace('/', '\').TrimEnd('\').ToLowerInvariant()
    $sha = [Security.Cryptography.SHA256]::Create()
    try { return ([BitConverter]::ToString($sha.ComputeHash([Text.Encoding]::UTF8.GetBytes($canonical))).Replace('-', '').ToLowerInvariant().Substring(0, 16)) }
    finally { $sha.Dispose() }
}

function Get-TrackerPortCandidates {
    param([int]$PreferredPort = 45831)
    if ($PreferredPort -lt 45831 -or $PreferredPort -gt 45839) { throw 'Preferred port must be between 45831 and 45839.' }
    return @($PreferredPort..45839) + @(45831..($PreferredPort - 1))
}

Export-ModuleMember -Function Get-TrackerPathFingerprint, Get-TrackerPortCandidates
