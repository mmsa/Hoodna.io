#!/bin/bash

# eljiran.com Full Stack Startup Script
# This script starts the entire application stack using Docker Compose

set -e

echo "🚀 Starting eljiran.com Full Stack..."
echo ""

# Check if Docker is running
if ! docker info > /dev/null 2>&1; then
    echo "❌ Docker is not running. Please start Docker Desktop and try again."
    exit 1
fi

# Check if .env file exists
if [ ! -f .env ]; then
    echo "⚠️  No .env file found. Creating from .env.example..."
    if [ -f backend/.env.example ]; then
        cp backend/.env.example .env
        echo "✅ Created .env file. Please update it with your configuration."
    else
        echo "⚠️  No .env.example found. You may need to create .env manually."
    fi
fi

# Navigate to project root
cd "$(dirname "$0")/.."

echo "📦 Building and starting Docker containers..."
docker-compose up --build -d

echo ""
echo "⏳ Waiting for services to be ready..."
sleep 5

# Wait for PostgreSQL to be ready
echo "🔍 Checking PostgreSQL connection..."
until docker-compose exec -T postgres pg_isready -U hoodna > /dev/null 2>&1; do
    echo "   Waiting for PostgreSQL..."
    sleep 2
done
echo "✅ PostgreSQL is ready!"

# Wait for backend to be ready
echo "🔍 Checking backend API..."
until curl -s http://localhost:8000/health > /dev/null 2>&1; do
    echo "   Waiting for backend..."
    sleep 2
done
echo "✅ Backend is ready!"

echo ""
echo "🎉 eljiran.com is running!"
echo ""
echo "📍 Services:"
echo "   Frontend:  http://localhost:3000"
echo "   Backend:   http://localhost:8000"
echo "   API Docs:  http://localhost:8000/docs"
echo "   Database:  localhost:5434"
echo ""
echo "👤 Default Admin Credentials:"
echo "   Email:    admin@eljiran.com"
echo "   Password: admin123"
echo ""
echo "📝 Useful commands:"
echo "   View logs:        docker-compose logs -f"
echo "   Stop services:    docker-compose down"
echo "   Restart:          docker-compose restart"
echo ""
echo "Press Ctrl+C to stop all services (or run: docker-compose down)"
