# Dona Benta

Site da confeitaria Dona Benta, construído com CodeIgniter 4, PHP e TiDB Cloud. Catálogo, contas, pedidos, arquivos e status de pagamento são lidos e gravados somente no TiDB.

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

O Render define `PORT` automaticamente. Não configure um `.env` com credenciais no repositório. A chave `MP_PUBLIC_KEY` não é necessária: pagamentos com cartão usam o checkout hospedado do Mercado Pago.

### Pagamentos

Pedidos de Pix e cartão só são marcados como pagos depois que o servidor confirma no Mercado Pago a aprovação, a referência do pedido, o valor e a moeda BRL. Configure `WEBHOOK_URL` para `https://<dominio>/api/webhook/mercadopago`; o retorno do checkout também consulta o Mercado Pago, então o webhook não é a única forma de atualizar o status. “Pagar na Entrega / Retirada” permanece não pago até a confirmação manual, por projeto.

### Diagnóstico do TiDB

A página `/teste-banco` executa `SELECT 1` para verificar a conexão configurada, sem alterar dados. Os nomes `DB_HOST`, `DB_NAME`, `DB_USER`, `DB_PASS`, `DB_PORT` e `DB_ENCRYPT` também são aceitos como estão no Render. `DB_ENCRYPT=true` habilita a opção SSL do MySQLi usada pelo TiDB Cloud. Os nomes legados `database.default.*` continuam aceitos.

Execute `app/Database/schema_tidb.sql` no banco TiDB para criar as tabelas e inserir os produtos iniciais. Para um banco que já existe, execute uma vez `app/Database/migrate_tidb.sql` para adicionar hash de senha e armazenamento de imagens. Contas/senhas que existiam em outro provedor não são copiadas automaticamente; cada cliente precisa criar uma conta no TiDB.

Para conceder acesso administrativo, crie a conta pelo site e então altere o perfil no TiDB: `UPDATE perfis SET role = 'admin' WHERE email = 'seu-email';`. Não existe senha administrativa padrão.

## Rodar localmente

Requisitos: PHP 8.2+, Composer e extensões PHP `curl`, `intl`, `mbstring`, `mysqli` e `pdo_mysql`.

```powershell
composer install
Copy-Item env .env
```

Configure no `.env` as variáveis do TiDB e do Mercado Pago listadas acima e inicie o servidor:

```powershell
php spark serve
```

## Testes

```powershell
vendor\bin\phpunit.bat --no-coverage
```
