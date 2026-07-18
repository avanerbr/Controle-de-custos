# Contas Michael & Jamille

Sistema de controle de despesas (Casa + Empresa) com:

- Categorias criadas por vocês (fixas mensais ou gastos avulsos/diários)
- Lançamento de despesas mês a mês, com status de pago/pendente
- Dashboard com evolução mensal (gráfico de linha), breakdown por categoria (gráfico de barras)
  e alertas quando uma categoria fica acima da média histórica
- Login para 2 usuários (Michael e Jamille), dados compartilhados entre os dois
- Banco de dados no Supabase (Postgres), deploy no Coolify via Docker

---

## 1. Criar o projeto no Supabase

1. Acesse [supabase.com](https://supabase.com) e crie um novo projeto (grátis).
2. Depois que o projeto for criado, vá em **SQL Editor**.
3. Cole o conteúdo do arquivo [`supabase/migrations/0001_init.sql`](./supabase/migrations/0001_init.sql)
   e clique em **Run**. Isso cria as tabelas `categories` e `expenses`, as permissões (RLS) e já
   popula categorias iniciais parecidas com as da sua planilha.
4. Vá em **Authentication → Providers → Email** e desative **"Allow new users to sign up"**
   (assim ninguém além de vocês dois consegue criar conta).
5. Vá em **Authentication → Users → Add user** e crie manualmente os 2 usuários:
   - Michael (avanerbr@gmail.com ou o e-mail que preferir)
   - Jamille
   Marque **Auto Confirm User** para não precisar de e-mail de confirmação.
6. Vá em **Project Settings → API** e copie:
   - `Project URL` → vai virar `NEXT_PUBLIC_SUPABASE_URL`
   - `anon public key` → vai virar `NEXT_PUBLIC_SUPABASE_ANON_KEY`

---

## 2. Rodar localmente (opcional, para testar antes de subir)

```bash
cp .env.example .env.local
# edite .env.local com a URL e a anon key do Supabase

npm install
npm run dev
```

Acesse `http://localhost:3000`, faça login com um dos 2 usuários criados no Supabase.

---

## 3. Subir para o Git

```bash
cd expense-tracker
git init
git add .
git commit -m "Sistema de despesas Michael & Jamille"
```

Crie um repositório vazio no GitHub/GitLab e:

```bash
git remote add origin <url-do-seu-repositorio>
git branch -M main
git push -u origin main
```

O `.gitignore` já exclui `node_modules`, `.next` e `.env*`, então suas chaves não vão para o Git.

---

## 4. Deploy no Coolify

1. No Coolify, crie um novo **Resource → Application** e aponte para o repositório Git que você
   acabou de criar (dê permissão de acesso se for privado).
2. Em **Build Pack**, escolha **Dockerfile** (o repositório já tem um `Dockerfile` pronto na raiz).
3. Em **Build Variables** (variáveis disponíveis durante o build — importante, não é a mesma coisa
   que "Environment Variables" runtime), adicione:
   - `NEXT_PUBLIC_SUPABASE_URL` = a URL do seu projeto Supabase
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY` = a anon key do seu projeto Supabase

   > Essas variáveis começam com `NEXT_PUBLIC_` e o Next.js as "grava" dentro do código no momento
   > do build — por isso precisam estar disponíveis como *build args*, não só em runtime. O
   > `Dockerfile` já está preparado para receber `NEXT_PUBLIC_SUPABASE_URL` e
   > `NEXT_PUBLIC_SUPABASE_ANON_KEY` como `ARG`.
4. Defina a porta interna do container como `3000`.
5. Configure o domínio (ou subdomínio) que o Coolify vai usar e ative HTTPS automático.
6. Clique em **Deploy**. O Coolify vai puxar o repositório, buildar a imagem Docker e subir o
   container.
7. Depois de publicado, acesse a URL, faça login com o usuário do Michael ou da Jamille e comece
   a lançar as despesas.

### Atualizações futuras

Sempre que quiser mudar algo no sistema, edite o código, dê `git push`, e configure no Coolify
(**Application → Webhooks/Deploy**) para redeployar automaticamente a cada push — ou clique em
**Redeploy** manualmente.

---

## 5. Como usar no dia a dia

- **Categorias**: crie as categorias que fizerem sentido pra vocês (ex.: Farmácia, Combustível,
  Mercado), marcando se são "conta fixa mensal" ou "gasto avulso/diário". Separe por Casa ou
  Empresa.
- **Lançar despesas**: todo mês (ou todo dia, para gastos avulsos), adicione o valor gasto em cada
  categoria, marque como pago quando quitar, e use o campo de observação para anotar onde pagar.
- **Dashboard**: acompanhe a evolução dos últimos 12 meses, veja o breakdown por categoria do mês
  selecionado, e fique de olho nos alertas — eles aparecem quando uma categoria gastou mais de 20%
  acima da média dos últimos meses, ajudando a identificar onde está o problema.

---

## Estrutura do projeto

```
expense-tracker/
├── Dockerfile                     # build para o Coolify
├── supabase/migrations/0001_init.sql   # schema do banco (rodar no SQL Editor do Supabase)
├── src/
│   ├── app/
│   │   ├── login/                 # tela de login
│   │   └── (app)/
│   │       ├── dashboard/         # gráficos + alertas
│   │       ├── despesas/          # lançamento de despesas
│   │       └── categorias/        # CRUD de categorias
│   ├── components/                # Nav, gráficos, seletor de mês
│   └── lib/supabase/              # clientes Supabase (browser/server/middleware)
```
