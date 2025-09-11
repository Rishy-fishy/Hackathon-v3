# Deploy backend updates to Google Cloud
Write-Host "🚀 Deploying backend updates to Google Cloud..." -ForegroundColor Green

# Set project
gcloud config set project hackathon-v3-docker

# Copy the updated backend files to the VM
Write-Host "📤 Copying backend files to VM..." -ForegroundColor Blue
gcloud compute scp --recurse backend/src hackathon-v3-vm:~/navbar-app/backend/ --zone=us-central1-a
gcloud compute scp backend/package.json hackathon-v3-vm:~/navbar-app/backend/ --zone=us-central1-a
gcloud compute scp backend/mongo-uri.txt hackathon-v3-vm:~/navbar-app/backend/ --zone=us-central1-a

# SSH into the VM and restart the backend service
Write-Host "🔄 Restarting backend service..." -ForegroundColor Blue
gcloud compute ssh hackathon-v3-vm --zone=us-central1-a --command="
cd ~/navbar-app/backend && 
echo 'Current directory:' && pwd &&
echo 'Installing dependencies...' &&
npm install &&
echo 'Stopping existing backend processes...' &&
pkill -f 'node.*server.js' || true &&
pkill -f 'npm.*start' || true &&
sleep 2 &&
echo 'Starting backend in background...' &&
nohup npm start > backend.log 2>&1 &
echo 'Backend started. Checking if it is running...' &&
sleep 5 &&
curl -f http://localhost:8080/health || echo 'Health check failed' &&
echo 'Backend deployment complete!'
"

Write-Host "✅ Backend deployment completed!" -ForegroundColor Green
Write-Host "🌐 Backend should be accessible at: http://34.58.198.143:8080" -ForegroundColor Cyan