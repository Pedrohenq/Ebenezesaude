import { useState } from "react";
import { savePatient } from "./lib/firebase";
import {
  registerPatient,
  authenticatePatient,
  initWidget,
  openWidget,
} from "./lib/mediquo";

type Step = "form" | "loading" | "success" | "error";

/* ── formatação ── */
const fmtCPF = (v: string) => {
  const d = v.replace(/\D/g, "").slice(0, 11);
  if (d.length <= 3) return d;
  if (d.length <= 6) return d.slice(0, 3) + "." + d.slice(3);
  if (d.length <= 9) return d.slice(0, 3) + "." + d.slice(3, 6) + "." + d.slice(6);
  return d.slice(0, 3) + "." + d.slice(3, 6) + "." + d.slice(6, 9) + "-" + d.slice(9);
};
const fmtDate = (v: string) => {
  const d = v.replace(/\D/g, "").slice(0, 8);
  if (d.length <= 2) return d;
  if (d.length <= 4) return d.slice(0, 2) + "/" + d.slice(2);
  return d.slice(0, 2) + "/" + d.slice(2, 4) + "/" + d.slice(4);
};
const toISO = (d: string) => {
  const p = d.split("/");
  return p.length === 3 ? p[2] + "-" + p[1] + "-" + p[0] : d;
};
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export default function App() {
  const [step, setStep] = useState<Step>("form");
  const [name, setName] = useState("");
  const [cpf, setCpf] = useState("");
  const [email, setEmail] = useState("");
  const [birth, setBirth] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [loadMsg, setLoadMsg] = useState("");
  const [errMsg, setErrMsg] = useState("");
  const [focused, setFocused] = useState<string | null>(null);

  function validate() {
    const e: Record<string, string> = {};
    if (!name.trim()) e.name = "Informe seu nome completo";
    if (cpf.replace(/\D/g, "").length !== 11) e.cpf = "CPF inválido";
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) e.email = "E-mail inválido";
    const dp = birth.split("/");
    if (dp.length !== 3 || dp[2]?.length !== 4) e.birth = "Data inválida (DD/MM/AAAA)";
    setErrors(e);
    return !Object.keys(e).length;
  }

  async function handleSubmit(ev: React.FormEvent) {
    ev.preventDefault();
    if (!validate()) return;

    setStep("loading");
    const cleanCpf = cpf.replace(/\D/g, "");
    const code = "eb-" + cleanCpf;
    const iso = toISO(birth);
    const parts = name.trim().split(" ");
    const firstName = parts[0];
    const lastName = parts.slice(1).join(" ");
    let token: string | null = null;

    try {
      // 1. Firebase — fire-and-forget
      setLoadMsg("Preparando seu atendimento…");
      savePatient({
        name: name.trim(),
        cpf: cleanCpf,
        email: email.trim(),
        birthDate: iso,
        code,
        createdAt: new Date().toISOString(),
        mediquoRegistered: false,
      }).catch(() => {});
      await sleep(500);

      // 2. Registrar paciente
      setLoadMsg("Configurando sua consulta…");
      await registerPatient({
        code,
        firstName,
        lastName,
        email: email.trim(),
        birthDate: iso,
        taxId: cleanCpf,
      });
      await sleep(1000);

      // 3. Autenticar
      setLoadMsg("Conectando ao médico…");
      token = await authenticatePatient(code);

      // 4. Firebase update — fire-and-forget
      if (token) {
        savePatient({
          name: name.trim(),
          cpf: cleanCpf,
          email: email.trim(),
          birthDate: iso,
          code,
          createdAt: new Date().toISOString(),
          mediquoRegistered: true,
        }).catch(() => {});
      }
    } catch (err) {
      console.warn("[app] fluxo parcial (continuando):", err);
    }

    // 5. Widget — sempre tenta abrir
    try {
      setLoadMsg("Iniciando telemedicina…");
      const ok = await initWidget(token);
      if (ok) {
        setStep("success");
      } else {
        setErrMsg("Não foi possível carregar o chat médico. Verifique sua conexão.");
        setStep("error");
      }
    } catch {
      setErrMsg("Erro ao iniciar telemedicina. Tente novamente.");
      setStep("error");
    }
  }

  const clearErr = (id: string) => setErrors((p) => { const n = { ...p }; delete n[id]; return n; });

  /* ══════════════════════ RENDER ══════════════════════ */
  return (
    <div
      style={{
        minHeight: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: "linear-gradient(135deg, #1e0a3c 0%, #2d1059 40%, #1e0a3c 100%)",
        position: "relative",
        overflow: "hidden",
        fontFamily: "'Inter',-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif",
      }}
    >
      {/* Bg orbs */}
      <div style={{ position: "absolute", inset: 0, overflow: "hidden", pointerEvents: "none" }}>
        {[
          { w: 250, l: "10%", t: "20%", d: "14s" },
          { w: 180, l: "70%", t: "10%", d: "18s" },
          { w: 300, l: "50%", t: "60%", d: "16s" },
          { w: 150, l: "80%", t: "70%", d: "20s" },
          { w: 200, l: "20%", t: "80%", d: "12s" },
        ].map((o, i) => (
          <div
            key={i}
            className="anim-float"
            style={{
              position: "absolute",
              width: o.w,
              height: o.w,
              left: o.l,
              top: o.t,
              borderRadius: "50%",
              background: "rgba(139,92,246,0.06)",
              filter: "blur(40px)",
              animationDuration: o.d,
            }}
          />
        ))}
      </div>

      {/* Card */}
      <div style={{ position: "relative", zIndex: 10, width: "100%", maxWidth: 440, margin: "32px 16px" }}>
        {/* ═══ FORM ═══ */}
        {step === "form" && (
          <div className="anim-fade-up">
            {/* Logo */}
            <div style={{ textAlign: "center", marginBottom: 32 }}>
              <div
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  justifyContent: "center",
                  width: 64,
                  height: 64,
                  borderRadius: 16,
                  background: "linear-gradient(135deg,#a855f7,#7e22ce)",
                  boxShadow: "0 8px 32px rgba(139,92,246,0.4)",
                  marginBottom: 20,
                }}
              >
                <svg width="36" height="36" fill="none" viewBox="0 0 24 24" stroke="#fff" strokeWidth={1.8}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
                </svg>
              </div>
              <h1 style={{ color: "#fff", fontSize: 24, fontWeight: 800, margin: 0 }}>
                Ebenezer <span style={{ fontWeight: 300, color: "#c4b5fd" }}>Saúde</span>
              </h1>
              <p style={{ color: "rgba(196,181,253,0.6)", fontSize: 14, marginTop: 4 }}>Telemedicina</p>
            </div>

            {/* Card branco */}
            <div
              style={{
                background: "rgba(255,255,255,0.97)",
                borderRadius: 24,
                boxShadow: "0 25px 60px rgba(0,0,0,0.3)",
                overflow: "hidden",
              }}
            >
              {/* Header roxo */}
              <div
                style={{
                  background: "linear-gradient(90deg,#7e22ce,#9333ea,#7e22ce)",
                  padding: "24px 28px",
                  position: "relative",
                  overflow: "hidden",
                }}
              >
                <div style={{ position: "absolute", top: -24, right: -24, width: 96, height: 96, borderRadius: "50%", background: "rgba(255,255,255,0.1)" }} />
                <div style={{ position: "absolute", bottom: -16, left: -16, width: 64, height: 64, borderRadius: "50%", background: "rgba(255,255,255,0.08)" }} />
                <div style={{ display: "flex", alignItems: "center", gap: 12, position: "relative" }}>
                  <div style={{ width: 44, height: 44, borderRadius: 12, background: "rgba(255,255,255,0.15)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                    <svg width="24" height="24" fill="none" viewBox="0 0 24 24" stroke="#fff" strokeWidth={1.8}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
                    </svg>
                  </div>
                  <div>
                    <div style={{ color: "#fff", fontWeight: 700, fontSize: 18 }}>Inicie sua consulta</div>
                    <div style={{ color: "#e9d5ff", fontSize: 12, marginTop: 2 }}>Preencha seus dados para começar</div>
                  </div>
                </div>
              </div>

              {/* Campos */}
              <form onSubmit={handleSubmit} style={{ padding: "24px 28px" }}>
                {([
                  { id: "name", label: "NOME COMPLETO", ph: "Digite seu nome completo", val: name, set: (v: string) => setName(v) },
                  { id: "cpf", label: "CPF", ph: "000.000.000-00", val: cpf, set: (v: string) => setCpf(fmtCPF(v)) },
                  { id: "email", label: "E-MAIL", ph: "seu@email.com", val: email, set: (v: string) => setEmail(v) },
                  { id: "birth", label: "DATA DE NASCIMENTO", ph: "DD/MM/AAAA", val: birth, set: (v: string) => setBirth(fmtDate(v)) },
                ] as const).map((f) => {
                  const hasErr = !!errors[f.id];
                  const isFoc = focused === f.id;
                  return (
                    <div key={f.id} style={{ marginBottom: 16 }}>
                      <label style={{ display: "block", fontSize: 11, fontWeight: 700, color: "#6b7280", letterSpacing: 1, marginBottom: 6 }}>
                        {f.label}
                      </label>
                      <input
                        type="text"
                        value={f.val}
                        placeholder={f.ph}
                        onChange={(e) => { f.set(e.target.value); clearErr(f.id); }}
                        onFocus={() => setFocused(f.id)}
                        onBlur={() => setFocused(null)}
                        style={{
                          width: "100%",
                          padding: "12px 16px",
                          borderRadius: 12,
                          border: `2px solid ${hasErr ? "#f87171" : isFoc ? "#a855f7" : "#e5e7eb"}`,
                          outline: "none",
                          fontSize: 15,
                          color: "#1f2937",
                          background: hasErr ? "#fef2f2" : isFoc ? "#fff" : "#f9fafb",
                          transition: "all 0.2s",
                          boxSizing: "border-box",
                          boxShadow: isFoc ? "0 0 0 3px rgba(168,85,247,0.1)" : "none",
                        }}
                      />
                      {hasErr && (
                        <p style={{ color: "#ef4444", fontSize: 12, marginTop: 4 }}>⚠ {errors[f.id]}</p>
                      )}
                    </div>
                  );
                })}

                <button
                  type="submit"
                  style={{
                    width: "100%",
                    padding: "14px",
                    borderRadius: 12,
                    border: "none",
                    background: "linear-gradient(90deg,#9333ea,#a855f7,#9333ea)",
                    backgroundSize: "200% 100%",
                    color: "#fff",
                    fontSize: 16,
                    fontWeight: 700,
                    cursor: "pointer",
                    boxShadow: "0 8px 24px rgba(139,92,246,0.35)",
                    marginTop: 8,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    gap: 10,
                    transition: "transform 0.15s, box-shadow 0.15s",
                  }}
                  onMouseDown={(e) => (e.currentTarget.style.transform = "scale(0.98)")}
                  onMouseUp={(e) => (e.currentTarget.style.transform = "scale(1)")}
                  onMouseLeave={(e) => (e.currentTarget.style.transform = "scale(1)")}
                >
                  <svg width="20" height="20" fill="none" viewBox="0 0 24 24" stroke="#fff" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
                  </svg>
                  Iniciar Consulta
                </button>

                <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 6, marginTop: 16, padding: "10px 0", background: "#f9fafb", borderRadius: 12 }}>
                  <svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="#a855f7" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                  </svg>
                  <span style={{ fontSize: 11, color: "#9ca3af" }}>Seus dados são protegidos com total sigilo médico</span>
                </div>
              </form>
            </div>

            {/* Badges */}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12, marginTop: 24 }}>
              {[
                { icon: "🩺", text: "Médicos online" },
                { icon: "🔒", text: "100% seguro" },
                { icon: "⚡", text: "Atendimento imediato" },
              ].map((b, i) => (
                <div
                  key={i}
                  style={{
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "center",
                    textAlign: "center",
                    padding: "16px 8px",
                    borderRadius: 16,
                    background: "rgba(255,255,255,0.05)",
                    border: "1px solid rgba(255,255,255,0.08)",
                  }}
                >
                  <span style={{ fontSize: 20, marginBottom: 6 }}>{b.icon}</span>
                  <span style={{ fontSize: 11, color: "rgba(196,181,253,0.7)", lineHeight: 1.3 }}>{b.text}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ═══ LOADING ═══ */}
        {step === "loading" && (
          <div className="anim-fade-up" style={{ textAlign: "center" }}>
            <div style={{ background: "rgba(255,255,255,0.97)", borderRadius: 24, boxShadow: "0 25px 60px rgba(0,0,0,0.3)", padding: "56px 32px" }}>
              <div style={{ position: "relative", width: 96, height: 96, margin: "0 auto 32px" }}>
                <div style={{ position: "absolute", inset: 0, border: "3px solid #ede9fe", borderRadius: "50%" }} />
                <div
                  style={{
                    position: "absolute", inset: 0, border: "3px solid transparent",
                    borderTopColor: "#9333ea", borderRadius: "50%",
                    animation: "spin 1s linear infinite",
                  }}
                />
                <div
                  style={{
                    position: "absolute", inset: 8, border: "3px solid transparent",
                    borderTopColor: "#c084fc", borderRadius: "50%",
                    animation: "spin 1.5s linear infinite reverse",
                  }}
                />
                <div
                  style={{
                    position: "absolute", inset: 16,
                    background: "linear-gradient(135deg,#a855f7,#7e22ce)",
                    borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center",
                    boxShadow: "0 4px 16px rgba(139,92,246,0.3)",
                  }}
                >
                  <svg width="28" height="28" fill="none" viewBox="0 0 24 24" stroke="#fff" strokeWidth={1.8}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
                  </svg>
                </div>
              </div>
              <h3 style={{ fontSize: 20, fontWeight: 700, color: "#1f2937", marginBottom: 8 }}>{loadMsg}</h3>
              <p style={{ color: "#9ca3af", fontSize: 14 }}>Aguarde um momento, por favor</p>
              <div style={{ display: "flex", justifyContent: "center", gap: 6, marginTop: 24 }}>
                {[0, 1, 2].map((i) => (
                  <div
                    key={i}
                    style={{
                      width: 8, height: 8, borderRadius: "50%", background: "#a855f7",
                      animation: `bounce 1s ${i * 0.15}s infinite`,
                    }}
                  />
                ))}
              </div>
            </div>
          </div>
        )}

        {/* ═══ SUCCESS ═══ */}
        {step === "success" && (
          <div className="anim-fade-up" style={{ textAlign: "center" }}>
            <div style={{ background: "rgba(255,255,255,0.97)", borderRadius: 24, boxShadow: "0 25px 60px rgba(0,0,0,0.3)", padding: "48px 32px" }}>
              <div style={{ width: 96, height: 96, background: "#dcfce7", borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 24px" }}>
                <svg width="48" height="48" fill="none" viewBox="0 0 24 24" stroke="#22c55e" strokeWidth={2.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                </svg>
              </div>
              <h3 style={{ fontSize: 24, fontWeight: 700, color: "#1f2937", marginBottom: 8 }}>Tudo Pronto!</h3>
              <p style={{ color: "#6b7280", fontSize: 14, marginBottom: 32, maxWidth: 300, margin: "0 auto 32px", lineHeight: 1.6 }}>
                Sua consulta foi ativada. Clique abaixo para ver os profissionais disponíveis e iniciar seu atendimento.
              </p>

              <div style={{ background: "#faf5ff", border: "1px solid #ede9fe", borderRadius: 16, padding: 20, marginBottom: 24 }}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 8, marginBottom: 8 }}>
                  <span style={{ width: 10, height: 10, borderRadius: "50%", background: "#22c55e", display: "inline-block", boxShadow: "0 0 8px rgba(34,197,94,0.4)" }} />
                  <span style={{ color: "#7e22ce", fontWeight: 600, fontSize: 14 }}>Chat Médico Ativo</span>
                </div>
                <p style={{ color: "rgba(126,34,206,0.6)", fontSize: 12 }}>Chat • Envio de fotos • Videochamada</p>
              </div>

              <button
                onClick={() => openWidget()}
                style={{
                  padding: "14px 32px", borderRadius: 12, border: "none",
                  background: "linear-gradient(90deg,#9333ea,#7e22ce)", color: "#fff",
                  fontSize: 14, fontWeight: 600, cursor: "pointer",
                  boxShadow: "0 8px 24px rgba(139,92,246,0.35)",
                  display: "inline-flex", alignItems: "center", gap: 8,
                }}
              >
                <svg width="20" height="20" fill="none" viewBox="0 0 24 24" stroke="#fff" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
                </svg>
                Ver Profissionais
              </button>
            </div>
          </div>
        )}

        {/* ═══ ERROR ═══ */}
        {step === "error" && (
          <div className="anim-fade-up" style={{ textAlign: "center" }}>
            <div style={{ background: "rgba(255,255,255,0.97)", borderRadius: 24, boxShadow: "0 25px 60px rgba(0,0,0,0.3)", padding: "48px 32px" }}>
              <div style={{ width: 80, height: 80, background: "#fee2e2", borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 24px" }}>
                <svg width="40" height="40" fill="none" viewBox="0 0 24 24" stroke="#ef4444" strokeWidth={1.8}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
                </svg>
              </div>
              <h3 style={{ fontSize: 24, fontWeight: 700, color: "#1f2937", marginBottom: 8 }}>Ops! Algo deu errado</h3>
              <p style={{ color: "#6b7280", fontSize: 14, marginBottom: 32 }}>{errMsg}</p>
              <button
                onClick={() => { setStep("form"); setErrMsg(""); }}
                style={{
                  padding: "14px 32px", borderRadius: 12, border: "none",
                  background: "linear-gradient(90deg,#9333ea,#7e22ce)", color: "#fff",
                  fontSize: 14, fontWeight: 600, cursor: "pointer",
                  boxShadow: "0 8px 24px rgba(139,92,246,0.35)",
                }}
              >
                Tentar Novamente
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Copyright */}
      <div style={{ position: "absolute", bottom: 16, left: 0, right: 0, textAlign: "center" }}>
        <p style={{ color: "rgba(139,92,246,0.25)", fontSize: 10, letterSpacing: 2, textTransform: "uppercase" }}>
          © {new Date().getFullYear()} Ebenezer Saúde
        </p>
      </div>

      {/* CSS inline para animações */}
      <style>{`
        @keyframes float {
          0%, 100% { transform: translateY(0); }
          50% { transform: translateY(-20px); }
        }
        @keyframes spin {
          to { transform: rotate(360deg); }
        }
        @keyframes bounce {
          0%, 100% { transform: translateY(0); }
          50% { transform: translateY(-8px); }
        }
        @keyframes fadeUp {
          from { opacity: 0; transform: translateY(30px); }
          to { opacity: 1; transform: translateY(0); }
        }
        .anim-float { animation: float 5s ease-in-out infinite; }
        .anim-fade-up { animation: fadeUp 0.6s ease-out both; }
        input::placeholder { color: #9ca3af; }
      `}</style>
    </div>
  );
}
