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
            . 'pedidos (id VARCHAR(64) PRIMARY KEY, cliente_id VARCHAR(64), usuario_id VARCHAR(64), valor_total DECIMAL(10,2), status VARCHAR(50), pago INT)'
        );
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
        $this->database->query('DROP TABLE IF EXISTS ' . $this->database->getPrefix() . 'pedidos');
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
