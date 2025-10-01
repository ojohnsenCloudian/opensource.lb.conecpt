#!/bin/bash

echo "========================================="
echo "Load Balancer Application Status Check"
echo "========================================="
echo ""

# Check if services exist
echo "Checking systemd services..."
for service in lb-api lb-engine lb-healthcheck lb-frontend; do
  if systemctl list-unit-files | grep -q "$service.service"; then
    echo "✓ $service.service found"
  else
    echo "✗ $service.service NOT FOUND"
  fi
done

echo ""
echo "Service Status:"
echo "---------------"
systemctl is-active lb-api.service &>/dev/null && echo "✓ lb-api: RUNNING" || echo "✗ lb-api: NOT RUNNING"
systemctl is-active lb-engine.service &>/dev/null && echo "✓ lb-engine: RUNNING" || echo "✗ lb-engine: NOT RUNNING"
systemctl is-active lb-healthcheck.service &>/dev/null && echo "✓ lb-healthcheck: RUNNING" || echo "✗ lb-healthcheck: NOT RUNNING"
systemctl is-active lb-frontend.service &>/dev/null && echo "✓ lb-frontend: RUNNING" || echo "✗ lb-frontend: NOT RUNNING"

echo ""
echo "Port Status:"
echo "------------"
netstat -tlnp 2>/dev/null | grep -E ':(3000|4000)' || ss -tlnp | grep -E ':(3000|4000)' || echo "No listeners found"

echo ""
echo "API Health Check:"
echo "-----------------"
curl -s http://localhost:4000/health 2>/dev/null && echo "" || echo "✗ API not responding"

echo ""
echo "Recent Logs (last 5 lines per service):"
echo "----------------------------------------"
echo "=== lb-api ==="
journalctl -u lb-api -n 5 --no-pager 2>/dev/null || echo "No logs"
echo ""
echo "=== lb-engine ==="
journalctl -u lb-engine -n 5 --no-pager 2>/dev/null || echo "No logs"
echo ""
echo "=== lb-healthcheck ==="
journalctl -u lb-healthcheck -n 5 --no-pager 2>/dev/null || echo "No logs"
echo ""
echo "=== lb-frontend ==="
journalctl -u lb-frontend -n 5 --no-pager 2>/dev/null || echo "No logs"

echo ""
echo "Quick Actions:"
echo "--------------"
echo "  View all logs:     journalctl -u 'lb-*' -f"
echo "  Restart services:  systemctl restart lb-api lb-engine lb-healthcheck lb-frontend"
echo "  Stop services:     systemctl stop lb-api lb-engine lb-healthcheck lb-frontend"
echo ""
echo "Access Web UI:"
echo "  http://$(hostname -I | awk '{print $1}'):3000"
echo "  Username: admin"
echo "  Password: admin123"
echo ""

