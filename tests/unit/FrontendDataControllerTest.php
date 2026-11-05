<?php

use App\Controllers\Api\FrontendDataController;
use CodeIgniter\HTTP\IncomingRequest;
use CodeIgniter\HTTP\URI;
use CodeIgniter\HTTP\UserAgent;
use CodeIgniter\Test\CIUnitTestCase;

/**
 * @internal
 */
final class FrontendDataControllerTest extends CIUnitTestCase
{
    public function testQueryValidationAcceptsProductIdsWithEncodedPunctuation(): void
    {
        $request = new IncomingRequest(
            config('App'),
            new URI('https://example.com/api/data/produtos'),
            '',
            new UserAgent(),
        );
        $request->setGlobal('get', [
            'select' => '*',
            'id' => 'eq.produto/edição+especial:1',
        ]);

        $controller = new FrontendDataController();
        $controller->initController($request, service('response'), service('logger'));

        $method = new ReflectionMethod($controller, 'validatedQuery');
        $query = $method->invoke($controller);

        $this->assertSame([
            'select' => '*',
            'id' => 'eq.produto/edição+especial:1',
        ], $query);
    }

    public function testQueryValidationRejectsUnknownFilterOperators(): void
    {
        $request = new IncomingRequest(
            config('App'),
            new URI('https://example.com/api/data/produtos'),
            '',
            new UserAgent(),
        );
        $request->setGlobal('get', ['id' => 'contains.bolo']);

        $controller = new FrontendDataController();
        $controller->initController($request, service('response'), service('logger'));

        $method = new ReflectionMethod($controller, 'validatedQuery');

        $this->assertNull($method->invoke($controller));
    }
}
