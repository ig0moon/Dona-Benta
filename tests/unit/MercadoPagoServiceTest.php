<?php

use App\Services\MercadoPagoService;
use CodeIgniter\Database\BaseConnection;
use CodeIgniter\Test\CIUnitTestCase;

/**
 * @internal
 */
final class MercadoPagoServiceTest extends CIUnitTestCase
{
    private BaseConnection $database;
    private const ORDER_ID = '00000000-0000-0000-0000-000000000001';
    private const USER_ID = '00000000-0000-0000-0000-000000000002';

    protected function setUp(): void
    {
        parent::setUp();
        $this->database = db_connect();
        $this->database->query('DROP TABLE IF EXISTS ' . $this->database->getPrefix() . 'pedidos');
        $this->database->query(
            'CREATE TABLE ' . $this->database->getPrefix()
            . 'pedidos (id VARCHAR(64) PRIMARY KEY, cliente_id VARCHAR(64), usuario_id VARCHAR(64), valor_total DECIMAL(10,2), status VARCHAR(50), pago INT, forma_pagamento VARCHAR(50))'
        );
        foreach (['itens_pedido', 'produtos'] as $tabela) {
            $this->database->query('DROP TABLE IF EXISTS ' . $this->database->getPrefix() . $tabela);
        }
        $this->database->query(
            'CREATE TABLE ' . $this->database->getPrefix()
            . 'produtos (id VARCHAR(64) PRIMARY KEY, preco DECIMAL(10,2), ativo INT, disponivel INT)'
        );
        $this->database->query(
            'CREATE TABLE ' . $this->database->getPrefix()
            . 'itens_pedido (id INTEGER PRIMARY KEY, pedido_id VARCHAR(64), produto_id VARCHAR(64), quantidade INT)'
        );
        $this->database->table('produtos')->insert(['id' => 'bolo', 'preco' => 42.50, 'ativo' => 1, 'disponivel' => 1]);
        $this->database->table('itens_pedido')->insert(['pedido_id' => self::ORDER_ID, 'produto_id' => 'bolo', 'quantidade' => 1]);
        $this->database->table('pedidos')->insert([
            'id' => self::ORDER_ID,
            'cliente_id' => self::USER_ID,
            'valor_total' => 42.50,
            'status' => 'aguardando_confirmacao',
            'pago' => 0,
        ]);
    }

    protected function tearDown(): void
    {
        foreach (['pedidos', 'itens_pedido', 'produtos'] as $tabela) {
            $this->database->query('DROP TABLE IF EXISTS ' . $this->database->getPrefix() . $tabela);
        }
        parent::tearDown();
    }

    public function testApprovedPaymentConfirmsOnlyTheMatchingOrderAndAmount(): void
    {
        $service = new MercadoPagoServiceFake();
        $service->gatewayResponse = [
            'id' => 123,
            'status' => 'approved',
            'external_reference' => self::ORDER_ID,
            'currency_id' => 'BRL',
            'transaction_amount' => 42.50,
        ];

        $result = $service->consultarStatus('123', self::ORDER_ID, null, self::USER_ID);

        $this->assertSame(200, $result['status']);
        $this->assertTrue($result['data']['pago']);
        $this->assertSame(1, (int) $this->order()['pago']);
        $this->assertSame('confirmado', $this->order()['status']);
    }

    public function testApprovedPaymentWithWrongAmountDoesNotConfirmOrder(): void
    {
        $service = new MercadoPagoServiceFake();
        $service->gatewayResponse = [
            'id' => 123,
            'status' => 'approved',
            'external_reference' => self::ORDER_ID,
            'currency_id' => 'BRL',
            'transaction_amount' => 42.49,
        ];

        $result = $service->consultarStatus('123', self::ORDER_ID, null, self::USER_ID);

        $this->assertSame(409, $result['status']);
        $this->assertSame(0, (int) $this->order()['pago']);
        $this->assertSame('aguardando_confirmacao', $this->order()['status']);
    }

