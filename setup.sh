#!/bin/bash

# MediaPipe Pose Demo - Quick Setup Script
# This script helps set up the development environment

set -e

echo "🎯 MediaPipe Pose Demo - Quick Setup"
echo "====================================="

# Check Node.js version
echo "📋 Checking Node.js version..."
if ! command -v node &> /dev/null; then
    echo "❌ Node.js is not installed. Please install Node.js 18 or higher."
    exit 1
fi

NODE_VERSION=$(node -v | cut -c2-)
MAJOR_VERSION=$(echo $NODE_VERSION | cut -d. -f1)

if [ "$MAJOR_VERSION" -lt "18" ]; then
    echo "❌ Node.js version $NODE_VERSION is too old. Please install Node.js 18 or higher."
    exit 1
fi

echo "✅ Node.js version $NODE_VERSION is compatible"

# Check npm version
echo "📋 Checking npm version..."
if ! command -v npm &> /dev/null; then
    echo "❌ npm is not installed. Please install npm."
    exit 1
fi

NPM_VERSION=$(npm -v)
echo "✅ npm version $NPM_VERSION"

# Install dependencies
echo "📦 Installing dependencies..."
npm install

if [ $? -ne 0 ]; then
    echo "❌ Failed to install dependencies"
    exit 1
fi

echo "✅ Dependencies installed successfully"

# Setup environment file
echo "⚙️  Setting up environment file..."
if [ ! -f ".env.local" ]; then
    cp .env.example .env.local
    echo "✅ Created .env.local from template"
    echo "📝 Please edit .env.local with your configuration"
else
    echo "ℹ️  .env.local already exists"
fi

# Test build
echo "🔧 Testing build..."
npm run build

if [ $? -ne 0 ]; then
    echo "❌ Build failed"
    exit 1
fi

echo "✅ Build successful"

# Clean up build files for development
rm -rf .next

echo ""
echo "🎉 Setup complete!"
echo ""
echo "Next steps:"
echo "1. Edit .env.local with your configuration"
echo "2. Run 'npm run dev' to start development server"
echo "3. Open http://localhost:3000 in your browser"
echo ""
echo "For deployment instructions, see DEPLOYMENT.md"
echo ""
echo "📚 Documentation:"
echo "   - README.md: Project overview and quick start"
echo "   - DEPLOYMENT.md: Comprehensive deployment guide"
echo "   - .env.example: Environment variables template"
echo ""