#!/bin/bash

# Development startup script for eljiran.com
# Starts backend, frontend, and mobile in separate terminals

set -e

echo "🚀 Starting eljiran.com Development Environment"
echo ""

# Colors for output
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Check if we're in the right directory
if [ ! -f "docker-compose.yml" ]; then
    echo "❌ Please run this script from the project root directory"
    exit 1
fi

# Function to check if a port is in use
check_port() {
    if lsof -Pi :$1 -sTCP:LISTEN -t >/dev/null 2>&1 ; then
        echo "${YELLOW}⚠️  Port $1 is already in use${NC}"
        return 1
    fi
    return 0
}

# Check ports
echo "🔍 Checking ports..."
check_port 8000 && echo "${GREEN}✅ Port 8000 (backend) is available${NC}" || echo "${YELLOW}⚠️  Port 8000 is in use${NC}"
check_port 3000 && echo "${GREEN}✅ Port 3000 (frontend) is available${NC}" || echo "${YELLOW}⚠️  Port 3000 is in use${NC}"

echo ""
echo "📍 Services will be available at:"
echo "   ${BLUE}Backend:${NC}  http://localhost:8000"
echo "   ${BLUE}Backend Docs:${NC}  http://localhost:8000/docs"
echo "   ${BLUE}Frontend:${NC} http://localhost:3000"
echo "   ${BLUE}Mobile:${NC}   Scan QR code from Expo terminal"
echo ""

# Check if Docker is needed for database
if ! docker info > /dev/null 2>&1; then
    echo "${YELLOW}⚠️  Docker is not running. Starting database with Docker Compose...${NC}"
    echo "   Please start Docker Desktop and run: docker-compose up -d"
    echo ""
fi

# Start backend
echo "${GREEN}🚀 Starting Backend...${NC}"
cd backend
if [ ! -d "venv" ] && [ ! -d ".venv" ]; then
    echo "${YELLOW}⚠️  No virtual environment found. Creating one...${NC}"
    python3 -m venv venv
    source venv/bin/activate
    pip install -r requirements.txt
else
    if [ -d "venv" ]; then
        source venv/bin/activate
    else
        source .venv/bin/activate
    fi
fi

# Start backend in new terminal (macOS)
if [[ "$OSTYPE" == "darwin"* ]]; then
    osascript -e "tell application \"Terminal\" to do script \"cd '$(pwd)' && source venv/bin/activate && uvicorn app.main:app --reload --host 0.0.0.0 --port 8000\""
elif [[ "$OSTYPE" == "linux-gnu"* ]]; then
    gnome-terminal -- bash -c "cd '$(pwd)' && source venv/bin/activate && uvicorn app.main:app --reload --host 0.0.0.0 --port 8000; exec bash"
fi

cd ..

# Start frontend
echo "${GREEN}🚀 Starting Frontend...${NC}"
cd frontend
if [ ! -d "node_modules" ]; then
    echo "${YELLOW}⚠️  Installing frontend dependencies...${NC}"
    npm install
fi

# Start frontend in new terminal
if [[ "$OSTYPE" == "darwin"* ]]; then
    osascript -e "tell application \"Terminal\" to do script \"cd '$(pwd)' && npm run dev\""
elif [[ "$OSTYPE" == "linux-gnu"* ]]; then
    gnome-terminal -- bash -c "cd '$(pwd)' && npm run dev; exec bash"
fi

cd ..

# Start mobile
echo "${GREEN}🚀 Starting Mobile...${NC}"
cd mobile
if [ ! -d "node_modules" ]; then
    echo "${YELLOW}⚠️  Installing mobile dependencies...${NC}"
    npm install
fi

echo ""
echo "${GREEN}✅ All services starting!${NC}"
echo ""
echo "📱 To connect mobile app:"
echo "   1. Make sure your phone and computer are on the same WiFi"
echo "   2. Install Expo Go app on your phone"
echo "   3. Scan the QR code that will appear"
echo ""
echo "Press Ctrl+C to stop mobile server (backend and frontend run in separate terminals)"
echo ""

# Start mobile in current terminal
npx expo start

