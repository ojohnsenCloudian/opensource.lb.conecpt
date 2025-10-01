'use client';

import { useEffect, useState } from 'react';
import api from '@/lib/api';
import { Navbar } from '@/components/layout/navbar';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Activity, Cpu, HardDrive, Network as NetworkIcon, Server } from 'lucide-react';

export default function MonitoringPage() {
  const [systemMetrics, setSystemMetrics] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchMetrics();
    const interval = setInterval(fetchMetrics, 5000); // Refresh every 5 seconds
    return () => clearInterval(interval);
  }, []);

  const fetchMetrics = async () => {
    try {
      const response = await api.get('/monitoring/system');
      setSystemMetrics(response.data);
    } catch (error) {
      console.error('Failed to fetch metrics:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background">
        <Navbar />
        <div className="flex items-center justify-center h-96">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
        </div>
      </div>
    );
  }

  const getUsageColor = (usage: number) => {
    if (usage > 80) return 'text-red-500';
    if (usage > 60) return 'text-yellow-500';
    return 'text-green-500';
  };

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <div className="container mx-auto px-4 py-8">
        <div className="mb-6">
          <h1 className="text-3xl font-bold">System Monitoring</h1>
          <p className="text-muted-foreground mt-1">Real-time system performance metrics</p>
        </div>

        {/* System Metrics */}
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4 mb-6">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">CPU Usage</CardTitle>
              <Cpu className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className={`text-2xl font-bold ${getUsageColor(systemMetrics?.cpu?.usage || 0)}`}>
                {systemMetrics?.cpu?.usage?.toFixed(1)}%
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                {systemMetrics?.cpu?.cores} cores
              </p>
              <div className="mt-2 h-2 bg-secondary rounded-full overflow-hidden">
                <div
                  className="h-full bg-primary transition-all"
                  style={{ width: `${systemMetrics?.cpu?.usage || 0}%` }}
                />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Memory Usage</CardTitle>
              <Server className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className={`text-2xl font-bold ${getUsageColor(systemMetrics?.memory?.usagePercent || 0)}`}>
                {systemMetrics?.memory?.usagePercent?.toFixed(1)}%
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                {systemMetrics?.memory?.used} MB / {systemMetrics?.memory?.total} MB
              </p>
              <div className="mt-2 h-2 bg-secondary rounded-full overflow-hidden">
                <div
                  className="h-full bg-primary transition-all"
                  style={{ width: `${systemMetrics?.memory?.usagePercent || 0}%` }}
                />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Disk Usage</CardTitle>
              <HardDrive className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className={`text-2xl font-bold ${getUsageColor(systemMetrics?.disk?.[0]?.usagePercent || 0)}`}>
                {systemMetrics?.disk?.[0]?.usagePercent?.toFixed(1)}%
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                {systemMetrics?.disk?.[0]?.used} GB / {systemMetrics?.disk?.[0]?.size} GB
              </p>
              <div className="mt-2 h-2 bg-secondary rounded-full overflow-hidden">
                <div
                  className="h-full bg-primary transition-all"
                  style={{ width: `${systemMetrics?.disk?.[0]?.usagePercent || 0}%` }}
                />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Network</CardTitle>
              <NetworkIcon className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {((systemMetrics?.network?.[0]?.rx_sec || 0) / 1024 / 1024).toFixed(2)} MB/s
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                ↓ RX / ↑ TX: {((systemMetrics?.network?.[0]?.tx_sec || 0) / 1024 / 1024).toFixed(2)} MB/s
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Disk Details */}
        {systemMetrics?.disk && systemMetrics.disk.length > 0 && (
          <Card className="mb-6">
            <CardHeader>
              <CardTitle>Disk Partitions</CardTitle>
              <CardDescription>Detailed disk usage information</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {systemMetrics.disk.map((disk: any, index: number) => (
                  <div key={index} className="border rounded-lg p-4">
                    <div className="flex items-center justify-between mb-2">
                      <div>
                        <p className="font-medium">{disk.mount}</p>
                        <p className="text-sm text-muted-foreground">
                          {disk.fs} ({disk.type})
                        </p>
                      </div>
                      <Badge variant={disk.usagePercent > 80 ? 'destructive' : 'secondary'}>
                        {disk.usagePercent.toFixed(1)}%
                      </Badge>
                    </div>
                    <div className="h-2 bg-secondary rounded-full overflow-hidden">
                      <div
                        className="h-full bg-primary transition-all"
                        style={{ width: `${disk.usagePercent}%` }}
                      />
                    </div>
                    <p className="text-xs text-muted-foreground mt-2">
                      {disk.used} GB used of {disk.size} GB ({disk.available} GB available)
                    </p>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Network Interfaces */}
        {systemMetrics?.network && systemMetrics.network.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle>Network Interfaces</CardTitle>
              <CardDescription>Active network interface statistics</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {systemMetrics.network
                  .filter((net: any) => net.operstate === 'up')
                  .map((net: any, index: number) => (
                    <div key={index} className="border rounded-lg p-4">
                      <div className="flex items-center justify-between mb-2">
                        <p className="font-medium">{net.iface}</p>
                        <Badge variant="success">{net.operstate}</Badge>
                      </div>
                      <div className="grid grid-cols-2 gap-4 text-sm">
                        <div>
                          <p className="text-muted-foreground">Received</p>
                          <p className="font-medium">
                            {(net.rx_bytes / 1024 / 1024 / 1024).toFixed(2)} GB
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {(net.rx_sec / 1024 / 1024).toFixed(2)} MB/s
                          </p>
                        </div>
                        <div>
                          <p className="text-muted-foreground">Transmitted</p>
                          <p className="font-medium">
                            {(net.tx_bytes / 1024 / 1024 / 1024).toFixed(2)} GB
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {(net.tx_sec / 1024 / 1024).toFixed(2)} MB/s
                          </p>
                        </div>
                      </div>
                    </div>
                  ))}
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}

