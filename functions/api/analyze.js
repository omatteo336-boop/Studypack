// StudyPack AI endpoint placeholder.
// The frontend is intentionally tested before the AI provider is connected.
export async function onRequestPost() {
  return new Response(JSON.stringify({
    error: "AI endpoint is not connected yet."
  }), {
    status: 501,
    headers: {"Content-Type":"application/json"}
  });
}
