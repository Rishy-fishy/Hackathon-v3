#!/bin/bash

echo "🔄 Restarting backend server..."

# Navigate to backend directory
cd ~/Hackathon-v3/navbar-app/backend

# Kill any existing backend processes
echo "Stopping existing processes..."
pkill -f "npm.*start" || true
pkill -f "node.*server.js" || true
sleep 2

# Install dependencies
echo "Installing dependencies..."
npm install

# Set MongoDB URI from file
export MONGO_URI=$(cat mongo-uri.txt)

# Start backend server
echo "Starting backend server..."
nohup npm start > backend.log 2>&1 &

# Wait and check if it's running
sleep 5

echo "Checking backend health..."
curl -f http://localhost:8080/health || echo "Health check failed"

echo "✅ Backend restart complete!"
echo "📋 Backend log:"
tail -n 10 backend.log