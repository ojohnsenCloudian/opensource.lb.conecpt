'use client';

import { useEffect, useState } from 'react';
import api from '@/lib/api';
import { Navbar } from '@/components/layout/navbar';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Plus, Trash2, Activity } from 'lucide-react';

export default function HealthChecksPage() {
  const [healthChecks, setHealthChecks] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    type: 'http',
    path: '/health',
    interval: '10',
    timeout: '5',
    healthyThreshold: '2',
    unhealthyThreshold: '3',
    expectedStatus: '200',
  });

  useEffect(() => {
    fetchHealthChecks();
  }, []);

  const fetchHealthChecks = async () => {
    try {
      const response = await api.get('/health-checks');
      setHealthChecks(response.data);
    } catch (error) {
      console.error('Failed to fetch health checks:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await api.post('/health-checks', {
        ...formData,
        interval: parseInt(formData.interval),
        timeout: parseInt(formData.timeout),
        healthyThreshold: parseInt(formData.healthyThreshold),
        unhealthyThreshold: parseInt(formData.unhealthyThreshold),
        expectedStatus: parseInt(formData.expectedStatus),
      });
      setDialogOpen(false);
      setFormData({
        name: '',
        type: 'http',
        path: '/health',
        interval: '10',
        timeout: '5',
        healthyThreshold: '2',
        unhealthyThreshold: '3',
        expectedStatus: '200',
      });
      fetchHealthChecks();
    } catch (error: any) {
      alert(error.response?.data?.error || 'Failed to create health check');
    }
  };

  const handleDelete = async (id: string, name: string) => {
    if (!confirm(`Are you sure you want to delete "${name}"?`)) return;

    try {
      await api.delete(`/health-checks/${id}`);
      fetchHealthChecks();
    } catch (error: any) {
      alert(error.response?.data?.error || 'Failed to delete health check');
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

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <div className="container mx-auto px-4 py-8">
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle>Health Checks</CardTitle>
                <CardDescription>Configure health check policies for backend servers</CardDescription>
              </div>
              <Button onClick={() => setDialogOpen(true)}>
                <Plus className="h-4 w-4 mr-2" />
                Create Health Check
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            {healthChecks.length === 0 ? (
              <div className="text-center py-8">
                <Activity className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                <p className="text-muted-foreground mb-4">No health checks configured</p>
                <Button onClick={() => setDialogOpen(true)}>Create Your First Health Check</Button>
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Path</TableHead>
                    <TableHead>Interval</TableHead>
                    <TableHead>Timeout</TableHead>
                    <TableHead>Thresholds</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {healthChecks.map((hc) => (
                    <TableRow key={hc.id}>
                      <TableCell className="font-medium">{hc.name}</TableCell>
                      <TableCell>
                        <Badge variant="outline">{hc.type.toUpperCase()}</Badge>
                      </TableCell>
                      <TableCell>
                        <code className="text-sm">{hc.path || '-'}</code>
                      </TableCell>
                      <TableCell>{hc.interval}s</TableCell>
                      <TableCell>{hc.timeout}s</TableCell>
                      <TableCell className="text-sm">
                        {hc.healthyThreshold}/{hc.unhealthyThreshold}
                      </TableCell>
                      <TableCell className="text-right">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleDelete(hc.id, hc.name)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <form onSubmit={handleSubmit}>
            <DialogHeader>
              <DialogTitle>Create Health Check</DialogTitle>
              <DialogDescription>Configure a new health check policy</DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="name">Name *</Label>
                <Input
                  id="name"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="type">Type *</Label>
                <Select
                  value={formData.type}
                  onValueChange={(value) => setFormData({ ...formData, type: value })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="http">HTTP</SelectItem>
                    <SelectItem value="https">HTTPS</SelectItem>
                    <SelectItem value="tcp">TCP</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              {(formData.type === 'http' || formData.type === 'https') && (
                <div className="space-y-2">
                  <Label htmlFor="path">Path</Label>
                  <Input
                    id="path"
                    value={formData.path}
                    onChange={(e) => setFormData({ ...formData, path: e.target.value })}
                    placeholder="/health"
                  />
                </div>
              )}
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="interval">Interval (seconds)</Label>
                  <Input
                    id="interval"
                    type="number"
                    value={formData.interval}
                    onChange={(e) => setFormData({ ...formData, interval: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="timeout">Timeout (seconds)</Label>
                  <Input
                    id="timeout"
                    type="number"
                    value={formData.timeout}
                    onChange={(e) => setFormData({ ...formData, timeout: e.target.value })}
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="healthyThreshold">Healthy Threshold</Label>
                  <Input
                    id="healthyThreshold"
                    type="number"
                    value={formData.healthyThreshold}
                    onChange={(e) =>
                      setFormData({ ...formData, healthyThreshold: e.target.value })
                    }
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="unhealthyThreshold">Unhealthy Threshold</Label>
                  <Input
                    id="unhealthyThreshold"
                    type="number"
                    value={formData.unhealthyThreshold}
                    onChange={(e) =>
                      setFormData({ ...formData, unhealthyThreshold: e.target.value })
                    }
                  />
                </div>
              </div>
              {(formData.type === 'http' || formData.type === 'https') && (
                <div className="space-y-2">
                  <Label htmlFor="expectedStatus">Expected Status Code</Label>
                  <Input
                    id="expectedStatus"
                    type="number"
                    value={formData.expectedStatus}
                    onChange={(e) => setFormData({ ...formData, expectedStatus: e.target.value })}
                  />
                </div>
              )}
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>
                Cancel
              </Button>
              <Button type="submit">Create Health Check</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}

