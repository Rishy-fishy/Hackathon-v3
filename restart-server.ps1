# PowerShell script to restart the backend server on GCloud VM
Write-Host "Copying updated server file..."
gcloud compute scp current-server.js hackathon-backend-v2:current-server.js --zone=us-central1-a

Write-Host "Restarting server..."
gcloud compute ssh hackathon-backend-v2 --zone=us-central1-a --command="pkill -f node || echo 'No node process found'"
Start-Sleep -Seconds 2
gcloud compute ssh hackathon-backend-v2 --zone=us-central1-a --command="nohup node current-server.js > server.log 2>&1 &"
Start-Sleep -Seconds 5

Write-Host "Checking server status..."
try {
    $response = Invoke-WebRequest -Uri "http://35.194.34.36:8080/health" -TimeoutSec 10
    Write-Host "Server is running: $($response.StatusCode)"
} catch {
    Write-Host "Server check failed: $($_.Exception.Message)"
}

Write-Host "Server restart complete!"