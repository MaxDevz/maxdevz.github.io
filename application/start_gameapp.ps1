# Start GameApp.py using the local virtual environment in application\env
$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
Set-Location $scriptDir

if (-not (Test-Path ".\env\Scripts\python.exe")) {
    Write-Host "Virtual environment not found. Creating one now..."
    python -m venv env
    if ($LASTEXITCODE -ne 0) {
        Write-Error "Failed to create virtual environment. Please install Python first."
        exit 1
    }
    . .\env\Scripts\Activate.ps1
    Write-Host "Installing Flask..."
    pip install flask
} else {
    . .\env\Scripts\Activate.ps1
}
python GameApp.py
Read-Host -Prompt "Press Enter to close"
