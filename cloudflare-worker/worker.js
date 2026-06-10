/**
 * EBENEZER SAÚDE - Proxy API MediQuo
 * 
 * Este Cloudflare Worker atua como proxy para a API do MediQuo,
 * evitando problemas de CORS no navegador.
 * 
 * ══════════════════════════════════════════════════════════════
 * COMO CONFIGURAR (5 minutos):
 * ══════════════════════════════════════════════════════════════
 * 
 * 1. Acesse: https://dash.cloudflare.com/
 * 2. Crie uma conta gratuita (se não tiver)
 * 3. No menu lateral, clique em "Workers & Pages"
 * 4. Clique em "Create Application" → "Create Worker"
 * 5. Dê um nome (ex: "ebenezer-api")
 * 6. Clique em "Deploy"
 * 7. Clique em "Edit Code"
 * 8. Apague tudo e cole este código
 * 9. Clique em "Save and Deploy"
 * 10. Copie a URL gerada (ex: https://ebenezer-api.seuusuario.workers.dev)
 * 11. Cole essa URL no arquivo src/lib/mediquo.ts onde diz WORKER_URL
 * 
 * ══════════════════════════════════════════════════════════════
 */

const MEDIQUO_API = "https://sdk.mediquo.com/v1";
const API_KEY = "7T61g4NyEUhanFU6";
const SECRET_KEY = "qOqEPgrYM4Wy2Ml08eskZ2QsFj8v9Op6GCSIF7xltlj1UmzW50uVb8vcSaHk2eZI";

// Domínios permitidos (adicione seu domínio de produção aqui)
const ALLOWED_ORIGINS = [
  "http://localhost:5173",
  "http://localhost:3000",
  "http://127.0.0.1:5173",
  "https://ebenezer-saude.vercel.app",
  "https://ebenezer-saude.netlify.app",
  // Adicione seu domínio aqui
];

export default {
  async fetch(request, env, ctx) {
    // Pega a origem da requisição
    const origin = request.headers.get("Origin") || "";
    
    // Headers CORS
    const corsHeaders = {
      "Access-Control-Allow-Origin": ALLOWED_ORIGINS.includes(origin) ? origin : ALLOWED_ORIGINS[0],
      "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type, Authorization",
      "Access-Control-Max-Age": "86400",
    };

    // Responde OPTIONS (preflight)
    if (request.method === "OPTIONS") {
      return new Response(null, { status: 204, headers: corsHeaders });
    }

    try {
      const url = new URL(request.url);
      const path = url.pathname;

      // Rota: POST /register - Registrar paciente
      if (path === "/register" && request.method === "POST") {
        const body = await request.json();
        
        const response = await fetch(`${MEDIQUO_API}/patients`, {
          method: "PUT",
          headers: {
            "Content-Type": "application/json",
            "X-API-Key": API_KEY,
            "X-Secret-Key": SECRET_KEY,
          },
          body: JSON.stringify({
            patients: [
              {
                code: body.code,
                first_name: body.firstName,
                last_name: body.lastName || "",
                email: body.email,
                birth_date: body.birthDate,
                tax_id: body.taxId,
                locale: "pt",
                plan: "premium",
              },
            ],
          }),
        });

        const data = await response.json().catch(() => ({}));
        
        return new Response(JSON.stringify({
          success: response.ok,
          status: response.status,
          data,
        }), {
          status: response.ok ? 200 : response.status,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Rota: POST /authenticate - Autenticar paciente
      if (path === "/authenticate" && request.method === "POST") {
        const body = await request.json();
        
        const response = await fetch(`${MEDIQUO_API}/patients/authenticate`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "X-API-Key": API_KEY,
            "X-Secret-Key": SECRET_KEY,
          },
          body: JSON.stringify({ code: body.code }),
        });

        const data = await response.json().catch(() => ({}));
        
        return new Response(JSON.stringify({
          success: response.ok,
          status: response.status,
          accessToken: data.access_token || null,
          data,
        }), {
          status: response.ok ? 200 : response.status,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Rota: GET /health - Verificar se o worker está funcionando
      if (path === "/health") {
        return new Response(JSON.stringify({
          status: "ok",
          timestamp: new Date().toISOString(),
          service: "Ebenezer Saúde API Proxy",
        }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Rota não encontrada
      return new Response(JSON.stringify({
        error: "Not found",
        availableRoutes: [
          "POST /register",
          "POST /authenticate", 
          "GET /health",
        ],
      }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });

    } catch (error) {
      return new Response(JSON.stringify({
        error: "Internal server error",
        message: error.message,
      }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
  },
};
