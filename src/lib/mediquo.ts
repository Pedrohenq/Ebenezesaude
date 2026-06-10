const API_KEY = "7T61g4NyEUhanFU6";
const SECRET_KEY =
  "qOqEPgrYM4Wy2Ml08eskZ2QsFj8v9Op6GCSIF7xltlj1UmzW50uVb8vcSaHk2eZI";
const MEDIQUO_API = "https://sdk.mediquo.com/v1";
const WIDGET_SCRIPT = "https://widget.mediquo.com/js/1.0.0/mediquo.js";

// ╔════════════════════════════════════════════════════════════════╗
// ║  COLE A URL DO SEU CLOUDFLARE WORKER AQUI                     ║
// ╚════════════════════════════════════════════════════════════════╝
const WORKER_URL = "";

/* ── helpers ── */
function fetchT(url: string, opts: RequestInit, ms = 8000): Promise<Response> {
  const c = new AbortController();
  const t = setTimeout(() => c.abort(), ms);
  return fetch(url, { ...opts, signal: c.signal }).finally(() => clearTimeout(t));
}

/* ── carrega script do widget dinamicamente ── */
let widgetLoaded = false;
function loadWidgetScript(): Promise<void> {
  if (widgetLoaded || (window as any).MediquoWidget) {
    widgetLoaded = true;
    return Promise.resolve();
  }
  return new Promise((resolve, reject) => {
    const s = document.createElement("script");
    s.src = WIDGET_SCRIPT;
    s.async = true;
    s.onload = () => {
      widgetLoaded = true;
      console.log("[mediquo] script carregado ✓");
      resolve();
    };
    s.onerror = () => reject(new Error("Falha ao carregar widget"));
    document.head.appendChild(s);
  });
}

/* ── registrar paciente ── */
export async function registerPatient(patient: {
  code: string;
  firstName: string;
  lastName?: string;
  email: string;
  birthDate: string;
  taxId: string;
}): Promise<boolean> {
  console.log("[mediquo] registrando paciente…");

  const payload = {
    patients: [
      {
        code: patient.code,
        first_name: patient.firstName,
        last_name: patient.lastName || "",
        email: patient.email,
        birth_date: patient.birthDate,
        tax_id: patient.taxId,
        locale: "pt",
        plan: "premium",
      },
    ],
  };

  // Opção 1: Cloudflare Worker
  if (WORKER_URL) {
    try {
      const res = await fetchT(`${WORKER_URL}/register`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(patient),
      });
      const data = await res.json();
      if (data.success) { console.log("[mediquo] registrado via worker ✓"); return true; }
    } catch (e) { console.warn("[mediquo] worker falhou:", e); }
  }

  // Opção 2: Proxy público
  const proxies = [
    `https://corsproxy.io/?${encodeURIComponent(`${MEDIQUO_API}/patients`)}`,
    `https://api.allorigins.win/raw?url=${encodeURIComponent(`${MEDIQUO_API}/patients`)}`,
  ];

  for (const proxy of proxies) {
    try {
      const res = await fetchT(proxy, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          "X-API-Key": API_KEY,
          "X-Secret-Key": SECRET_KEY,
        },
        body: JSON.stringify(payload),
      }, 6000);
      if (res.ok) { console.log("[mediquo] registrado via proxy ✓"); return true; }
    } catch (e) { console.warn("[mediquo] proxy falhou:", e); }
  }

  console.warn("[mediquo] registro falhou (todas tentativas)");
  return false;
}

/* ── autenticar paciente ── */
export async function authenticatePatient(code: string): Promise<string | null> {
  console.log("[mediquo] autenticando…");

  // Opção 1: Cloudflare Worker
  if (WORKER_URL) {
    try {
      const res = await fetchT(`${WORKER_URL}/authenticate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code }),
      });
      const data = await res.json();
      if (data.accessToken) { console.log("[mediquo] auth via worker ✓"); return data.accessToken; }
    } catch (e) { console.warn("[mediquo] worker auth falhou:", e); }
  }

  // Opção 2: Proxy público
  const proxies = [
    `https://corsproxy.io/?${encodeURIComponent(`${MEDIQUO_API}/patients/authenticate`)}`,
    `https://api.allorigins.win/raw?url=${encodeURIComponent(`${MEDIQUO_API}/patients/authenticate`)}`,
  ];

  for (const proxy of proxies) {
    try {
      const res = await fetchT(proxy, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-API-Key": API_KEY,
          "X-Secret-Key": SECRET_KEY,
        },
        body: JSON.stringify({ code }),
      }, 6000);
      if (res.ok) {
        const data = await res.json();
        if (data.access_token) { console.log("[mediquo] auth via proxy ✓"); return data.access_token; }
      }
    } catch (e) { console.warn("[mediquo] proxy auth falhou:", e); }
  }

  console.warn("[mediquo] auth falhou (todas tentativas)");
  return null;
}

/* ── inicializar widget ── */
export async function initWidget(accessToken: string | null): Promise<boolean> {
  // 1. Carrega o script se ainda não foi carregado
  try {
    await loadWidgetScript();
  } catch {
    console.error("[mediquo] não conseguiu carregar o script do widget");
    return false;
  }

  const w = window as any;
  if (!w.MediquoWidget) {
    console.error("[mediquo] MediquoWidget não encontrado");
    return false;
  }

  // 2. Configura
  const config: Record<string, any> = {
    apiKey: API_KEY,
    adapter: "web",
    show: "always",
    theme: {
      position: "right",
      launcher: "extended",
      locale: "pt",
      colors: {
        primary: "#7e22ce",
        primaryContrast: "#ffffff",
        secondary: "#9333ea",
        accent: "#a855f7",
      },
      text: {
        title: "Ebenezer Saúde",
        launcher: "Falar com médico",
        welcome_title: "Bem-vindo à Ebenezer Saúde",
        welcome_text: "Escolha um profissional para iniciar sua consulta",
        welcome_button: "Ver profissionais",
      },
    },
  };

  if (accessToken) {
    config.accessToken = accessToken;
    console.log("[mediquo] init com sessão permanente");
  } else {
    console.log("[mediquo] init com sessão temporária");
  }

  // 3. Inicializa
  return new Promise<boolean>((resolve) => {
    try {
      const result = w.MediquoWidget.init(config);

      const done = () => {
        console.log("[mediquo] widget pronto ✓");
        setTimeout(() => openWidget(), 600);
        resolve(true);
      };

      if (result && typeof result.then === "function") {
        result.then(done).catch(() => {
          console.warn("[mediquo] init rejeitado, abrindo mesmo assim");
          setTimeout(() => openWidget(), 600);
          resolve(true);
        });
      } else {
        setTimeout(done, 1000);
      }
    } catch (err) {
      console.error("[mediquo] erro ao inicializar:", err);
      resolve(false);
    }

    // Timeout final: se nada acontecer em 5s, resolve
    setTimeout(() => resolve(true), 5000);
  });
}

/* ── abrir widget ── */
export function openWidget() {
  const w = window as any;
  if (!w.MediquoWidget) return;
  try {
    if (typeof w.MediquoWidget.open === "function") w.MediquoWidget.open();
    else if (typeof w.MediquoWidget.open_list === "function") w.MediquoWidget.open_list();
    console.log("[mediquo] widget aberto ✓");
  } catch (e) {
    console.warn("[mediquo] erro ao abrir:", e);
  }
}

export { API_KEY };
