import { createClient } from "./src/lib/supabase-server";

async function test() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    console.log("No user");
    return;
  }
  console.log("User:", user.id);
  
  const { data, error } = await supabase.from("recipients").insert({
    name: "Test Recipient",
    relationship: "Family",
    user_id: user.id
  });
  console.log("Error:", error);
  console.log("Data:", data);
}

test();
