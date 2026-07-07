const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = "https://yreripjxgcgjzpyoeixz.supabase.co";
const supabaseKey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InlyZXJpcGp4Z2NnanpweW9laXh6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzUwMTA1NjcsImV4cCI6MjA5MDU4NjU2N30.PtPslFdASI9wt86GRuucz54cwr8CSN8oab8fYAvxqV8";

const supabase = createClient(supabaseUrl, supabaseKey);

async function run() {
  console.log("Checking saas_companies columns...");
  const { data: cols, error: colError } = await supabase
    .from('saas_companies')
    .select('plan_value')
    .limit(1);

  if (colError) {
    console.log("❌ ERROR: plan_value column does not exist or query failed:", colError.message);
  } else {
    console.log("✅ SUCCESS: plan_value column exists in saas_companies!");
  }

  console.log("\nChecking trigger/company creation by fetching companies...");
  const { data: companies, error: compError } = await supabase
    .from('saas_companies')
    .select('*')
    .limit(5);

  if (compError) {
    console.log("❌ ERROR fetching companies:", compError.message);
  } else {
    console.log("✅ SUCCESS fetching companies. Found:", companies.length, "companies");
    console.log(companies);
  }
}

run();
