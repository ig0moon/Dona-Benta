<?php

namespace App\Controllers;

use Throwable;

class DatabaseTest extends BaseController
{
    public function index(): string
    {
        return $this->renderPage();
    }

    public function test(): string
    {
        $database = config('Database')->default;
        $missing = [];

        foreach (['hostname', 'database', 'username'] as $key) {
            if (trim((string) ($database[$key] ?? '')) === '') {
                $missing[] = 'database.default.' . $key;
            }
        }

        if ($missing !== []) {
            return $this->renderPage([
                'status'  => 'missing',
                'message' => 'Faltam configurações obrigatórias para conectar ao banco.',
                'missing' => $missing,
            ]);
        }

        $connection = null;
        try {
            $connection = db_connect('default', false);
            $result = $connection->query('SELECT 1 AS connection_ok');
            $row = $result->getRowArray();

            if ((int) ($row['connection_ok'] ?? 0) !== 1) {
                throw new \RuntimeException('A consulta de teste não retornou o resultado esperado.');
            }
        } catch (Throwable $exception) {
            if ($connection !== null) {
                $connection->close();
            }
            log_message(
                'error',
                'Falha no diagnóstico do banco ({exception}, código {code}).',
                ['exception' => $exception::class, 'code' => (string) $exception->getCode()],
            );

            return $this->renderPage([
                'status'  => 'failure',
                'message' => 'Não foi possível conectar ou executar a consulta. Confira os dados do banco e o TLS no Render.',
            ]);
        }

        $missingTables = [];
        foreach (['perfis', 'produtos', 'pedidos', 'itens_pedido', 'arquivos'] as $table) {
            try {
                $connection->table($table)->countAllResults();
            } catch (Throwable $exception) {
                $missingTables[] = $table;
            }
        }

        if ($missingTables !== []) {
            $connection->close();
            return $this->renderPage([
                'status'  => 'schema_missing',
                'message' => 'O TiDB respondeu, mas falta importar o esquema da loja.',
                'missing' => $missingTables,
            ]);
        }

        try {
            $connection->query('SELECT senha_hash FROM perfis LIMIT 0');
        } catch (Throwable $exception) {
            $connection->close();
            return $this->renderPage([
                'status'  => 'migration_missing',
                'message' => 'O TiDB está conectado, mas falta a migração de contas e imagens.',
                'missing' => ['app/Database/migrate_tidb.sql'],
            ]);
        }

        $connection->close();
        return $this->renderPage([
            'status'  => 'success',
            'message' => 'Conexão, tabelas e colunas necessárias verificadas com sucesso no TiDB.',
        ]);
    }

    private function renderPage(array $diagnostic = []): string
    {
        $this->response->setHeader('Cache-Control', 'no-store');
        $this->response->setHeader('X-Robots-Tag', 'noindex, nofollow');

        return view('diagnostico_banco/index', [
            'titulo'      => 'Teste de conexão com o banco — Dona Benta',
            'descricao'   => 'Diagnóstico de conexão com o banco de dados.',
            'pagina'      => 'diagnostico-banco',
            'diagnostic'  => $diagnostic,
        ]);
    }
}
