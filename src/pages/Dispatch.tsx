import { useAuth } from "@/hooks/useAuth";
import { DashboardLayout } from "@/components/DashboardLayout";
import AddressAutocomplete from "@/components/ui/AddressAutocomplete";
import ChatBubble from "@/components/ChatBubble";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { motion, AnimatePresence } from "framer-motion";
import { useState, useEffect } from "react";
import { Zap, MapPin, Package, Plus, X, Send, UserCheck, Clock, CheckCircle, XCircle, RefreshCw, BellRing, Navigation } from "lucide-react";
import { toast } from "sonner";

const formatCurrency = (v: number) =>
  new Intl.NumberFormat("es-CO", { style: "currency", currency: "COP", minimumFractionDigits: 0 }).format(v);

interface NewDeliveryForm {
  customer_name: string;
  customer_phone: string;
  pickup_address: string;
  delivery_address: string;
  amount: string;
  commission: string;
  estimated_time: string;
  zone: string;
  notes: string;
  pickup_lat?: number;
  pickup_lng?: number;
  delivery_lat?: number;
  delivery_lng?: number;
}

const emptyForm: NewDeliveryForm = {
  customer_name: "",
  customer_phone: "",
  pickup_address: "",
  delivery_address: "",
  amount: "",
  commission: "",
  estimated_time: "30",
  zone: "",
  notes: "",
};

