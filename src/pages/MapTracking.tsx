import { useState } from 'react';
import { DashboardLayout } from '@/components/DashboardLayout';
import LiveMap from '@/components/LiveMap';
import DeliveryTracker from '@/components/DeliveryTracker';
import { Card } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { MapPin, Navigation, Search } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export default function MapTracking() {
  const [selectedDeliveryId, setSelectedDeliveryId] = useState<string | null>(null);
  const [searchOrderId, setSearchOrderId] = useState('');

  // Cargar entregas activas
  const { data: activeDeliveries } = useQuery({
    queryKey: ['active-deliveries'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('deliveries')
        .select('*')
        .in('status', ['pendiente', 'aceptado', 'en_camino'])
        .order('created_at', { ascending: false })
        .limit(20);

      if (error) throw error;
      return data;
    },
    refetchInterval: 10000 // Refrescar cada 10 segundos
  });

  const handleSearchDelivery = () => {
    const delivery = activeDeliveries?.find(d => d.order_id === searchOrderId);
    if (delivery) {
      setSelectedDeliveryId(delivery.id);
    }
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header */}
        <div>
          <h1 className="text-3xl font-bold tracking-tight flex items-center gap-2">
            <MapPin className="w-8 h-8" />
            Mapa en Tiempo Real
          </h1>
          <p className="text-muted-foreground mt-2">
            Visualiza la ubicación de drivers y el estado de entregas en tiempo real
          </p>
        </div>

        {/* Tabs */}
        <Tabs defaultValue="map" className="w-full">
          <TabsList className="grid w-full grid-cols-2 max-w-md">
            <TabsTrigger value="map" className="flex items-center gap-2">
              <MapPin className="w-4 h-4" />
              Vista General
            </TabsTrigger>
            <TabsTrigger value="tracking" className="flex items-center gap-2">
              <Navigation className="w-4 h-4" />
              Seguimiento
            </TabsTrigger>
          </TabsList>

          {/* Vista General del Mapa */}
          <TabsContent value="map" className="mt-6">
            <div className="grid lg:grid-cols-3 gap-6">
              {/* Mapa principal */}
              <div className="lg:col-span-2">
                <LiveMap 
                  height="700px"
                  showDrivers={true}
                  showDeliveries={true}
                  focusedDeliveryId={selectedDeliveryId}
                />
              </div>

              {/* Panel lateral con entregas activas */}
              <div className="space-y-4">
                <Card className="p-4">
                  <h3 className="font-semibold mb-4 flex items-center gap-2">
                    <Navigation className="w-5 h-5" />
                    Entregas Activas
                  </h3>
                  
                  {activeDeliveries && activeDeliveries.length > 0 ? (
                    <div className="space-y-2 max-h-[600px] overflow-y-auto">
                      {activeDeliveries.map((delivery) => (
                        <button
                          key={delivery.id}
                          onClick={() => setSelectedDeliveryId(delivery.id)}
                          className={`w-full p-3 text-left rounded-lg border transition-colors ${
                            selectedDeliveryId === delivery.id
                              ? 'bg-primary text-primary-foreground border-primary'
                              : 'hover:bg-accent border-border'
                          }`}
                        >
                          <div className="flex items-start justify-between mb-1">
                            <span className="font-semibold text-sm">
                              #{delivery.order_id}
                            </span>
                            <span className={`text-xs px-2 py-1 rounded ${
                              delivery.status === 'pendiente' ? 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200' :
                              delivery.status === 'aceptado' ? 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200' :
                              delivery.status === 'en_camino' ? 'bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200' :
                              'bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200'
                            }`}>
                              {delivery.status}
                            </span>
                          </div>
                          <p className="text-xs opacity-90 truncate">
                            {delivery.customer_name}
                          </p>
                          <p className="text-xs opacity-75 truncate mt-1">
                            {delivery.delivery_address}
                          </p>
                        </button>
                      ))}
                    </div>
                  ) : (
                    <p className="text-sm text-muted-foreground text-center py-8">
                      No hay entregas activas
                    </p>
                  )}
                </Card>

                {/* Estadísticas rápidas */}
                <Card className="p-4">
                  <h3 className="font-semibold mb-3">Estadísticas</h3>
                  <div className="space-y-3">
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-muted-foreground">Total Activas</span>
                      <span className="text-2xl font-bold">
                        {activeDeliveries?.length || 0}
                      </span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-muted-foreground">En Camino</span>
                      <span className="text-xl font-semibold text-orange-600">
                        {activeDeliveries?.filter(d => d.status === 'en_camino').length || 0}
                      </span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-muted-foreground">Pendientes</span>
                      <span className="text-xl font-semibold text-yellow-600">
                        {activeDeliveries?.filter(d => d.status === 'pendiente').length || 0}
                      </span>
                    </div>
                  </div>
                </Card>
              </div>
            </div>
          </TabsContent>

          {/* Seguimiento Individual */}
          <TabsContent value="tracking" className="mt-6">
            <div className="space-y-6">
              {/* Buscador de pedidos */}
              <Card className="p-6">
                <div className="flex gap-4">
                  <div className="flex-1">
                    <Label htmlFor="search-order">Buscar Pedido</Label>
                    <div className="flex gap-2 mt-2">
                      <Input
                        id="search-order"
                        placeholder="Ingresa el número de pedido..."
                        value={searchOrderId}
                        onChange={(e) => setSearchOrderId(e.target.value)}
                        onKeyDown={(e) => e.key === 'Enter' && handleSearchDelivery()}
                      />
                      <Button onClick={handleSearchDelivery}>
                        <Search className="w-4 h-4 mr-2" />
                        Buscar
                      </Button>
                    </div>
                  </div>
                </div>

                {/* Lista de pedidos recientes */}
                <div className="mt-4">
                  <p className="text-sm text-muted-foreground mb-2">
                    O selecciona un pedido reciente:
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {activeDeliveries?.slice(0, 5).map((delivery) => (
                      <Button
                        key={delivery.id}
                        variant="outline"
                        size="sm"
                        onClick={() => setSelectedDeliveryId(delivery.id)}
                      >
                        #{delivery.order_id}
                      </Button>
                    ))}
                  </div>
                </div>
              </Card>

              {/* Tracker del pedido seleccionado */}
              {selectedDeliveryId ? (
                <DeliveryTracker 
                  deliveryId={selectedDeliveryId} 
                  height="600px"
                />
              ) : (
                <Card className="p-12 text-center">
                  <Navigation className="w-16 h-16 mx-auto mb-4 text-muted-foreground opacity-50" />
                  <h3 className="text-xl font-semibold mb-2">
                    Selecciona un pedido
                  </h3>
                  <p className="text-muted-foreground">
                    Busca un pedido por su número o selecciona uno de la lista
                    para ver su tracking en tiempo real
                  </p>
                </Card>
              )}
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </DashboardLayout>
  );
}
