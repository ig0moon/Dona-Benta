# Dona Benta

Site da confeitaria e padaria **Dona Benta**: vitrine de produtos, conta de cliente, carrinho, pedidos e pagamento por Pix ou cartão. Feito com CodeIgniter 4 (PHP), TiDB Cloud e Mercado Pago. Catálogo, contas, pedidos, fotos e status de pagamento são lidos e gravados somente no TiDB.

## Recursos

- **Catálogo e vitrine:** home com carrossel e produtos em destaque, catálogo por categoria e página de cada produto.
- **Contas:** cadastro e login com senha (mínimo de 8 caracteres), perfil com foto e histórico de pedidos.
- **Carrinho e pedidos:** agendamento de data e horário, acompanhamento do status.
- **Pagamentos:** Pix e cartão pelo Mercado Pago, com confirmação feita no servidor.
- **Painel administrativo (`/conta`, perfil admin):** cadastro de produtos com foto, estoque, disponibilidade e destaque.
- **Fotos otimizadas:** o navegador reduz e comprime a imagem (WebP/JPEG, até 1280 px) antes de enviar. A foto original pode ter até 15 MB; o arquivo enviado ao banco fica limitado a 4 MB.
- **Privacidade:** página de política de privacidade (`/privacidade`), em formato de modelo, que deve ser revisada por um profissional antes de ir ao ar.

## Tecnologias

| Camada | Tecnologia |
| --- | --- |
| Back-end | PHP 8.3 e CodeIgniter 4 |
| Banco de dados | TiDB Cloud (compatível com MySQL) |
| Pagamentos | Mercado Pago (Pix, cartão e webhook) |
| Front-end | HTML, CSS e JavaScript puro, consumindo a API em `/api/*` |
| Hospedagem | Docker no Render, com Apache |

## Estrutura do projeto

```text
app/
  Controllers/       Páginas (Home, Catalogo, Carrinho, Conta, Pedidos...)
    Api/             API usada pelo front-end (dados, login, upload, pagamentos)
  Services/          Acesso ao TiDB, autenticação e regras de acesso por tabela
  Database/          schema_tidb.sql e migrate_tidb.sql
  Views/             Templates das páginas
public/
  js/                Scripts do front-end (catálogo, conta, carrinho, pagamentos...)
  css/  img/         Estilos e imagens
  .htaccess          HTTPS, HSTS e cabeçalhos de segurança
Dockerfile           Imagem usada no Render
render.yaml          Blueprint do serviço no Render
DEPLOY.md            Passo a passo para colocar o site no ar
```

## Começando

