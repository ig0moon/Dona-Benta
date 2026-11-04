<?php

use CodeIgniter\Router\RouteCollection;

/**
 * @var RouteCollection $routes
 */

// ============================================
// ROTAS DO FRONTEND (MVC VIEWS)
// ============================================
$routes->get('/', 'Home::index');
$routes->get('home', 'Home::index');
$routes->get('catalogo', 'Catalogo::index');
$routes->get('produto', 'Catalogo::produto');
$routes->get('carrinho', 'Carrinho::index');
$routes->get('pedidos', 'Pedidos::index');
$routes->get('conta', 'Conta::index');
$routes->get('login', 'Auth::login');
$routes->get('sobre', 'Sobre::index');
$routes->get('faq', 'Faq::index');
$routes->get('teste-banco', 'DatabaseTest::index');
$routes->post('teste-banco', 'DatabaseTest::test');

// Compatibilidade de URLs legadas (.html)
$routes->addRedirect('index.html', '/');
$routes->addRedirect('catalogo.html', 'catalogo');
$routes->addRedirect('produto.html', 'produto');
$routes->addRedirect('carrinho.html', 'carrinho');
$routes->addRedirect('pedidos.html', 'pedidos');
$routes->addRedirect('conta.html', 'conta');
$routes->addRedirect('login.html', 'login');
$routes->addRedirect('sobre.html', 'sobre');
$routes->addRedirect('faq.html', 'faq');

// ============================================
// ROTAS DA API REST (PAGAMENTOS & GATEWAY)
// ============================================
$routes->group('api', ['namespace' => 'App\Controllers\Api'], static function (RouteCollection $routes) {
    $routes->get('auth/session', 'FrontendAuthController::session');
    $routes->post('auth/login', 'FrontendAuthController::login');
    $routes->post('auth/signup', 'FrontendAuthController::signup');
    $routes->post('auth/recovery', 'FrontendAuthController::recovery');
    $routes->post('auth/update', 'FrontendAuthController::update');
    $routes->post('auth/logout', 'FrontendAuthController::logout');
    $routes->match(['get', 'post', 'patch', 'delete'], 'data/(:segment)', 'FrontendDataController::handle/$1');
    $routes->get('storage/public', 'FrontendStorageController::publicObject');
    $routes->post('storage/upload', 'FrontendStorageController::upload');

    // Status e Configurações
    $routes->get('health', 'PagamentoController::health');
    $routes->get('config', 'PagamentoController::config');

    // Pagamentos Mercado Pago
    $routes->post('pagamento/pix', 'PagamentoController::gerarPix');
    $routes->post('pagamento/cartao', 'PagamentoController::processarCartao');
    $routes->get('pagamento/status', 'PagamentoController::consultarStatus');
    $routes->post('pagamento/simular-aprovacao', 'PagamentoController::simularAprovacao');

    // Webhooks
    $routes->post('webhook/mercadopago', 'PagamentoController::webhook');

    // Suporte a OPTIONS CORS Pre-flight
    $routes->options('(:any)', 'PagamentoController::health');
});
