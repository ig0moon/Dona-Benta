# Dona Benta

Site da confeitaria Dona Benta, construído com CodeIgniter 4, PHP e Supabase. O navegador conversa somente com o backend do próprio site; credenciais do Supabase e do Mercado Pago são lidas pelo PHP no servidor.

## Deploy no Render

1. Crie um **Web Service** ligado ao repositório e selecione o runtime **Docker**. O Render usará o `Dockerfile` da raiz.
2. Cadastre as variáveis abaixo em **Environment** no Render. Não coloque esses valores no JavaScript nem os envie ao Git.

| Variável | Uso |
| --- | --- |
| `CI_ENVIRONMENT` | Use `production`. |
| `APP_BASE_URL` | URL pública do serviço, incluindo `https://` e a barra final. |
| `SUPABASE_URL` | URL do projeto Supabase. |
| `SUPABASE_ANON_KEY` | Chave pública do Supabase, usada somente no servidor. |
| `SUPABASE_SERVICE_ROLE_KEY` | Acesso administrativo usado pelo servidor para atualizar pedidos via webhook. Mantenha estritamente privada. |
| `MP_ACCESS_TOKEN` | Token privado de acesso do Mercado Pago. |
| `WEBHOOK_URL` | URL pública completa de `https://<dominio>/api/webhook/mercadopago`. |

O Render define `PORT` automaticamente. Não configure um `.env` com credenciais no repositório. A chave `MP_PUBLIC_KEY` não é necessária: pagamentos com cartão usam o checkout hospedado do Mercado Pago.

No Supabase, configure a URL pública do site como URL autorizada para autenticação e recuperação de senha. Mantenha ativas as políticas RLS das tabelas e buckets, pois os endpoints do backend encaminham as operações com a sessão do usuário.

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
