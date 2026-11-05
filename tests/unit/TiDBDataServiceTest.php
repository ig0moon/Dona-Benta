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

    public function testAdminCanCreateProductWithoutProvidingAnId(): void
    {
        $adminId = bin2hex(random_bytes(16));
        $this->database->table('perfis')->insert([
            'id' => $adminId,
            'nome' => 'Igor',
            'email' => 'igor@admin.com',
            'role' => 'admin',
        ]);
        session()->set('tidb_user_id', $adminId);

        $result = (new TiDBDataService())->databaseRequest('POST', 'produtos', [], [
            'nome' => 'Produto de teste',
            'categoria' => 'bolos',
            'preco' => 25.50,
            'estoque' => 10,
            'imagem_url' => 'https://example.com/bolo.jpg',
            'descricao_curta' => 'Descrição curta',
            'descricao' => 'Descrição completa',
            'disponivel' => true,
            'destaque' => false,
        ]);

        $this->assertSame(201, $result['status']);
        $this->assertMatchesRegularExpression('/^[a-f0-9]{32}$/', $result['data'][0]['id']);
        $this->assertSame('Produto de teste', $this->database->table('produtos')
            ->where('id', $result['data'][0]['id'])
            ->get()
            ->getRowArray()['nome']);

        $productId = $result['data'][0]['id'];
        $service = new TiDBDataService();
        $read = $service->databaseRequest('GET', 'produtos', [
            'select' => '*',
            'id' => 'eq.' . $productId,
        ]);
        $this->assertSame(200, $read['status']);
        $this->assertSame('Produto de teste', $read['data'][0]['nome']);
        $this->assertSame('Descrição curta', $read['data'][0]['descricao_curta']);
        $this->assertSame(25.50, (float) $read['data'][0]['preco']);

        $update = $service->databaseRequest('PATCH', 'produtos', [
            'id' => 'eq.' . $productId,
        ], [
            'descricao_curta' => 'Descrição editada',
            'disponivel' => false,
        ]);
        $this->assertSame(200, $update['status']);

        $updated = $service->databaseRequest('GET', 'produtos', [
            'select' => '*',
            'id' => 'eq.' . $productId,
        ]);
        $this->assertSame('Descrição editada', $updated['data'][0]['descricao_curta']);
        $this->assertSame(0, (int) $updated['data'][0]['disponivel']);
    }
}
