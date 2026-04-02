async function test() {
  const res = await fetch("http://restate:9070/query", {
    method: "POST",
    headers: { "Content-Type": "application/json", "Accept": "application/json" },
    body: JSON.stringify({ query: "SELECT id, target_service_key FROM sys_invocation" })
  });
  const t = await res.text();
  console.log("STATUS:", res.status);
  console.log("PAYLOAD:", t);
  try {
    const ob = JSON.parse(t);
    console.log("KEYS:", Object.keys(ob));
    console.log("IS ARRAY?", Array.isArray(ob));
  } catch (e) {}
}
test();
