export interface PatientData {
  name: string;
  cpf: string;
  email: string;
  birthDate: string;
  code: string;
  createdAt: string;
  mediquoRegistered: boolean;
}

/**
 * Salva paciente no Firebase Firestore.
 * Carrega Firebase LAZY (só quando precisar) para não travar a app.
 * Se falhar por qualquer motivo, retorna silenciosamente.
 */
export async function savePatient(patient: PatientData): Promise<string> {
  // Timeout de 5s — se Firebase travar, segue a vida
  return Promise.race([
    _doSave(patient),
    new Promise<string>((res) =>
      setTimeout(() => {
        console.warn("[firebase] timeout — pulando salvamento");
        res(patient.code);
      }, 5000)
    ),
  ]);
}

async function _doSave(patient: PatientData): Promise<string> {
  try {
    // Import dinâmico — só baixa Firebase se chegar aqui
    const { initializeApp } = await import("firebase/app");
    const {
      getFirestore,
      collection,
      addDoc,
      query,
      where,
      getDocs,
      updateDoc,
      doc,
    } = await import("firebase/firestore");

    const firebaseConfig = {
      apiKey: "AIzaSyCN9pxJ_ua3CbDJMmhFFi6t2B64LGpjSqw",
      authDomain: "ebenezer-saude.firebaseapp.com",
      projectId: "ebenezer-saude",
      storageBucket: "ebenezer-saude.firebasestorage.app",
      messagingSenderId: "975637008498",
      appId: "1:975637008498:web:0b5b3a3db4d3a2e9f1c2d3",
    };

    // Reutiliza app se já existir
    let app;
    try {
      const { getApp } = await import("firebase/app");
      app = getApp();
    } catch {
      app = initializeApp(firebaseConfig);
    }

    const db = getFirestore(app);

    const q = query(
      collection(db, "patients"),
      where("cpf", "==", patient.cpf)
    );
    const snap = await getDocs(q);

    if (!snap.empty) {
      const d = snap.docs[0];
      await updateDoc(doc(db, "patients", d.id), {
        ...patient,
        updatedAt: new Date().toISOString(),
      });
      console.log("[firebase] paciente atualizado ✓");
      return d.data().code || patient.code;
    }

    await addDoc(collection(db, "patients"), {
      ...patient,
      createdAt: new Date().toISOString(),
    });
    console.log("[firebase] paciente salvo ✓");
    return patient.code;
  } catch (err) {
    console.warn("[firebase] erro (ignorado):", err);
    return patient.code;
  }
}