const Dispatch = () => {
  const { user } = useAuth();
  const [showNewForm, setShowNewForm] = useState(false);
  const [form, setForm] = useState<NewDeliveryForm>(emptyForm);
  const [selectedOrder, setSelectedOrder] = useState<string | null>(null);
  const queryClient = useQueryClient();

  // Pedidos activos
  const { data: pending = [], isLoading: loadingPending } = useQuery({
    queryKey: ["dispatch-pending"],
    queryFn: async () => {
      const { data, error } = await (supabase.from("deliveries") as any)
        .select("*")
        .in("status", ["pendiente", "aceptado", "en_camino"])
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data as any[]) || [];
    },
    refetchInterval: 10000,
  });

  // Repartidores
  const { data: availableDrivers = [], isLoading: loadingDrivers } = useQuery({
    queryKey: ["dispatch-drivers"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("driver_profiles")
        .select(`id, status, current_load, zone, rating, profiles (full_name)`)
        .eq("status", "activo")
        .order("current_load", { ascending: true }) as any;
      if (error) throw error;
      return (data as any) || [];
    },
    refetchInterval: 10000,
  });

  // BROADCAST PARA LOS MENSAJEROS
  const broadcastNewOrder = async () => {
    const channel = supabase.channel("dispatch-notifications");
    await channel.subscribe(async (status) => {
      if (status === "SUBSCRIBED") {
        await channel.send({
          type: "broadcast",
          event: "new-order",
          payload: { message: "Nuevo pedido publicado" }
        });
        console.log("Broadcast sent!");
        supabase.removeChannel(channel);
      }
    });
  };

  const createDelivery = useMutation({
    mutationFn: async (formData: NewDeliveryForm) => {
      const orderId = `DOM-${Date.now().toString().slice(-6)}`;
      
      const { error } = await (supabase.from("deliveries") as any).insert({
        order_id: orderId,
        customer_name: formData.customer_name,
        customer_phone: formData.customer_phone || null,
        pickup_address: formData.pickup_address,
        delivery_address: formData.delivery_address,
        pickup_lat: formData.pickup_lat || null,
        pickup_lng: formData.pickup_lng || null,
        delivery_lat: formData.delivery_lat || null,
        delivery_lng: formData.delivery_lng || null,
        amount: parseFloat(formData.amount) || 0,
        commission: parseFloat(formData.commission) || 0,
        estimated_time: parseInt(formData.estimated_time) || 30,
        zone: formData.zone || null,
        status: "pendiente",
        notes: formData.notes || null,
      });
      if (error) throw error;
      
      // Enviar señal a los mensajeros
      await broadcastNewOrder();
      
      return orderId;
    },
    onSuccess: (orderId) => {
      toast.success(`✅ ¡PEDIDO PUBLICADO!`, {
        description: `El servicio ${orderId} ya está disponible para los mensajeros.`,
      });
      setForm(emptyForm);
      setShowNewForm(false);
      queryClient.invalidateQueries({ queryKey: ["dispatch-pending"] });
    },
    onError: (err: any) => toast.error(`Error: ${err.message}`),
  });

  const assignDriver = useMutation({
    mutationFn: async ({ deliveryId, driverId }: { deliveryId: string; driverId: string }) => {
      const { error } = await (supabase.from("deliveries") as any)
        .update({ driver_id: driverId, status: "aceptado", accepted_at: new Date().toISOString() })
        .eq("id", deliveryId);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Mensajero asignado con éxito");
      setSelectedOrder(null);
      queryClient.invalidateQueries({ queryKey: ["dispatch-pending"] });
    },
  });

  const handleFormChange = (field: keyof NewDeliveryForm, value: any) => {
    setForm((prev) => ({ ...prev, [field]: value }));
  };

  return (
    <DashboardLayout>
      <div className="max-w-[1200px] mx-auto space-y-8 animate-in fade-in duration-700">
        
        {/* Cabecera Admin Premium */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 p-8 bg-card border border-white/5 rounded-[32px] shadow-2xl">
          <div>
            <div className="flex items-center gap-3 mb-2">
                <div className="p-2 bg-indigo-500/20 rounded-xl">
                    <Navigation className="h-6 w-6 text-indigo-500" />
                </div>
                <h1 className="text-3xl font-black tracking-tight text-white">Central de Despacho</h1>
            </div>
            <p className="text-sm text-white/40 font-medium">Gestiona la logística de tu flota en tiempo real.</p>
          </div>
          
          <button
            onClick={() => setShowNewForm(true)}
            className="group relative flex items-center gap-3 rounded-2xl bg-indigo-600 px-8 py-4 text-sm font-black text-white hover:bg-indigo-500 transition-all shadow-xl shadow-indigo-600/20 active:scale-95"
          >
            <Plus className="h-5 w-5" /> PUBLICAR NUEVO ENVÍO
            <div className="absolute -top-1 -right-1 h-4 w-4 bg-emerald-500 rounded-full animate-ping pointer-events-none" />
          </button>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
            
            {/* Listado de Servicios (60%) */}
            <div className="lg:col-span-8 space-y-6">
                
                <AnimatePresence>
                    {showNewForm && (
                        <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden">
                            <div className="bg-white rounded-[32px] p-8 shadow-2xl space-y-6 border border-slate-100">
                                <div className="flex items-center justify-between border-b border-slate-50 pb-5">
                                    <h2 className="text-xl font-black text-slate-800">Detalles del Servicio</h2>
                                    <button onClick={() => setShowNewForm(false)} className="h-10 w-10 rounded-full bg-slate-50 flex items-center justify-center text-slate-400 hover:bg-slate-100"><X /></button>
                                </div>
                                
                                <form onSubmit={(e) => { e.preventDefault(); createDelivery.mutate(form); }} className="space-y-6">
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                        <div className="space-y-2">
                                            <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">Cliente Receptor</label>
                                            <input value={form.customer_name} onChange={(e) => handleFormChange("customer_name", e.target.value)} placeholder="Nombre completo" required className="w-full h-14 rounded-2xl bg-slate-50 border-transparent focus:bg-white focus:ring-4 focus:ring-indigo-100 transition-all px-6 text-sm font-bold text-slate-800" />
                                        </div>
                                        <div className="space-y-2">
                                            <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">Teléfono Contacto</label>
                                            <input value={form.customer_phone} onChange={(e) => handleFormChange("customer_phone", e.target.value)} placeholder="+57 3..." className="w-full h-14 rounded-2xl bg-slate-50 border-transparent focus:bg-white focus:ring-4 focus:ring-indigo-100 transition-all px-6 text-sm font-bold text-slate-800" />
                                        </div>
                                    </div>

                                    <div className="space-y-2">
                                        <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">📍 Punto de Recogida (Sugerencias Inteligentes)</label>
                                        <AddressAutocomplete value={form.pickup_address} onChange={(a, c) => { handleFormChange("pickup_address", a); if(c){ handleFormChange("pickup_lat", c.lat); handleFormChange("pickup_lng", c.lng); } }} placeholder="Escribe la dirección y selecciona de la lista..." className="dispatch-autocomplete" />
                                    </div>

                                    <div className="space-y-2">
                                        <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">🏁 Destino de Entrega (Sugerencias Inteligentes)</label>
                                        <AddressAutocomplete value={form.delivery_address} onChange={(a, c) => { handleFormChange("delivery_address", a); if(c){ handleFormChange("delivery_lat", c.lat); handleFormChange("delivery_lng", c.lng); } }} placeholder="Busca la dirección exacta del cliente..." className="dispatch-autocomplete" />
                                    </div>

                                    <div className="grid grid-cols-3 gap-4 pb-4">
                                        <div className="space-y-2">
                                            <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">Cobro Cliente</label>
                                            <div className="relative">
                                                <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-300 font-bold">$</span>
                                                <input type="number" value={form.amount} onChange={(e) => handleFormChange("amount", e.target.value)} className="w-full h-14 rounded-2xl bg-slate-50 pl-8 pr-4 text-sm font-black text-slate-800" placeholder="0" />
                                            </div>
                                        </div>
                                        <div className="space-y-2">
                                            <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">Pago Mensajero</label>
                                            <div className="relative">
                                                <span className="absolute left-4 top-1/2 -translate-y-1/2 text-emerald-300 font-bold">$</span>
                                                <input type="number" value={form.commission} onChange={(e) => handleFormChange("commission", e.target.value)} className="w-full h-14 rounded-2xl bg-slate-50 pl-8 pr-4 text-sm font-black text-emerald-600" placeholder="0" />
                                            </div>
                                        </div>
                                        <div className="space-y-2">
                                            <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">Minutos Est.</label>
                                            <input type="number" value={form.estimated_time} onChange={(e) => handleFormChange("estimated_time", e.target.value)} className="w-full h-14 rounded-2xl bg-slate-50 px-6 text-sm font-black text-slate-800" />
                                        </div>
                                    </div>

                                    <button type="submit" disabled={createDelivery.isPending} className="w-full h-16 rounded-2xl bg-indigo-600 hover:bg-indigo-700 text-white font-black transition-all shadow-xl shadow-indigo-100 flex items-center justify-center gap-3">
                                        <Send /> {createDelivery.isPending ? "PROCESANDO..." : "PUBLICAR SERVICIO AHORA"}
                                    </button>
                                </form>
                            </div>
                        </motion.div>
                    )}
                </AnimatePresence>

                <div className="bg-card border border-white/5 rounded-[32px] p-6 space-y-4 shadow-xl">
                    <div className="flex items-center justify-between px-4 pb-2">
                        <h3 className="text-sm font-black text-white/30 uppercase tracking-widest">Envíos en Curso</h3>
                        <div className="flex items-center gap-2">
                            <RefreshCw className={`h-3.5 w-3.5 text-white/20 ${loadingPending ? 'animate-spin' : ''}`} />
                            <span className="text-xs font-black text-white/20">{pending.length}</span>
                        </div>
                    </div>
                    
                    <div className="space-y-3 max-h-[600px] overflow-y-auto custom-scrollbar pr-2">
                        {pending.map((d: any) => (
                            <motion.div key={d.id} className={`p-5 rounded-3xl border transition-all cursor-pointer ${selectedOrder === d.id ? 'bg-indigo-500/10 border-indigo-500 shadow-xl' : 'bg-white/5 border-transparent hover:bg-white/10'}`} onClick={() => setSelectedOrder(selectedOrder === d.id ? null : d.id)}>
                                <div className="flex items-center justify-between mb-4">
                                    <div className="flex items-center gap-3">
                                        <div className="h-10 w-10 rounded-xl bg-slate-800 flex items-center justify-center font-black text-white text-xs">#{d.order_id.slice(-4)}</div>
                                        <div>
                                            <p className="text-sm font-black text-white">{d.customer_name}</p>
                                            <p className="text-[10px] text-white/40 font-bold uppercase tracking-widest">{d.status}</p>
                                        </div>
                                    </div>
                                    <div className="text-right">
                                        <p className="text-sm font-black text-emerald-400">{formatCurrency(d.commission)}</p>
                                        <p className="text-[10px] text-white/20 font-bold">GANANCIA</p>
                                    </div>
                                </div>
                                <div className="space-y-2 border-t border-white/5 pt-4">
                                    <div className="flex items-start gap-3">
                                        <div className="h-2 w-2 rounded-full bg-emerald-500 mt-1" />
                                        <p className="text-xs text-white/60 font-medium truncate">{d.pickup_address}</p>
                                    </div>
                                    <div className="flex items-start gap-3">
                                        <div className="h-2 w-2 rounded-full bg-indigo-500 mt-1" />
                                        <p className="text-xs text-white/60 font-medium truncate">{d.delivery_address}</p>
                                    </div>
                                </div>
                            </motion.div>
                        ))}
                    </div>
                </div>
            </div>

            {/* Sidebar de Repartidores (40%) */}
            <div className="lg:col-span-4 space-y-6">
                <div className="bg-card border border-white/5 rounded-[32px] p-6 shadow-xl h-full">
                    <h3 className="text-sm font-black text-white/30 uppercase tracking-widest mb-6 flex items-center gap-2">
                        <UserCheck className="h-4 w-4" /> Mensajeros Online
                    </h3>
                    
                    <div className="space-y-4">
                        {availableDrivers.map((d: any) => (
                            <div key={d.id} className="p-4 rounded-2xl bg-white/5 border border-transparent hover:border-white/10 flex items-center justify-between transition-all group">
                                <div className="flex items-center gap-4">
                                    <div className="relative">
                                        <div className="h-12 w-12 rounded-2xl bg-indigo-500/20 flex items-center justify-center font-black text-indigo-400 capitalize">
                                            {d.profiles?.full_name?.[0] || 'M'}
                                        </div>
                                        <div className="absolute -bottom-1 -right-1 h-4 w-4 bg-emerald-500 rounded-full border-4 border-slate-900" />
                                    </div>
                                    <div>
                                        <p className="text-sm font-black text-white">{d.profiles?.full_name}</p>
                                        <p className="text-[10px] text-white/30 font-bold uppercase">{d.rating || 5.0} ⭐ · {d.current_load} pedidos</p>
                                    </div>
                                </div>
                                
                                {selectedOrder && pending.find((p: any) => p.id === selectedOrder)?.status === 'pendiente' && (
                                    <button onClick={() => assignDriver.mutate({ deliveryId: selectedOrder, driverId: d.id })} className="h-10 px-4 rounded-xl bg-emerald-500 text-white text-[10px] font-black hover:bg-emerald-400 active:scale-95 transition-all">
                                        ASIGNAR
                                    </button>
                                )}
                            </div>
                        ))}
                    </div>
                </div>
            </div>
        </div>

        {/* CHAT SECTION - Shows when an order with a driver is selected */}
        <AnimatePresence>
          {selectedOrder && user && (() => {
            const order = pending.find((p: any) => p.id === selectedOrder);
            if (!order || !order.driver_id) return null;
            return (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: 'auto', opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                className="overflow-hidden"
              >
                <div className="max-w-[600px] mx-auto">
                  <div className="bg-slate-900 rounded-[32px] border border-white/5 overflow-hidden shadow-2xl p-4">
                    <ChatBubble
                      deliveryId={order.id}
                      currentUserId={user.id}
                      isDriverView={false}
                      initialOpen={true}
                    />
                  </div>
                </div>
              </motion.div>
            );
          })()}
        </AnimatePresence>

        <style dangerouslySetInnerHTML={{ __html: `
            .dispatch-autocomplete input { height: 3.5rem !important; border-radius: 1rem !important; padding-left: 3.5rem !important; }
            .dispatch-autocomplete .absolute.left-3 { left: 1.5rem !important; }
            .custom-scrollbar::-webkit-scrollbar { width: 4px; }
            .custom-scrollbar::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.05); border-radius: 10px; }
        `}} />
      </div>
    </DashboardLayout>
  );
};

export default Dispatch;
