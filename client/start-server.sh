#!/bin/bash
cd /home/root1/projects/physicalBattle/client

# Kill any existing process on port 8888
pkill -f "node server.js" 2>/dev/null || true
lsof -ti :8888 | xargs -r kill -9 2>/dev/null || true

# Wait a moment
sleep 1

# Start the server in background with nohup
nohup node server.js > server.log 2>&1 &
echo $! > server.pid

# Wait and check
sleep 2
if netstat -tuln 2>/dev/null | grep -q :8888 || ss -tuln 2>/dev/null | grep -q :8888; then
    echo "✅ Server started successfully on port 8888"
    echo "📡 Access URLs:"
    echo "   - Local: http://localhost:8888"
    # Try to get IP addresses
    echo "   - Network: $(ip -4 addr show 2>/dev/null | grep -oP '(?<=inet\s)\d+(\.\d+){3}' | grep -v '127.0.0.1' | head -1 | awk '{print "http://" $0 ":8888"}')"
else
    echo "❌ Server failed to start"
    cat server.log
fi