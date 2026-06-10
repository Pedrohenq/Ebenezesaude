# Ebenezer Saúde - Configuração

## 🚀 Configuração do Cloudflare Worker (OBRIGATÓRIO para produção)

O Cloudflare Worker é um proxy gratuito que resolve o problema de CORS.
Leva apenas **5 minutos** para configurar.

### Passo a Passo:

#### 1. Criar conta no Cloudflare (grátis)
- Acesse: https://dash.cloudflare.com/sign-up
- Crie uma conta gratuita

#### 2. Criar o Worker
- No painel, clique em **"Workers & Pages"** no menu lateral
- Clique em **"Create Application"**
- Selecione **"Create Worker"**
- Dê um nome (ex: `ebenezer-api`)
- Clique em **"Deploy"**

#### 3. Editar o código do Worker
- Após o deploy, clique em **"Edit Code"**
- Apague todo o código existente
- Copie e cole o conteúdo do arquivo `cloudflare-worker/worker.js`
- Clique em **"Save and Deploy"**

#### 4. Copiar a URL do Worker
- Após salvar, você verá a URL do worker
- Ela terá este formato: `https://ebenezer-api.seuusuario.workers.dev`
- Copie essa URL

#### 5. Configurar no projeto
- Abra o arquivo `src/lib/mediquo.ts`
- Encontre a linha `const WORKER_URL = "";`
- Cole a URL do seu worker entre as aspas
- Exemplo: `const WORKER_URL = "https://ebenezer-api.seuusuario.workers.dev";`

#### 6. Pronto! 🎉
- Faça o build novamente: `npm run build`
- Teste a aplicação

---

## 🔒 Segurança

### Protegendo as chaves de API

As chaves da API MediQuo estão no código do Worker. Para maior segurança em produção:

1. No painel do Cloudflare Workers, vá em **Settings** > **Variables**
2. Adicione as variáveis de ambiente:
   - `API_KEY`: `7T61g4NyEUhanFU6`
   - `SECRET_KEY`: `qOqEPgrYM4Wy2Ml08eskZ2QsFj8v9Op6GCSIF7xltlj1UmzW50uVb8vcSaHk2eZI`
3. No código do worker, substitua as constantes por `env.API_KEY` e `env.SECRET_KEY`

### Restringindo origens

No arquivo `worker.js`, edite o array `ALLOWED_ORIGINS` para incluir apenas seus domínios de produção:

```javascript
const ALLOWED_ORIGINS = [
  "https://seusite.com.br",
  "https://www.seusite.com.br",
];
```

---

## 🔥 Firebase

As credenciais do Firebase no arquivo `src/lib/firebase.ts` são de exemplo.
Para usar seu próprio Firebase:

1. Acesse: https://console.firebase.google.com/
2. Crie um projeto
3. Vá em **Configurações do projeto** > **Seus apps** > **Web**
4. Copie as credenciais e cole em `src/lib/firebase.ts`
5. No Firestore, crie uma collection chamada `patients`

---

## 📞 Suporte

Em caso de dúvidas sobre a API MediQuo:
- Documentação: https://developer.mediquo.com/docs/introduction/
- Widget Web: https://developer.mediquo.com/docs/sdk/widget/introduction/