- **Colocar no ar (TiDB Cloud, Render, domínio e Mercado Pago):** siga o [DEPLOY.md](DEPLOY.md).
- **Rodar no seu computador:** veja [Rodar localmente](#rodar-localmente).

## Segurança

- Senhas guardadas com hash; não existe senha administrativa padrão.
- Limite de requisições por IP e bloqueio de chamadas de outras origens nas rotas sensíveis.
- Webhook do Mercado Pago validado por assinatura; sem `MP_WEBHOOK_SECRET` configurado, as notificações são recusadas.
- Em produção, pedidos só são marcados como pagos depois da confirmação no Mercado Pago. A simulação de aprovação existe apenas para administradores em ambiente de teste (token `TEST-`).
- HTTPS forçado, HSTS e cabeçalhos de segurança configurados em `public/.htaccess`.
- A página de diagnóstico `/teste-banco` só abre para administradores em produção.
- Nenhuma credencial vai para o Git: tudo fica nas variáveis de ambiente do Render.

## Deploy no Render

1. Crie um **Web Service** ligado ao repositório e selecione o runtime **Docker**. O Render usará o `Dockerfile` da raiz.
2. Cadastre as variáveis abaixo em **Environment** no Render. Não coloque esses valores no JavaScript nem os envie ao Git.

| Variável | Uso |
| --- | --- |
| `CI_ENVIRONMENT` | Use `production`. |
| `APP_BASE_URL` | Opcional. URL pública do serviço, incluindo `https://` e a barra final. O Render usa automaticamente `RENDER_EXTERNAL_URL` quando essa variável não está definida. Configure `APP_BASE_URL` somente se usar um domínio personalizado. |
| `DB_HOST` | Host SQL do TiDB Cloud. |
| `DB_NAME` | Nome do banco no TiDB, normalmente `dona_benta`. |
| `DB_USER` | Usuário SQL do TiDB. |
| `DB_PASS` | Senha SQL do TiDB. |
| `DB_PORT` | Porta indicada pelo TiDB Cloud. |
| `DB_ENCRYPT` | Use `true` para habilitar TLS, conforme exigido pelo TiDB Cloud. |
| `DB_DRIVER` | Opcional; use `MySQLi` (padrão). |
| `DB_PREFIX` | Opcional; deixe vazio se as tabelas não tiverem prefixo. |
| `MP_ACCESS_TOKEN` | Token privado de acesso do Mercado Pago. |
| `WEBHOOK_URL` | URL pública completa de `https://<dominio>/api/webhook/mercadopago`. |
| `MP_WEBHOOK_SECRET` | Obrigatória. Assinatura secreta do webhook (painel do Mercado Pago → Webhooks). Sem ela, todas as notificações do webhook são recusadas. |
| `TRUST_TRUE_CLIENT_IP` | Use `true` no Render. Faz o limite de requisições usar o IP real do visitante (cabeçalho `True-Client-IP`) em vez do IP do proxy. |
| `LOJA_RAZAO_SOCIAL` | Razão social da empresa, exibida no rodapé, nos Termos e na Política de Privacidade (exigência do Decreto 7.962/2013). |
| `LOJA_CNPJ` | CNPJ da empresa, no formato `00.000.000/0000-00`. Enquanto estiver vazio, a linha do CNPJ não aparece. |
| `LOJA_ENDERECO` | Opcional. Endereço completo da loja (padrão: Rua Padre Anacleto, 1168 - Nova Rússia, Ponta Grossa - PR). |
| `LOJA_EMAIL` | Opcional. E-mail de atendimento e de privacidade (padrão: `contato@donabenta.com.br`). Precisa ser uma caixa que alguém leia. |
| `LOJA_WHATSAPP` | Opcional. WhatsApp de atendimento exibido nos textos legais (padrão: `(42) 99982-3994`). |

O Render define `PORT` automaticamente. Não configure um `.env` com credenciais no repositório. A chave `MP_PUBLIC_KEY` não é necessária: pagamentos com cartão usam o checkout hospedado do Mercado Pago.

### Pagamentos

Pedidos de Pix e cartão só são marcados como pagos depois que o servidor confirma no Mercado Pago a aprovação, a referência do pedido, o valor e a moeda BRL. Configure `WEBHOOK_URL` para `https://<dominio>/api/webhook/mercadopago`; o retorno do checkout também consulta o Mercado Pago, então o webhook não é a única forma de atualizar o status. “Pagar na Entrega / Retirada” permanece não pago até a confirmação manual, por projeto.

### Diagnóstico do TiDB

Em produção, a página `/teste-banco` só abre para administradores logados (os demais recebem 404). Ela executa `SELECT 1` para verificar a conexão configurada, sem alterar dados. Os nomes `DB_HOST`, `DB_NAME`, `DB_USER`, `DB_PASS`, `DB_PORT` e `DB_ENCRYPT` também são aceitos como estão no Render. `DB_ENCRYPT=true` habilita a opção SSL do MySQLi usada pelo TiDB Cloud. Os nomes legados `database.default.*` continuam aceitos.

Execute `app/Database/schema_tidb.sql` no banco TiDB para criar as tabelas e inserir os produtos iniciais. Para um banco que já existe, execute uma vez `app/Database/migrate_tidb.sql` para adicionar hash de senha e armazenamento de imagens. Contas/senhas que existiam em outro provedor não são copiadas automaticamente; cada cliente precisa criar uma conta no TiDB.

### LGPD e direitos do consumidor

- **Política de Privacidade** (`/privacidade`) e **Termos e Condições** (`/termos`), com links no rodapé, no cadastro e no checkout.
- **Minha conta → Meus dados → Privacidade e dados:** o cliente baixa uma cópia dos dados (`GET /api/conta/meus-dados`) e exclui a conta (`POST /api/conta/excluir`, com senha). Pedidos pagos ou concluídos são mantidos sem endereço e observações (obrigação fiscal); pedidos não pagos, perfil e fotos são apagados. Contas de administrador não podem ser excluídas pelo site.
- **Fotos de perfil:** ao trocar ou remover a foto, a anterior é apagada do banco.
- **Registros de acesso** (Marco Civil da Internet, art. 15): login e cadastro gravam data, hora e IP na tabela `registros_acesso`, apagados após 6 meses. Em banco existente, rode o trecho de `registros_acesso` do `migrate_tidb.sql`; sem a tabela o login continua funcionando, mas o registro não é gravado (fica um erro no log).

Para conceder acesso administrativo, crie a conta pelo site e então altere o perfil no TiDB: `UPDATE perfis SET role = 'admin' WHERE email = 'seu-email';`. Não existe senha administrativa padrão.

## Rodar localmente

Requisitos: PHP 8.2+, Composer e extensões PHP `curl`, `intl`, `mbstring`, `mysqli` e `pdo_mysql`.

```powershell
composer install
Copy-Item env .env
```

Configure no `.env` as variáveis do TiDB e do Mercado Pago listadas na tabela acima e inicie o servidor:

```powershell
php spark serve
```

Depois abra `http://localhost:8080`.

## Testes

```powershell
vendor\bin\phpunit.bat --no-coverage
```

## Problemas comuns

| Sintoma | O que verificar |
| --- | --- |
| Produtos em destaque não aparecem | Confirme que o produto está marcado como destaque, disponível e ativo no painel. |
| Login ou carrinho respondem 403 | `APP_BASE_URL` precisa ser o domínio final, com `https://` e barra no fim. |
| Erro de conexão com o banco | Abra `/teste-banco` logado como admin e confira `DB_*` e `DB_ENCRYPT=true`. |
| Pagamento aprovado não atualiza o pedido | Confira `WEBHOOK_URL` e `MP_WEBHOOK_SECRET` no Render e no painel do Mercado Pago. |
| Foto não sobe | Use JPG, PNG ou WEBP de até 15 MB; ela é reduzida automaticamente antes do envio. |
| Sessões caem a cada deploy | Comportamento esperado: as sessões ficam no disco do serviço, que é recriado a cada deploy. |

## Domínio próprio

1. No Render, abra o serviço → **Settings → Custom Domains** e adicione o domínio (e o `www`). Aponte o DNS como o Render indicar; o certificado HTTPS é emitido automaticamente.
2. Troque `APP_BASE_URL` para o domínio final com `https://` e barra no fim, e `WEBHOOK_URL` para `https://<dominio>/api/webhook/mercadopago`. Sem isso o login e o carrinho respondem 403.
3. No painel do Mercado Pago, atualize a URL do webhook e copie a assinatura secreta para `MP_WEBHOOK_SECRET`.
4. O redirecionamento para HTTPS e o cabeçalho HSTS ficam em `public/.htaccess` (usam o `X-Forwarded-Proto` do Render).
