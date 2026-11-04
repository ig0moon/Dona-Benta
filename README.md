# Dona Benta

Site da confeitaria Dona Benta, construído com CodeIgniter 4, PHP e Supabase. O navegador conversa somente com o backend do próprio site; credenciais do Supabase e do Mercado Pago são lidas pelo PHP no servidor.

## Deploy no Render

1. Crie um **Web Service** ligado ao repositório e selecione o runtime **Docker**. O Render usará o `Dockerfile` da raiz.
2. Cadastre as variáveis abaixo em **Environment** no Render. Não coloque esses valores no JavaScript nem os envie ao Git.

| Variável | Uso |
| --- | --- |
| `CI_ENVIRONMENT` | Use `production`. |
| `APP_BASE_URL` | Opcional. URL pública do serviço, incluindo `https://` e a barra final. O Render usa automaticamente `RENDER_EXTERNAL_URL` quando essa variável não está definida. Configure `APP_BASE_URL` somente se usar um domínio personalizado. |
| `SUPABASE_URL` | URL do projeto Supabase. |
| `SUPABASE_ANON_KEY` | Chave pública do Supabase, usada somente no servidor. |
| `SUPABASE_SERVICE_ROLE_KEY` | Acesso administrativo usado pelo servidor para atualizar pedidos via webhook. Mantenha estritamente privada. |
| `MP_ACCESS_TOKEN` | Token privado de acesso do Mercado Pago. |
| `WEBHOOK_URL` | URL pública completa de `https://<dominio>/api/webhook/mercadopago`. |

O Render define `PORT` automaticamente. Não configure um `.env` com credenciais no repositório. A chave `MP_PUBLIC_KEY` não é necessária: pagamentos com cartão usam o checkout hospedado do Mercado Pago.

No Supabase, configure a URL pública do site como URL autorizada para autenticação e recuperação de senha. Mantenha ativas as políticas RLS das tabelas e buckets, pois os endpoints do backend encaminham as operações com a sessão do usuário.

### Diagnóstico do TiDB

A página `/teste-banco` executa `SELECT 1` para verificar a conexão configurada, sem alterar dados. Configure no Render as variáveis `database.default.hostname`, `database.default.database`, `database.default.username`, `database.default.password` e `database.default.port` usando os dados de conexão do TiDB Cloud. Use `database.default.DBDriver=MySQLi` e habilite `database.default.encrypt=true` se o provedor exigir TLS.

O catálogo do site atualmente consulta o Supabase; o teste do TiDB não transfere nem altera essa integração. Para carregar produtos do TiDB, será necessário implementar essa integração separadamente.

## Rodar localmente

Requisitos: PHP 8.2+, Composer e extensões PHP `curl`, `intl`, `mbstring`, `mysqli` e `pdo_mysql`.

```powershell
composer install
Copy-Item env .env
```

Configure no `.env` as mesmas variáveis de integração listadas acima e inicie o servidor:

```powershell
php spark serve
```

## Testes

```powershell
vendor\bin\phpunit.bat --no-coverage
```
