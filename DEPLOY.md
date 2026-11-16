# Passo a passo para colocar o Dona Benta no ar

Ordem recomendada: **1) banco → 2) site no Render (com o endereço `onrender.com`) → 3) testes → 4) domínio → 5) Mercado Pago em produção**.
Só depois de tudo funcionar no endereço do Render vale apontar o domínio.

## 1. Banco de dados (TiDB Cloud Starter)

1. Crie a conta em tidbcloud.com e clique em **Create → Starter** (compatível com MySQL). Escolha uma região na mesma região/continente do Render.
2. Em **Settings → Spending Limit**, defina um limite mensal pequeno (exige cartão). Sem limite, ao acabar a cota gratuita o banco **recusa novas conexões** e o site cai.
3. Clique em **Connect**, gere a senha e anote: host, porta (normalmente `4000`), usuário e senha.
4. Abra o **SQL Editor**, cole todo o conteúdo de `app/Database/schema_tidb.sql` e execute (ele cria o banco `dona_benta`, as tabelas e alguns produtos de exemplo). O `migrate_tidb.sql` é só para bancos antigos: **não** rode.

## 2. Site no Render

1. Crie a conta em render.com e conecte o GitHub.
2. **New → Blueprint** → escolha o repositório `Dona-Benta`. O Render lê o `render.yaml` e pede os valores secretos.
3. Preencha as variáveis:

| Variável | Valor |
| --- | --- |
| `DB_HOST`, `DB_PORT`, `DB_NAME`, `DB_USER`, `DB_PASS` | Dados do passo 1 (`DB_NAME` = `dona_benta`) |
| `APP_BASE_URL` | Por enquanto `https://dona-benta.onrender.com/` (use o endereço que o Render mostrar). No passo 4 troque pelo domínio. |
| `WEBHOOK_URL` | `<APP_BASE_URL>api/webhook/mercadopago` |
| `MP_ACCESS_TOKEN` | Pode começar com o token de **teste** (`TEST-...`) |
| `MP_WEBHOOK_SECRET` | Assinatura secreta do webhook (passo 5). Pode ficar para depois. |

4. Aguarde o primeiro deploy terminar (a URL abre a home).

## 3. Testes antes do domínio

- Crie uma conta pelo site, faça login e saia.
- No TiDB (SQL Editor), torne a sua conta admin:
  `UPDATE perfis SET role = 'admin' WHERE email = 'seu-email';`
  Entre de novo e confira o painel administrativo. Abra `/teste-banco` logado como admin: deve mostrar "sucesso".
- Cadastre um produto com foto (limite de 4 MB por imagem), faça um pedido de teste e acompanhe o status no painel.
- Troque o número de WhatsApp e os textos de contato, se ainda forem de exemplo, e apague os produtos de exemplo.

## 4. Domínio

1. Registre o domínio (`.com.br` exige CPF ou CNPJ) no Registro.br ou em outro registrador.
2. No Render: serviço → **Settings → Custom Domains** → adicione `seudominio.com.br` e `www.seudominio.com.br`. O Render mostra os registros de DNS a criar; crie-os no painel de DNS do seu registrador. O certificado HTTPS é emitido sozinho depois que o DNS propaga.
3. Troque `APP_BASE_URL` para `https://www.seudominio.com.br/` (ou o endereço principal que você escolher) e `WEBHOOK_URL` para `https://www.seudominio.com.br/api/webhook/mercadopago`. **Sem isso login e carrinho respondem 403.**
4. Teste o site pelo domínio novo (login, carrinho, pedido).

## 5. Mercado Pago em produção

1. No painel de desenvolvedores do Mercado Pago, ative as credenciais de produção e copie o **Access Token** (`APP_USR-...`) para `MP_ACCESS_TOKEN` no Render.
2. Em **Webhooks**, cadastre a URL `https://<dominio>/api/webhook/mercadopago` com o evento de pagamentos. Copie a **assinatura secreta** para `MP_WEBHOOK_SECRET`.
3. Faça um pagamento real de valor baixo (Pix) e confirme que o pedido muda para pago.

## Manutenção

- **Backup:** exporte o banco periodicamente (por exemplo com `mysqldump` usando os dados de conexão do TiDB) e guarde fora do Render.
- **Login de clientes:** a recuperação de senha por e-mail ainda não existe. Enquanto isso, redefina senhas manualmente no banco.
- **Sessões:** ficam em disco do Render e são perdidas a cada novo deploy; clientes logados precisam entrar de novo.
- **Segredos:** nunca coloque senhas ou tokens no código nem no GitHub; use só as variáveis do Render.
