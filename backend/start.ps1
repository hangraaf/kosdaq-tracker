Set-Location $PSScriptRoot
python -m uvicorn main:app --reload --port 8000