    public function testApprovedPaymentInWrongCurrencyDoesNotConfirmOrder(): void
    {
        $service = new MercadoPagoServiceFake();
        $service->gatewayResponse = [
            'id' => 123,
            'status' => 'approved',
            'external_reference' => self::ORDER_ID,
            'currency_id' => 'USD',
            'transaction_amount' => 42.50,
        ];

        $result = $service->consultarStatus('123', self::ORDER_ID, null, self::USER_ID);

        $this->assertSame(409, $result['status']);
        $this->assertSame(0, (int) $this->order()['pago']);
    }

    public function testCheckoutReturnConfirmsThePaymentFoundForThatOrder(): void
    {
        $service = new MercadoPagoServiceFake();
        $service->gatewayResponse = [
            'results' => [[
                'id' => 123,
                'status' => 'approved',
                'external_reference' => self::ORDER_ID,
                'currency_id' => 'BRL',
                'transaction_amount' => 42.50,
            ]],
        ];

        $result = $service->consultarStatusCheckout(self::ORDER_ID, self::USER_ID);

        $this->assertSame(200, $result['status']);
        $this->assertTrue($result['data']['pago']);
        $this->assertSame(1, (int) $this->order()['pago']);
    }

    public function testCheckoutReturnDoesNotConfirmAnUnrelatedPayment(): void
    {
        $service = new MercadoPagoServiceFake();
        $service->gatewayResponse = [
            'results' => [[
                'id' => 123,
                'status' => 'approved',
                'external_reference' => '00000000-0000-0000-0000-000000000099',
                'currency_id' => 'BRL',
                'transaction_amount' => 42.50,
            ]],
        ];

        $result = $service->consultarStatusCheckout(self::ORDER_ID, self::USER_ID);

        $this->assertSame(200, $result['status']);
        $this->assertFalse($result['data']['pago']);
        $this->assertSame(0, (int) $this->order()['pago']);
    }

    public function testCheckoutReturnRecognizesPaymentAlreadyConfirmedByWebhook(): void
    {
        $this->database->table('pedidos')->where('id', self::ORDER_ID)->update([
            'status' => 'confirmado',
            'pago' => 1,
        ]);
        $service = new MercadoPagoServiceFake();

        $result = $service->consultarStatusCheckout(self::ORDER_ID, self::USER_ID);

        $this->assertSame(200, $result['status']);
        $this->assertTrue($result['data']['pago']);
        $this->assertSame([], $service->requestedUrls);
    }

    public function testPixRetryReusesThePendingPixInsteadOfCreatingAnother(): void
    {
        $service = new PixGatewayFake();
        $service->searchResults = [$this->pixPendente(777)];

        $result = $service->gerarPix($this->pixPayload(), null, self::USER_ID);

        $this->assertSame(200, $result['status']);
        $this->assertSame(777, $result['data']['pagamento_id']);
        $this->assertSame('codigo-777', $result['data']['pix_copia_cola']);
        $this->assertSame([], $service->createdKeys, 'Não deveria criar uma segunda cobrança.');
    }

    public function testPixIdempotencyKeyIsStableForTheSameDataAndChangesWithTheCpf(): void
    {
        $service = new PixGatewayFake();
        $service->gerarPix($this->pixPayload(), null, self::USER_ID);
        $service->gerarPix($this->pixPayload(), null, self::USER_ID);
        $service->gerarPix($this->pixPayload('52998224725'), null, self::USER_ID);

        $this->assertCount(3, $service->createdKeys);
        $this->assertSame($service->createdKeys[0], $service->createdKeys[1]);
        $this->assertNotSame($service->createdKeys[0], $service->createdKeys[2]);
    }

    public function testExpiredPixGetsANewIdempotencyKey(): void
    {
        $service = new PixGatewayFake();
        $service->gerarPix($this->pixPayload(), null, self::USER_ID);
        $vencido = $this->pixPendente(555);
        $vencido['date_of_expiration'] = date('c', time() - 3600);
        $service->searchResults = [$vencido];
        $service->gerarPix($this->pixPayload(), null, self::USER_ID);

        $this->assertNotSame($service->createdKeys[0], $service->createdKeys[1]);
    }

