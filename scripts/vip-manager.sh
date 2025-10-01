#!/bin/bash

# VIP Manager Script
# This script handles VIP activation/deactivation with proper permissions

VIP_IP="$1"
VIP_INTERFACE="$2"
ACTION="$3"

if [ -z "$VIP_IP" ] || [ -z "$VIP_INTERFACE" ] || [ -z "$ACTION" ]; then
  echo "Usage: $0 <IP_ADDRESS> <INTERFACE> <activate|deactivate>"
  echo "Example: $0 192.168.64.5 eth0 activate"
  exit 1
fi

# Function to activate VIP
activate_vip() {
  local ip="$1"
  local iface="$2"
  
  echo "Activating VIP $ip on interface $iface..."
  
  # Check if IP is already assigned
  if ip addr show "$iface" | grep -q "$ip"; then
    echo "IP $ip is already assigned to $iface"
    return 0
  fi
  
  # Add IP address to interface
  if ip addr add "$ip/24" dev "$iface"; then
    echo "✓ VIP $ip activated on $iface"
    
    # Bring interface up if needed
    ip link set "$iface" up
    
    # Verify the IP is active
    if ip addr show "$iface" | grep -q "$ip"; then
      echo "✓ VIP $ip is now active and reachable"
      return 0
    else
      echo "✗ Failed to verify VIP activation"
      return 1
    fi
  else
    echo "✗ Failed to activate VIP $ip on $iface"
    return 1
  fi
}

# Function to deactivate VIP
deactivate_vip() {
  local ip="$1"
  local iface="$2"
  
  echo "Deactivating VIP $ip from interface $iface..."
  
  # Check if IP is assigned
  if ! ip addr show "$iface" | grep -q "$ip"; then
    echo "IP $ip is not assigned to $iface"
    return 0
  fi
  
  # Remove IP address from interface
  if ip addr del "$ip/24" dev "$iface"; then
    echo "✓ VIP $ip deactivated from $iface"
    return 0
  else
    echo "✗ Failed to deactivate VIP $ip from $iface"
    return 1
  fi
}

# Main execution
case "$ACTION" in
  "activate")
    activate_vip "$VIP_IP" "$VIP_INTERFACE"
    ;;
  "deactivate")
    deactivate_vip "$VIP_IP" "$VIP_INTERFACE"
    ;;
  *)
    echo "Invalid action: $ACTION. Use 'activate' or 'deactivate'"
    exit 1
    ;;
esac
