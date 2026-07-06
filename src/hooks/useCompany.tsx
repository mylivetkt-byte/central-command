import { createContext, useContext, useEffect, useState, ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "./useAuth";

interface Company {
  id: string;
  name: string;
  nit: string | null;
  email: string | null;
  phone: string | null;
  status: string;
  max_drivers: number;
  plan: string;
}

interface CompanyContextType {
  company: Company | null;
  companies: Company[];
  loading: boolean;
  switchCompany: (id: string) => void;
  selectedCompanyId: string | null;
}

const CompanyContext = createContext<CompanyContextType>({
  company: null,
  companies: [],
  loading: true,
  switchCompany: () => {},
  selectedCompanyId: null,
});

export const useCompany = () => useContext(CompanyContext);

export const CompanyProvider = ({ children }: { children: ReactNode }) => {
  const { user, role } = useAuth();
  const [company, setCompany] = useState<Company | null>(null);
  const [companies, setCompanies] = useState<Company[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedCompanyId, setSelectedCompanyId] = useState<string | null>(null);

  useEffect(() => {
    if (!user) {
      setCompany(null);
      setCompanies([]);
      setLoading(false);
      return;
    }

    const load = async () => {
      setLoading(true);
      try {
        if (role === "super_admin") {
          const { data } = await supabase
            .from("saas_companies")
            .select("*")
            .order("name");
          if (data) setCompanies(data as Company[]);
        }

        const { data: cu } = await supabase
          .from("company_users")
          .select("company_id")
          .eq("user_id", user.id)
          .maybeSingle();

        if (cu) {
          setSelectedCompanyId(cu.company_id);
          const { data: co } = await supabase
            .from("saas_companies")
            .select("*")
            .eq("id", cu.company_id)
            .single();
          if (co) setCompany(co as Company);
        }
      } catch (err) {
        console.error("[useCompany]", err);
      }
      setLoading(false);
    };

    load();
  }, [user, role]);

  const switchCompany = async (id: string) => {
    setSelectedCompanyId(id);
    const { data } = await supabase
      .from("saas_companies")
      .select("*")
      .eq("id", id)
      .single();
    if (data) setCompany(data as Company);
  };

  return (
    <CompanyContext.Provider value={{ company, companies, loading, switchCompany, selectedCompanyId }}>
      {children}
    </CompanyContext.Provider>
  );
};
