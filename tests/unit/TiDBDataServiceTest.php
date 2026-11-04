<?php

use App\Services\TiDBAuthService;
use App\Services\TiDBDataService;
use CodeIgniter\Test\CIUnitTestCase;
use CodeIgniter\Database\BaseConnection;

/**
 * @internal
 */
final class TiDBDataServiceTest extends CIUnitTestCase
{
    private BaseConnection $database;

    protected function setUp(): void
    {
        parent::setUp();
        $this->database = db_connect();
        session()->remove('tidb_user_id');

        $prefix = $this->database->getPrefix();
        $this->database->query('DROP TABLE IF EXISTS ' . $prefix . 'itens_pedido');
        $this->database->query('DROP TABLE IF EXISTS ' . $prefix . 'pedidos');
        $this->database->query('DROP TABLE IF EXISTS ' . $prefix . 'produtos');
        $this->database->query('DROP TABLE IF EXISTS ' . $prefix . 'perfis');
        $this->database->query('CREATE TABLE ' . $prefix . 'perfis (id VARCHAR(64) PRIMARY KEY, nome VARCHAR(255), email VARCHAR(255) UNIQUE, senha_hash VARCHAR(255), telefone VARCHAR(50), cep VARCHAR(20), bairro VARCHAR(100), logradouro VARCHAR(255), numero VARCHAR(50), complemento VARCHAR(100), role VARCHAR(50), avatar_url TEXT, criado_em DATETIME, created_at DATETIME, updated_at DATETIME)');
        $this->database->query('CREATE TABLE ' . $prefix . 'produtos (id VARCHAR(64) PRIMARY KEY, nome VARCHAR(255), categoria VARCHAR(50), preco DECIMAL(10,2), estoque INT, imagem_url TEXT, foto_url TEXT, descricao_curta VARCHAR(500), descricao TEXT, destaque INT, disponivel INT, ativo INT, criado_em DATETIME, created_at DATETIME, updated_at DATETIME)');
        $this->database->query('CREATE TABLE ' . $prefix . 'pedidos (id VARCHAR(64) PRIMARY KEY, numero_pedido VARCHAR(50), cliente_id VARCHAR(64), usuario_id VARCHAR(64), itens TEXT, valor_total DECIMAL(10,2), tipo_entrega VARCHAR(50), endereco_entrega TEXT, data_agendada DATE, horario_agendado VARCHAR(50), data_entrega DATE, horario_entrega VARCHAR(50), forma_pagamento VARCHAR(50), observacoes TEXT, status VARCHAR(50), pago INT, criado_em DATETIME, created_at DATETIME, updated_at DATETIME)');
        $this->database->query('CREATE TABLE ' . $prefix . 'itens_pedido (id INTEGER PRIMARY KEY AUTOINCREMENT, pedido_id VARCHAR(64), produto_id VARCHAR(64), nome VARCHAR(255), nome_produto VARCHAR(255), quantidade INT, preco DECIMAL(10,2), criado_em DATETIME, created_at DATETIME)');
    }

    protected function tearDown(): void
    {
        session()->remove('tidb_user_id');
        foreach (['itens_pedido', 'pedidos', 'produtos', 'perfis'] as $table) {
            $this->database->query('DROP TABLE IF EXISTS ' . $this->database->getPrefix() . $table);
        }
        parent::tearDown();
    }

    public function testPublicCatalogIsReadOnlyAndUsesOnlyActiveTiDBProducts(): void
    {
        $this->database->table('produtos')->insertBatch([
            ['id' => 'visible', 'nome' => 'Bolo TiDB', 'categoria' => 'bolos', 'preco' => 10, 'ativo' => 1, 'disponivel' => 1],
            ['id' => 'hidden', 'nome' => 'Produto oculto', 'categoria' => 'bolos', 'preco' => 20, 'ativo' => 0, 'disponivel' => 1],
        ]);

        $service = new TiDBDataService();
        $result = $service->databaseRequest('GET', 'produtos', ['select' => '*']);
        $insert = $service->databaseRequest('POST', 'produtos', [], ['id' => 'malicioso', 'nome' => 'Sem permissão']);

        $this->assertSame(200, $result['status']);
        $this->assertSame(['visible'], array_column($result['data'], 'id'));
        $this->assertSame(401, $insert['status']);
        $this->assertSame(2, $this->database->table('produtos')->countAllResults());
    }

    public function testTiDBSignupStoresPasswordHashAndPreventsPrivilegeEscalation(): void
    {
        $auth = new TiDBAuthService();
        $result = $auth->auth('signup', [
            'email' => 'cliente@example.com',
            'password' => 'senha-segura-123',
            'data' => ['nome' => 'Cliente', 'telefone' => '41999990000'],
        ]);

        $this->assertSame(201, $result['status']);
        $userId = $result['data']['user']['id'];
        $profile = $this->database->table('perfis')->where('id', $userId)->get()->getRowArray();
        $this->assertNotSame('senha-segura-123', $profile['senha_hash']);
        $this->assertTrue(password_verify('senha-segura-123', $profile['senha_hash']));

        $service = new TiDBDataService($auth);
        $escalation = $service->databaseRequest('PATCH', 'perfis', ['id' => 'eq.' . $userId], ['role' => 'admin']);
        $this->assertSame(400, $escalation['status']);
        $updatedProfile = $this->database->table('perfis')->where('id', $userId)->get()->getRowArray();
        $this->assertSame('cliente', $updatedProfile['role']);
    }
}
