'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import api from '@/lib/api';
import { Navbar } from '@/components/layout/navbar';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Plus, Play, Pause, Trash2, Edit } from 'lucide-react';

export default function LoadBalancersPage() {
  const router = useRouter();
  const [loadBalancers, setLoadBalancers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchLoadBalancers();
  }, []);

  const fetchLoadBalancers = async () => {
    try {
      const response = await api.get('/load-balancers');
      setLoadBalancers(response.data);
    } catch (error) {
      console.error('Failed to fetch load balancers:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleToggle = async (id: string, enabled: boolean) => {
    try {
      const endpoint = enabled ? 'disable' : 'enable';
      await api.post(`/load-balancers/${id}/${endpoint}`);
      fetchLoadBalancers();
    } catch (error) {
      console.error('Failed to toggle load balancer:', error);
      alert('Failed to toggle load balancer');
    }
  };

  const handleDelete = async (id: string, name: string) => {
    if (!confirm(`Are you sure you want to delete "${name}"?`)) return;

    try {
      await api.delete(`/load-balancers/${id}`);
      fetchLoadBalancers();
    } catch (error: any) {
      alert(error.response?.data?.error || 'Failed to delete load balancer');
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
                <CardTitle>Load Balancers</CardTitle>
                <CardDescription>Manage your load balancer configurations</CardDescription>
              </div>
              <Button onClick={() => router.push('/load-balancers/new')}>
                <Plus className="h-4 w-4 mr-2" />
                Create Load Balancer
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            {loadBalancers.length === 0 ? (
              <div className="text-center py-8">
                <p className="text-muted-foreground mb-4">No load balancers configured</p>
                <Button onClick={() => router.push('/load-balancers/new')}>
                  Create Your First Load Balancer
                </Button>
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>Protocol</TableHead>
                    <TableHead>Port</TableHead>
                    <TableHead>Algorithm</TableHead>
                    <TableHead>VIP</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Backend Servers</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {loadBalancers.map((lb) => (
                    <TableRow key={lb.id}>
                      <TableCell className="font-medium">{lb.name}</TableCell>
                      <TableCell>
                        <Badge variant="outline">{lb.protocol.toUpperCase()}</Badge>
                      </TableCell>
                      <TableCell>{lb.listenPort}</TableCell>
                      <TableCell>{lb.algorithm}</TableCell>
                      <TableCell>{lb.vip?.ipAddress || '-'}</TableCell>
                      <TableCell>
                        {lb.enabled ? (
                          <Badge variant="success">Enabled</Badge>
                        ) : (
                          <Badge variant="secondary">Disabled</Badge>
                        )}
                      </TableCell>
                      <TableCell>
                        {lb.serverPool?.servers?.length || 0} servers
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-2">
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleToggle(lb.id, lb.enabled)}
                            title={lb.enabled ? 'Disable' : 'Enable'}
                          >
                            {lb.enabled ? (
                              <Pause className="h-4 w-4" />
                            ) : (
                              <Play className="h-4 w-4" />
                            )}
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => router.push(`/load-balancers/${lb.id}`)}
                            title="Edit"
                          >
                            <Edit className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleDelete(lb.id, lb.name)}
                            title="Delete"
                            disabled={lb.enabled}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

