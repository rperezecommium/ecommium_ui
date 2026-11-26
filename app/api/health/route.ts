// Technical process health only: does not certify BFF readiness or expose tenant data.
export const dynamic = "force-dynamic";
export function GET() {
  return Response.json({ status: "ok", component: "ecommium-ui" }, {
    headers: { "Cache-Control": "no-store" },
  });
}
