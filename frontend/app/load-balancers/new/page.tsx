'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import api from '@/lib/api';
import { Navbar } from '@/components/layout/navbar';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';

export default function NewLoadBalancerPage() {
  const router = useRouter();
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    protocol: 'http',
    listenPort: '',
    algorithm: 'roundrobin',
    serverPoolId: '',
    vipId: '',
    certificateId: '',
    healthCheckId: '',
    sessionPersistence: false,
    connectionTimeout: '5000',
    requestTimeout: '30000',
    maxRetries: '2',
  });
  const [pools, setPools] = useState<any[]>([]);
  const [vips, setVips] = useState<any[]>([]);
  const [certificates, setCertificates] = useState<any[]>([]);
  const [healthChecks, setHealthChecks] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    fetchOptions();
  }, []);

  const fetchOptions = async () => {
    try {
      const [poolsRes, vipsRes, certsRes, hcRes] = await Promise.all([
        api.get('/server-pools'),
        api.get('/vip'),
        api.get('/certificates'),
        api.get('/health-checks'),
      ]);
      setPools(poolsRes.data);
      setVips(vipsRes.data);
      setCertificates(certsRes.data);
      setHealthChecks(hcRes.data);
    } catch (error) {
      console.error('Failed to fetch options:', error);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const data = {
        ...formData,
        listenPort: parseInt(formData.listenPort),
        connectionTimeout: parseInt(formData.connectionTimeout),
        requestTimeout: parseInt(formData.requestTimeout),
        maxRetries: parseInt(formData.maxRetries),
        vipId: formData.vipId || undefined,
        certificateId: formData.certificateId || undefined,
        healthCheckId: formData.healthCheckId || undefined,
      };

      await api.post('/load-balancers', data);
      router.push('/load-balancers');
    } catch (error: any) {
      alert(error.response?.data?.error || 'Failed to create load balancer');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <div className="container mx-auto px-4 py-8 max-w-2xl">
        <Card>
          <CardHeader>
            <CardTitle>Create Load Balancer</CardTitle>
            <CardDescription>Configure a new load balancer instance</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-6">
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
                <Label htmlFor="description">Description</Label>
                <Textarea
                  id="description"
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="protocol">Protocol *</Label>
                  <Select
                    value={formData.protocol}
                    onValueChange={(value) => setFormData({ ...formData, protocol: value })}
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

                <div className="space-y-2">
                  <Label htmlFor="listenPort">Listen Port *</Label>
                  <Input
                    id="listenPort"
                    type="number"
                    value={formData.listenPort}
                    onChange={(e) => setFormData({ ...formData, listenPort: e.target.value })}
                    required
                    min="1"
                    max="65535"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="algorithm">Algorithm *</Label>
                <Select
                  value={formData.algorithm}
                  onValueChange={(value) => setFormData({ ...formData, algorithm: value })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="roundrobin">Round Robin</SelectItem>
                    <SelectItem value="leastconn">Least Connections</SelectItem>
                    <SelectItem value="weighted">Weighted Round Robin</SelectItem>
                    <SelectItem value="iphash">IP Hash (Session Persistence)</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="serverPoolId">Server Pool *</Label>
                <Select
                  value={formData.serverPoolId}
                  onValueChange={(value) => setFormData({ ...formData, serverPoolId: value })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select a server pool" />
                  </SelectTrigger>
                  <SelectContent>
                    {pools.map((pool) => (
                      <SelectItem key={pool.id} value={pool.id}>
                        {pool.name} ({pool.servers?.length || 0} servers)
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="vipId">Virtual IP (Optional)</Label>
                <Select
                  value={formData.vipId}
                  onValueChange={(value) => setFormData({ ...formData, vipId: value })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select a VIP" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="">None</SelectItem>
                    {vips.map((vip) => (
                      <SelectItem key={vip.id} value={vip.id}>
                        {vip.ipAddress}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {formData.protocol === 'https' && (
                <div className="space-y-2">
                  <Label htmlFor="certificateId">SSL Certificate</Label>
                  <Select
                    value={formData.certificateId}
                    onValueChange={(value) => setFormData({ ...formData, certificateId: value })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select a certificate" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="">None</SelectItem>
                      {certificates.map((cert) => (
                        <SelectItem key={cert.id} value={cert.id}>
                          {cert.name} ({cert.domain})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}

              <div className="space-y-2">
                <Label htmlFor="healthCheckId">Health Check (Optional)</Label>
                <Select
                  value={formData.healthCheckId}
                  onValueChange={(value) => setFormData({ ...formData, healthCheckId: value })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select a health check" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="">None</SelectItem>
                    {healthChecks.map((hc) => (
                      <SelectItem key={hc.id} value={hc.id}>
                        {hc.name} ({hc.type})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="flex items-center space-x-2">
                <Switch
                  id="sessionPersistence"
                  checked={formData.sessionPersistence}
                  onCheckedChange={(checked) =>
                    setFormData({ ...formData, sessionPersistence: checked })
                  }
                />
                <Label htmlFor="sessionPersistence">Enable Session Persistence</Label>
              </div>

              <div className="grid grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="connectionTimeout">Connection Timeout (ms)</Label>
                  <Input
                    id="connectionTimeout"
                    type="number"
                    value={formData.connectionTimeout}
                    onChange={(e) =>
                      setFormData({ ...formData, connectionTimeout: e.target.value })
                    }
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="requestTimeout">Request Timeout (ms)</Label>
                  <Input
                    id="requestTimeout"
                    type="number"
                    value={formData.requestTimeout}
                    onChange={(e) =>
                      setFormData({ ...formData, requestTimeout: e.target.value })
                    }
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="maxRetries">Max Retries</Label>
                  <Input
                    id="maxRetries"
                    type="number"
                    value={formData.maxRetries}
                    onChange={(e) => setFormData({ ...formData, maxRetries: e.target.value })}
                  />
                </div>
              </div>

              <div className="flex gap-4">
                <Button type="submit" disabled={loading}>
                  {loading ? 'Creating...' : 'Create Load Balancer'}
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => router.push('/load-balancers')}
                >
                  Cancel
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