    public function testPendingPixResponseNeverRevertsAPaidOrder(): void
    {
        $service = new PixGatewayFake();
        // O webhook confirma o pedido enquanto a cobrança desta tentativa ainda estava sendo criada.
        $service->antesDeResponder = function (): void {
            $this->database->table('pedidos')->where('id', self::ORDER_ID)->update(['status' => 'confirmado', 'pago' => 1]);
        };

        $result = $service->gerarPix($this->pixPayload(), null, self::USER_ID);

        $this->assertSame(200, $result['status']);
        $this->assertTrue($result['data']['pago']);
        $this->assertSame(1, (int) $this->order()['pago']);
        $this->assertSame('confirmado', $this->order()['status']);
    }

    public function testWebhookIsOnlyReadyWithBothUrlAndSecret(): void
    {
        $urlAntiga = getenv('WEBHOOK_URL');
        $segredoAntigo = getenv('MP_WEBHOOK_SECRET');
        try {
            putenv('WEBHOOK_URL=https://exemplo.com.br/api/webhook/mercadopago');
            putenv('MP_WEBHOOK_SECRET');
            unset($_ENV['MP_WEBHOOK_SECRET'], $_SERVER['MP_WEBHOOK_SECRET']);
            $this->assertFalse((new MercadoPagoService())->hasWebhook(), 'Sem segredo o webhook não pode aparecer como pronto.');

            putenv('MP_WEBHOOK_SECRET=segredo-de-teste');
            $this->assertTrue((new MercadoPagoService())->hasWebhook());

            putenv('WEBHOOK_URL');
            unset($_ENV['WEBHOOK_URL'], $_SERVER['WEBHOOK_URL']);
            $this->assertFalse((new MercadoPagoService())->hasWebhook(), 'Sem URL o webhook não pode aparecer como pronto.');
        } finally {
            putenv($urlAntiga === false ? 'WEBHOOK_URL' : 'WEBHOOK_URL=' . $urlAntiga);
            putenv($segredoAntigo === false ? 'MP_WEBHOOK_SECRET' : 'MP_WEBHOOK_SECRET=' . $segredoAntigo);
        }
    }

    private function pixPayload(string $cpf = '11144477735'): array
    {
        return [
            'pedido_id' => self::ORDER_ID,
            'valor'     => 42.50,
            'cliente'   => ['nome' => 'Maria Teste', 'email' => 'maria@exemplo.com', 'cpf' => $cpf],
        ];
    }

    private function pixPendente(int $id): array
    {
        return [
            'id' => $id,
            'status' => 'pending',
            'payment_method_id' => 'pix',
            'external_reference' => self::ORDER_ID,
            'transaction_amount' => 42.50,
            'date_of_expiration' => date('c', time() + 3600),
            'point_of_interaction' => ['transaction_data' => ['qr_code' => 'codigo-' . $id, 'qr_code_base64' => 'aW1n']],
        ];
    }

    private function order(): array
    {
        return $this->database->table('pedidos')->where('id', self::ORDER_ID)->get()->getRowArray();
    }
}

final class MercadoPagoServiceFake extends MercadoPagoService
{
    public array $gatewayResponse = [];
    public array $requestedUrls = [];

    protected function callMercadoPago(string $method, string $url, ?array $payload = null, ?string $idempotencyKey = null): array
    {
        $this->requestedUrls[] = $url;
        return ['http_code' => 200, 'data' => $this->gatewayResponse, 'error' => ''];
    }
}

final class PixGatewayFake extends MercadoPagoService
{
    public array $searchResults = [];
    public array $createdKeys = [];
    /** @var callable|null */
    public $antesDeResponder = null;

    protected function callMercadoPago(string $method, string $url, ?array $payload = null, ?string $idempotencyKey = null): array
    {
        if ($method === 'GET' && str_contains($url, '/payments/search')) {
            return ['http_code' => 200, 'data' => ['results' => $this->searchResults], 'error' => ''];
        }
        $this->createdKeys[] = $idempotencyKey;
        if ($this->antesDeResponder !== null) {
            ($this->antesDeResponder)();
        }
        $id = 1000 + count($this->createdKeys);
        return ['http_code' => 201, 'data' => [
            'id' => $id,
            'status' => 'pending',
            'transaction_amount' => $payload['transaction_amount'] ?? 0,
            'point_of_interaction' => ['transaction_data' => ['qr_code' => 'codigo-' . $id, 'qr_code_base64' => 'aW1n']],
        ], 'error' => ''];
    }
}
