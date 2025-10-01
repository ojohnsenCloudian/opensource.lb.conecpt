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
import { Plus, Trash2, Network } from 'lucide-react';

export default function VipsPage() {
  const [vips, setVips] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [formData, setFormData] = useState({
    ipAddress: '',
    interface: 'eth0',
    description: '',
  });

  useEffect(() => {
    fetchVips();
  }, []);

  const fetchVips = async () => {
    try {
      const response = await api.get('/vip');
      setVips(response.data);
    } catch (error) {
      console.error('Failed to fetch VIPs:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await api.post('/vip', formData);
      setDialogOpen(false);
      setFormData({ ipAddress: '', interface: 'eth0', description: '' });
      fetchVips();
    } catch (error: any) {
      alert(error.response?.data?.error || 'Failed to create VIP');
    }
  };

  const handleDelete = async (id: string, ipAddress: string) => {
    if (!confirm(`Are you sure you want to delete VIP "${ipAddress}"?`)) return;

    try {
      await api.delete(`/vip/${id}`);
      fetchVips();
    } catch (error: any) {
      alert(error.response?.data?.error || 'Failed to delete VIP');
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
                <CardTitle>Virtual IP Addresses</CardTitle>
                <CardDescription>Manage virtual IPs for load balancer endpoints</CardDescription>
              </div>
              <Button onClick={() => setDialogOpen(true)}>
                <Plus className="h-4 w-4 mr-2" />
                Add VIP
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            {vips.length === 0 ? (
              <div className="text-center py-8">
                <Network className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                <p className="text-muted-foreground mb-4">No VIPs configured</p>
                <Button onClick={() => setDialogOpen(true)}>Add Your First VIP</Button>
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>IP Address</TableHead>
                    <TableHead>Interface</TableHead>
                    <TableHead>Description</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Load Balancers</TableHead>
                    <TableHead>Created</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {vips.map((vip) => (
                    <TableRow key={vip.id}>
                      <TableCell className="font-medium font-mono">{vip.ipAddress}</TableCell>
                      <TableCell>{vip.interface}</TableCell>
                      <TableCell>{vip.description || '-'}</TableCell>
                      <TableCell>
                        {vip.active ? (
                          <Badge variant="success">Active</Badge>
                        ) : (
                          <Badge variant="secondary">Inactive</Badge>
                        )}
                      </TableCell>
                      <TableCell>{vip._count?.loadBalancers || 0} LBs</TableCell>
                      <TableCell>{new Date(vip.createdAt).toLocaleDateString()}</TableCell>
                      <TableCell className="text-right">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleDelete(vip.id, vip.ipAddress)}
                          disabled={vip._count?.loadBalancers > 0}
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

        <Card className="mt-6">
          <CardHeader>
            <CardTitle>About Virtual IPs</CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground space-y-2">
            <p>
              Virtual IP addresses (VIPs) allow you to bind multiple load balancers to the same IP
              address using different ports.
            </p>
            <p>
              <strong>Example:</strong> VIP 10.0.0.100 can handle:
            </p>
            <ul className="list-disc list-inside ml-4 space-y-1">
              <li>HTTPS traffic on port 443 (S3 API)</li>
              <li>HTTP traffic on port 8084 (Admin API)</li>
              <li>HTTPS traffic on port 9443 (Management Console)</li>
            </ul>
            <p className="mt-2">
              <strong>Note:</strong> VIP management requires root privileges. If activation fails,
              check systemd logs.
            </p>
          </CardContent>
        </Card>
      </div>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <form onSubmit={handleSubmit}>
            <DialogHeader>
              <DialogTitle>Add Virtual IP</DialogTitle>
              <DialogDescription>Configure a new virtual IP address</DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="ipAddress">IP Address *</Label>
                <Input
                  id="ipAddress"
                  value={formData.ipAddress}
                  onChange={(e) => setFormData({ ...formData, ipAddress: e.target.value })}
                  placeholder="10.0.0.100"
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="interface">Network Interface</Label>
                <Input
                  id="interface"
                  value={formData.interface}
                  onChange={(e) => setFormData({ ...formData, interface: e.target.value })}
                  placeholder="eth0"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="description">Description</Label>
                <Input
                  id="description"
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  placeholder="Primary VIP for Cloudian services"
                />
              </div>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>
                Cancel
              </Button>
              <Button type="submit">Add VIP</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}

